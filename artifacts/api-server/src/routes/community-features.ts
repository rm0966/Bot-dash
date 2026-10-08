import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  guildAuditLogsTable,
  guildFeatureSettingsTable,
  scheduledAnnouncementsTable,
  ticketsTable,
} from "@workspace/db";
import {
  ensureGuildGatewaySession,
  publishGuildTicketPanel,
} from "../lib/gateway-manager";

const router = Router();
const DISCORD_API = "https://discord.com/api/v10";

async function tokenCanAccessGuild(token: string, guildId: string): Promise<boolean> {
  const response = await fetch(`${DISCORD_API}/guilds/${encodeURIComponent(guildId)}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  return response.ok;
}

function getRequestToken(req: { get(name: string): string | undefined; body?: any }): string {
  const header = req.get("X-Bot-Token");
  const bodyToken = typeof req.body?.token === "string" ? req.body.token : "";
  return header ?? bodyToken;
}

function optionalSnowflake(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{1,25}$/.test(value)) return undefined;
  return value;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function defaultFeatureSettings(guildId: string) {
  return {
    guildId,
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: "أهلًا {user} بك في {server}!",
    leaveEnabled: false,
    leaveChannelId: null,
    leaveMessage: "غادر {user} السيرفر.",
    spamEnabled: false,
    spamMaxMessages: 5,
    spamWindowSeconds: 6,
    spamDuplicateLimit: 3,
    spamBlockInvites: true,
    spamBlockLinks: false,
    spamTimeoutMinutes: 10,
    ticketsEnabled: false,
    ticketPanelChannelId: null,
    ticketCategoryId: null,
    supportRoleId: null,
    transcriptChannelId: null,
    ticketPanelMessageId: null,
    auditEnabled: false,
  };
}

router.get("/discord/guilds/:guildId/community-features", async (req, res): Promise<void> => {
  const { guildId } = req.params;
  const token = getRequestToken(req);
  if (!token || !(await tokenCanAccessGuild(token, guildId))) {
    res.status(401).json({ error: "Missing or invalid bot token for this server" });
    return;
  }

  const [stored] = await db
    .select()
    .from(guildFeatureSettingsTable)
    .where(eq(guildFeatureSettingsTable.guildId, guildId));
  res.json(stored ?? defaultFeatureSettings(guildId));
});

router.put("/discord/guilds/:guildId/community-features", async (req, res): Promise<void> => {
  const { guildId } = req.params;
  const token = getRequestToken(req);
  if (!token || !(await tokenCanAccessGuild(token, guildId))) {
    res.status(401).json({ error: "Missing or invalid bot token for this server" });
    return;
  }

  const input = req.body ?? {};
  const booleanFields = [
    "welcomeEnabled", "leaveEnabled", "spamEnabled", "spamBlockInvites",
    "spamBlockLinks", "ticketsEnabled", "auditEnabled",
  ] as const;
  if (booleanFields.some((field) => !isBoolean(input[field]))) {
    res.status(400).json({ error: "Feature switches must be true or false" });
    return;
  }

  const welcomeChannelId = optionalSnowflake(input.welcomeChannelId);
  const leaveChannelId = optionalSnowflake(input.leaveChannelId);
  const ticketPanelChannelId = optionalSnowflake(input.ticketPanelChannelId);
  const ticketCategoryId = optionalSnowflake(input.ticketCategoryId);
  const transcriptChannelId = optionalSnowflake(input.transcriptChannelId);
  const supportRoleId = optionalSnowflake(input.supportRoleId);
  if ([welcomeChannelId, leaveChannelId, ticketPanelChannelId, ticketCategoryId, transcriptChannelId, supportRoleId]
    .some((value) => value === undefined)) {
    res.status(400).json({ error: "Channel and role IDs must be valid Discord IDs or empty" });
    return;
  }

  const messageFields = ["welcomeMessage", "leaveMessage"] as const;
  if (messageFields.some((field) => typeof input[field] !== "string" || input[field].length > 2000)) {
    res.status(400).json({ error: "Welcome and leave messages must be at most 2000 characters" });
    return;
  }
  if (
    !Number.isInteger(input.spamMaxMessages) || input.spamMaxMessages < 3 || input.spamMaxMessages > 30
    || !Number.isInteger(input.spamWindowSeconds) || input.spamWindowSeconds < 2 || input.spamWindowSeconds > 60
    || !Number.isInteger(input.spamDuplicateLimit) || input.spamDuplicateLimit < 2 || input.spamDuplicateLimit > 15
    || !Number.isInteger(input.spamTimeoutMinutes) || input.spamTimeoutMinutes < 1 || input.spamTimeoutMinutes > 10080
  ) {
    res.status(400).json({ error: "Anti-spam limits are outside the supported range" });
    return;
  }
  if (input.ticketsEnabled && !ticketPanelChannelId) {
    res.status(400).json({ error: "Choose a text channel for the ticket panel before enabling tickets" });
    return;
  }

  try {
    await ensureGuildGatewaySession(token, guildId);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not connect the bot to this server",
    });
    return;
  }

  const values = {
    guildId,
    welcomeEnabled: input.welcomeEnabled as boolean,
    welcomeChannelId: welcomeChannelId ?? null,
    welcomeMessage: input.welcomeMessage as string,
    leaveEnabled: input.leaveEnabled as boolean,
    leaveChannelId: leaveChannelId ?? null,
    leaveMessage: input.leaveMessage as string,
    spamEnabled: input.spamEnabled as boolean,
    spamMaxMessages: input.spamMaxMessages as number,
    spamWindowSeconds: input.spamWindowSeconds as number,
    spamDuplicateLimit: input.spamDuplicateLimit as number,
    spamBlockInvites: input.spamBlockInvites as boolean,
    spamBlockLinks: input.spamBlockLinks as boolean,
    spamTimeoutMinutes: input.spamTimeoutMinutes as number,
    ticketsEnabled: input.ticketsEnabled as boolean,
    ticketPanelChannelId: ticketPanelChannelId ?? null,
    ticketCategoryId: ticketCategoryId ?? null,
    supportRoleId: supportRoleId ?? null,
    transcriptChannelId: transcriptChannelId ?? null,
    auditEnabled: input.auditEnabled as boolean,
  };

  const [saved] = await db
    .insert(guildFeatureSettingsTable)
    .values(values)
    .onConflictDoUpdate({
      target: guildFeatureSettingsTable.guildId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  let ticketPanelWarning: string | null = null;
  if (values.ticketsEnabled) {
    try {
      await publishGuildTicketPanel(guildId);
    } catch {
      ticketPanelWarning =
        "حُفظت الإعدادات، لكن تعذّر نشر لوحة التذاكر. تحقق من صلاحيات البوت في القناة.";
    }
  }
  res.json({ ...saved, ticketPanelWarning });
});

router.get("/discord/guilds/:guildId/announcements", async (req, res): Promise<void> => {
  const { guildId } = req.params;
  const token = getRequestToken(req);
  if (!token || !(await tokenCanAccessGuild(token, guildId))) {
    res.status(401).json({ error: "Missing or invalid bot token for this server" });
    return;
  }

  const announcements = await db
    .select()
    .from(scheduledAnnouncementsTable)
    .where(eq(scheduledAnnouncementsTable.guildId, guildId))
    .orderBy(desc(scheduledAnnouncementsTable.nextRunAt))
    .limit(100);
  res.json(announcements);
});

router.post("/discord/guilds/:guildId/announcements", async (req, res): Promise<void> => {
  const { guildId } = req.params;
  const token = getRequestToken(req);
  if (!token || !(await tokenCanAccessGuild(token, guildId))) {
    res.status(401).json({ error: "Missing or invalid bot token for this server" });
    return;
  }

  const { channelId, content, repeatType, timeZone, nextRunAt } = req.body ?? {};
  if (
    typeof channelId !== "string" || !/^\d{1,25}$/.test(channelId)
    || typeof content !== "string" || !content.trim() || content.length > 1900
    || !["once", "daily", "weekly"].includes(repeatType)
    || typeof timeZone !== "string" || timeZone.length > 100
    || typeof nextRunAt !== "string" || !Number.isFinite(Date.parse(nextRunAt))
    || Date.parse(nextRunAt) <= Date.now()
  ) {
    res.status(400).json({ error: "Provide a channel, message, schedule, time zone, and future date" });
    return;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    res.status(400).json({ error: "The time zone is not recognized" });
    return;
  }

  try {
    await ensureGuildGatewaySession(token, guildId);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not connect the bot to this server",
    });
    return;
  }

  const [created] = await db
    .insert(scheduledAnnouncementsTable)
    .values({
      guildId,
      channelId,
      content: content.trim(),
      repeatType,
      timeZone,
      nextRunAt: new Date(nextRunAt),
    })
    .returning();
  res.status(201).json(created);
});

router.delete(
  "/discord/guilds/:guildId/announcements/:announcementId",
  async (req, res): Promise<void> => {
    const { guildId } = req.params;
    const announcementId = Number(req.params.announcementId);
    const token = getRequestToken(req);
    if (!token || !(await tokenCanAccessGuild(token, guildId))) {
      res.status(401).json({ error: "Missing or invalid bot token for this server" });
      return;
    }
    if (!Number.isInteger(announcementId) || announcementId < 1) {
      res.status(400).json({ error: "Invalid announcement ID" });
      return;
    }

    const [updated] = await db
      .update(scheduledAnnouncementsTable)
      .set({ isActive: false })
      .where(and(
        eq(scheduledAnnouncementsTable.id, announcementId),
        eq(scheduledAnnouncementsTable.guildId, guildId)
      ))
      .returning({ id: scheduledAnnouncementsTable.id });
    if (!updated) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    res.json({ success: true });
  }
);

router.get("/discord/guilds/:guildId/tickets", async (req, res): Promise<void> => {
  const { guildId } = req.params;
  const token = getRequestToken(req);
  if (!token || !(await tokenCanAccessGuild(token, guildId))) {
    res.status(401).json({ error: "Missing or invalid bot token for this server" });
    return;
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.guildId, guildId))
    .orderBy(desc(ticketsTable.createdAt))
    .limit(100);
  res.json(tickets);
});

router.get("/discord/guilds/:guildId/audit-logs", async (req, res): Promise<void> => {
  const { guildId } = req.params;
  const token = getRequestToken(req);
  if (!token || !(await tokenCanAccessGuild(token, guildId))) {
    res.status(401).json({ error: "Missing or invalid bot token for this server" });
    return;
  }

  const logs = await db
    .select()
    .from(guildAuditLogsTable)
    .where(eq(guildAuditLogsTable.guildId, guildId))
    .orderBy(desc(guildAuditLogsTable.occurredAt))
    .limit(100);
  res.json(logs);
});

export default router;
