import {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GuildMember,
  Message,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import {
  db,
  guildAuditLogsTable,
  guildFeatureSettingsTable,
  spamInfractionsTable,
  ticketsTable,
} from "@workspace/db";
import { logger } from "./logger";

const defaultWelcomeText = "أهلًا {user} بك في {server}!";
const defaultLeaveText = "غادر {user} السيرفر.";
const recentMessageActivity = new Map<
  string,
  { timestamps: number[]; recentContents: Array<{ normalized: string; at: number }> }
>();

async function getFeatureSettings(guildId: string) {
  const [settings] = await db
    .select()
    .from(guildFeatureSettingsTable)
    .where(eq(guildFeatureSettingsTable.guildId, guildId));
  return settings ?? null;
}

function fillMemberMessage(
  template: string,
  member: GuildMember
): string {
  return template
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{userId}", member.id)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{memberCount}", String(member.guild.memberCount))
    .slice(0, 2000);
}

async function sendConfiguredMessage(
  client: Client,
  channelId: string | null,
  content: string
): Promise<void> {
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) return;
  await (channel as TextChannel).send({
    content,
    allowedMentions: { parse: [], users: [...content.matchAll(/<@(\d+)>/g)].map((match) => match[1]!) },
  });
}

function classifySpam(message: Message, settings: NonNullable<Awaited<ReturnType<typeof getFeatureSettings>>>): string | null {
  const now = Date.now();
  const memberKey = `${message.guildId}:${message.author.id}`;
  const activity = recentMessageActivity.get(memberKey) ?? { timestamps: [], recentContents: [] };
  const windowMs = settings.spamWindowSeconds * 1000;
  activity.timestamps = activity.timestamps.filter((at) => now - at <= windowMs);
  activity.recentContents = activity.recentContents.filter((item) => now - item.at <= 15_000);

  activity.timestamps.push(now);
  const normalized = message.content.trim().toLowerCase().replace(/\s+/g, " ");
  activity.recentContents.push({ normalized, at: now });
  recentMessageActivity.set(memberKey, activity);

  if (settings.spamBlockInvites && /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(message.content)) {
    return "روابط دعوات ديسكورد غير مسموح بها";
  }
  if (settings.spamBlockLinks && /(?:https?:\/\/|www\.)/i.test(message.content)) {
    return "الروابط غير مسموح بها";
  }
  if (activity.timestamps.length > settings.spamMaxMessages) {
    return "إرسال الرسائل بسرعة كبيرة";
  }
  const duplicateCount = activity.recentContents.filter((item) => item.normalized === normalized).length;
  if (normalized.length > 0 && duplicateCount >= settings.spamDuplicateLimit) {
    return "تكرار الرسالة عدة مرات";
  }
  return null;
}

async function recordSpamInfraction(message: Message, guildId: string): Promise<number> {
  const [previous] = await db
    .select()
    .from(spamInfractionsTable)
    .where(and(
      eq(spamInfractionsTable.guildId, guildId),
      eq(spamInfractionsTable.userId, message.author.id)
    ));
  const now = new Date();
  const count = previous && now.getTime() - previous.lastViolationAt.getTime() < 30 * 24 * 60 * 60 * 1000
    ? previous.strikeCount + 1
    : 1;

  await db
    .insert(spamInfractionsTable)
    .values({
      guildId,
      userId: message.author.id,
      strikeCount: count,
      lastViolationAt: now,
    })
    .onConflictDoUpdate({
      target: [spamInfractionsTable.guildId, spamInfractionsTable.userId],
      set: { strikeCount: count, lastViolationAt: now },
    });
  return count;
}

export async function handleAntiSpamMessage(
  message: Message,
  guildId: string
): Promise<boolean> {
  if (message.guildId !== guildId || !message.member || message.author.bot) return false;

  const settings = await getFeatureSettings(guildId);
  if (!settings?.spamEnabled) return false;
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)
    || message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return false;
  }

  const reason = classifySpam(message, settings);
  if (!reason) return false;

  const strikes = await recordSpamInfraction(message, guildId);
  await message.delete().catch((error) => {
    logger.warn({ guildId, messageId: message.id, error: String(error) }, "Could not remove spam message");
  });

  const timeoutMs = strikes < 2
    ? 0
    : Math.min(
        settings.spamTimeoutMinutes * 60_000 * (2 ** (strikes - 2)),
        7 * 24 * 60 * 60 * 1000
      );

  if (timeoutMs > 0) {
    await message.member.timeout(timeoutMs, `مكافحة السبام: ${reason}`).catch((error) => {
      logger.warn({ guildId, userId: message.author.id, error: String(error) }, "Could not timeout spammer");
    });
  }

  const response = timeoutMs > 0
    ? `تم إسكات <@${message.author.id}> لمدة ${Math.ceil(timeoutMs / 60_000)} دقيقة بسبب ${reason}.`
    : `تنبيه <@${message.author.id}>: ${reason}. المخالفة التالية ستؤدي إلى إسكات مؤقت.`;
  const warning = await message.channel.send({
    content: response,
    allowedMentions: { users: [message.author.id] },
  }).catch(() => null);
  if (warning) {
    setTimeout(() => void warning.delete().catch(() => undefined), 10_000).unref?.();
  }
  return true;
}

async function handleMemberJoin(client: Client, member: GuildMember, guildId: string) {
  if (member.guild.id !== guildId) return;
  const settings = await getFeatureSettings(guildId);
  if (!settings?.welcomeEnabled) return;
  await sendConfiguredMessage(
    client,
    settings.welcomeChannelId,
    fillMemberMessage(settings.welcomeMessage || defaultWelcomeText, member)
  );
}

async function handleMemberLeave(client: Client, member: GuildMember, guildId: string) {
  if (member.guild.id !== guildId) return;
  const settings = await getFeatureSettings(guildId);
  if (!settings?.leaveEnabled) return;
  await sendConfiguredMessage(
    client,
    settings.leaveChannelId,
    fillMemberMessage(settings.leaveMessage || defaultLeaveText, member)
  );
}

function ticketCloseButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("community-ticket:close")
      .setLabel("إغلاق التذكرة")
      .setStyle(ButtonStyle.Danger)
  );
}

async function openTicket(client: Client, interaction: import("discord.js").ButtonInteraction, guildId: string) {
  const settings = await getFeatureSettings(guildId);
  if (!settings?.ticketsEnabled || !interaction.guild) {
    await interaction.reply({ content: "نظام التذاكر غير مفعّل حاليًا.", ephemeral: true });
    return;
  }

  const [existing] = await db
    .select()
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.guildId, guildId),
      eq(ticketsTable.openerId, interaction.user.id),
      eq(ticketsTable.status, "open")
    ));
  if (existing) {
    await interaction.reply({
      content: `لديك تذكرة مفتوحة بالفعل: <#${existing.channelId}>`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const safeName = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40) || "member";
  const overwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    ...(settings.supportRoleId
      ? [{
          id: settings.supportRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        }]
      : []),
  ];

  const channel = await interaction.guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    parent: settings.ticketCategoryId ?? undefined,
    permissionOverwrites: overwrites,
  });
  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      guildId,
      channelId: channel.id,
      openerId: interaction.user.id,
      openerName: interaction.user.tag,
    })
    .returning();

  await channel.send({
    content: `مرحبًا <@${interaction.user.id}>. اشرح طلبك هنا وسيرد فريق الدعم قريبًا.`,
    components: [ticketCloseButton()],
    allowedMentions: { users: [interaction.user.id] },
  });
  await interaction.editReply({ content: `تم فتح تذكرتك: <#${channel.id}>` });
  logger.info({ guildId, ticketId: ticket?.id, channelId: channel.id }, "Support ticket opened");
}

async function closeTicket(interaction: import("discord.js").ButtonInteraction, guildId: string) {
  if (!interaction.guild || !interaction.channel) return;
  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.guildId, guildId),
      eq(ticketsTable.channelId, interaction.channelId),
      eq(ticketsTable.status, "open")
    ));
  if (!ticket) {
    await interaction.reply({ content: "هذه التذكرة مغلقة أو غير موجودة.", ephemeral: true });
    return;
  }

  const settings = await getFeatureSettings(guildId);
  const member = interaction.member as GuildMember | null;
  const isSupport = Boolean(
    settings?.supportRoleId && member?.roles?.cache?.has(settings.supportRoleId)
  );
  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ?? false;
  if (interaction.user.id !== ticket.openerId && !isSupport && !canManage) {
    await interaction.reply({ content: "ليس لديك صلاحية إغلاق هذه التذكرة.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel as TextChannel;
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const ordered = messages ? [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp) : [];
  const excerpts = ordered
    .filter((message) => !message.author.bot && message.content.trim())
    .slice(-5)
    .map((message) => `${message.author.tag}: ${message.content.slice(0, 300)}`);
  const summary = [
    `ملخص التذكرة #${ticket.id}`,
    `صاحب التذكرة: ${ticket.openerName} (${ticket.openerId})`,
    `أُنشئت: ${ticket.createdAt.toISOString()}`,
    `أُغلقت بواسطة: ${interaction.user.tag}`,
    `عدد الرسائل المحفوظة: ${ordered.length}`,
    ...(excerpts.length ? ["آخر الرسائل:", ...excerpts] : ["لم تُسجّل رسائل نصية."]),
  ].join("\n").slice(0, 4000);

  await db
    .update(ticketsTable)
    .set({ status: "closed", summary, closedAt: new Date() })
    .where(eq(ticketsTable.id, ticket.id));

  await channel.permissionOverwrites.edit(ticket.openerId, {
    SendMessages: false,
  }).catch((error) => {
    logger.warn({ guildId, ticketId: ticket.id, error: String(error) }, "Could not lock closed ticket");
  });
  await channel.send({ content: "أُغلقت التذكرة. حُفظ ملخصها في سجل التذاكر." }).catch(() => undefined);

  if (settings?.transcriptChannelId) {
    await sendConfiguredMessage(
      interaction.client,
      settings.transcriptChannelId,
      `\`\`\`\n${summary.slice(0, 1900)}\n\`\`\``
    );
  }
  await interaction.editReply({ content: "أُغلقت التذكرة وحُفظ ملخصها." });
}

async function handleTicketInteraction(
  client: Client,
  interaction: import("discord.js").Interaction,
  guildId: string
) {
  if (!interaction.isButton() || interaction.guildId !== guildId) return;
  if (interaction.customId === "community-ticket:open") {
    await openTicket(client, interaction, guildId);
  } else if (interaction.customId === "community-ticket:close") {
    await closeTicket(interaction, guildId);
  }
}

export async function publishTicketPanel(client: Client, guildId: string): Promise<void> {
  const settings = await getFeatureSettings(guildId);
  if (!settings?.ticketsEnabled || !settings.ticketPanelChannelId) {
    throw new Error("Enable tickets and choose a panel channel first");
  }

  const channel = await client.channels.fetch(settings.ticketPanelChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("Ticket panel must be sent to a text channel");
  }
  const embed = new EmbedBuilder()
    .setTitle("الدعم الفني")
    .setDescription("اضغط الزر أدناه لفتح تذكرة خاصة مع فريق الدعم.")
    .setColor(0x5865f2);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("community-ticket:open")
      .setLabel("فتح تذكرة")
      .setStyle(ButtonStyle.Primary)
  );
  const textChannel = channel as TextChannel;
  const existing = settings.ticketPanelMessageId
    ? await textChannel.messages.fetch(settings.ticketPanelMessageId).catch(() => null)
    : null;
  const panel = existing
    ? await existing.edit({ embeds: [embed], components: [row] })
    : await textChannel.send({ embeds: [embed], components: [row] });

  await db
    .update(guildFeatureSettingsTable)
    .set({ ticketPanelMessageId: panel.id })
    .where(eq(guildFeatureSettingsTable.guildId, guildId));
}

export function registerGuildFeatureHandlers(client: Client, guildId: string): void {
  client.on("guildMemberAdd", (member) => {
    void handleMemberJoin(client, member, guildId).catch((error) => {
      logger.error({ guildId, error: String(error) }, "Welcome message handler failed");
    });
  });
  client.on("guildMemberRemove", (member) => {
    void handleMemberLeave(client, member, guildId).catch((error) => {
      logger.error({ guildId, error: String(error) }, "Leave message handler failed");
    });
  });
  client.on("interactionCreate", (interaction) => {
    void handleTicketInteraction(client, interaction, guildId).catch(async (error) => {
      logger.error({ guildId, error: String(error) }, "Ticket interaction failed");
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "تعذّر تنفيذ العملية. تحقق من صلاحيات البوت وحاول مجددًا.",
          ephemeral: true,
        }).catch(() => undefined);
      }
    });
  });
  client.on("guildAuditLogEntryCreate", (entry, guild) => {
    if (guild.id !== guildId) return;
    void (async () => {
      const settings = await getFeatureSettings(guildId);
      if (!settings?.auditEnabled) return;

      const actionLabels = new Map<number, string>([
        [AuditLogEvent.MemberBanAdd, "حظر عضو"],
        [AuditLogEvent.MemberKick, "طرد عضو"],
        [AuditLogEvent.MessageDelete, "حذف رسالة"],
        [AuditLogEvent.MessageBulkDelete, "حذف مجموعة رسائل"],
      ]);
      const action = actionLabels.get(entry.action);
      if (!action) return;

      const extra = entry.extra as { channel?: { id?: string }; channelId?: string } | null;
      await db.insert(guildAuditLogsTable).values({
        guildId,
        action,
        targetId: entry.targetId ?? null,
        executorId: entry.executorId ?? null,
        channelId: extra?.channel?.id ?? extra?.channelId ?? null,
        reason: entry.reason ?? null,
        details: entry.extra ? JSON.stringify(entry.extra).slice(0, 2000) : null,
        occurredAt: entry.createdAt,
      });
    })().catch((error) => {
      logger.error({ guildId, error: String(error) }, "Audit log capture failed");
    });
  });
}
