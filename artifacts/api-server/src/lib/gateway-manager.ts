import { Client, GatewayIntentBits, Message } from "discord.js";
import { db, autoRepliesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

interface AiConfig {
  enabled: boolean;
  channels: string[]; // empty = all channels
  systemPrompt: string;
  history: Map<string, Array<{ role: string; content: string }>>;
}

interface ActiveSession {
  client: Client;
  guildId: string;
  token: string;
  ai: AiConfig;
}

const sessions = new Map<string, ActiveSession>();

async function callAI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  try {
    const body = {
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      model: "openai-large",
      private: true,
      seed: Math.floor(Math.random() * 99999),
    };
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.trim().slice(0, 1900); // Discord limit safety
  } catch {
    return "";
  }
}

function historyKey(channelId: string, userId: string) {
  return `${channelId}:${userId}`;
}

export async function activateGuild(token: string, guildId: string): Promise<void> {
  const key = guildId;
  if (sessions.has(key)) return;

  const ai: AiConfig = {
    enabled: false,
    channels: [],
    systemPrompt: "أنت مساعد ذكي ومفيد في سيرفر ديسكورد. أجب بإيجاز وأدب.",
    history: new Map(),
  };

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (message.guildId !== guildId) return;

    // --- Auto-reply rules ---
    const rules = await db
      .select()
      .from(autoRepliesTable)
      .where(and(eq(autoRepliesTable.guildId, guildId), eq(autoRepliesTable.isActive, true)));

    const content = message.content.toLowerCase();
    let autoReplied = false;

    for (const rule of rules) {
      const trigger = rule.trigger.toLowerCase();
      let matched = false;
      if (rule.matchType === "exact") matched = content === trigger;
      else if (rule.matchType === "startsWith") matched = content.startsWith(trigger);
      else matched = content.includes(trigger);

      if (matched) {
        await message.reply(rule.response);
        autoReplied = true;
        break;
      }
    }

    if (autoReplied) return;

    // --- AI reply ---
    const session = sessions.get(key);
    if (!session) return;
    const { ai } = session;
    if (!ai.enabled) return;
    if (ai.channels.length > 0 && !ai.channels.includes(message.channelId)) return;

    const hKey = historyKey(message.channelId, message.author.id);
    const history = ai.history.get(hKey) || [];

    history.push({ role: "user", content: message.content });
    if (history.length > 20) history.splice(0, history.length - 20);

    try {
      await (message.channel as any).sendTyping();
    } catch {}

    const reply = await callAI(history, ai.systemPrompt);
    if (!reply) return;

    history.push({ role: "assistant", content: reply });
    ai.history.set(hKey, history);

    try {
      await message.reply(reply);
    } catch {}
  });

  await client.login(token);
  sessions.set(key, { client, guildId, token, ai });
}

export async function deactivateGuild(guildId: string): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) return;
  await session.client.destroy();
  sessions.delete(guildId);
}

export function isGuildActive(guildId: string): boolean {
  return sessions.has(guildId);
}

export function configureAI(
  guildId: string,
  config: Partial<Pick<AiConfig, "enabled" | "channels" | "systemPrompt">>
): void {
  const session = sessions.get(guildId);
  if (!session) return;
  if (config.enabled !== undefined) session.ai.enabled = config.enabled;
  if (config.channels !== undefined) session.ai.channels = config.channels;
  if (config.systemPrompt !== undefined) session.ai.systemPrompt = config.systemPrompt;
}

export function getAIConfig(
  guildId: string
): { enabled: boolean; channels: string[]; systemPrompt: string } | null {
  const session = sessions.get(guildId);
  if (!session) return null;
  return {
    enabled: session.ai.enabled,
    channels: session.ai.channels,
    systemPrompt: session.ai.systemPrompt,
  };
}

export function clearAIHistory(guildId: string): void {
  const session = sessions.get(guildId);
  if (!session) return;
  session.ai.history.clear();
}
