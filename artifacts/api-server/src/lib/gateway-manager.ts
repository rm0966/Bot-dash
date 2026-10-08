import { Client, GatewayIntentBits, Message } from "discord.js";
import { db, autoRepliesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

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
const lastAiFailureNoticeAt = new Map<string, number>();

async function callAI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.GROQ_AI;
  if (!apiKey) {
    throw new Error("GROQ_AI is not configured on the server");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_completion_tokens: 700,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    throw new Error(
      `Groq request failed (${res.status}): ${data?.error?.message ?? res.statusText}`
    );
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Groq returned an empty response");
  }
  return reply.slice(0, 1900); // Discord limit safety
}

function shouldNotifyAiFailure(guildId: string): boolean {
  const now = Date.now();
  const lastNotice = lastAiFailureNoticeAt.get(guildId) ?? 0;
  if (now - lastNotice < 60_000) return false;
  lastAiFailureNoticeAt.set(guildId, now);
  return true;
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

    try {
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

      let typingInterval: ReturnType<typeof setInterval> | undefined;
      try {
        await (message.channel as any).sendTyping();
        typingInterval = setInterval(() => {
          void (message.channel as any).sendTyping().catch((error: unknown) => {
            logger.debug(
              { guildId, channelId: message.channelId, error: String(error) },
              "Failed to refresh Discord typing indicator"
            );
          });
        }, 8_000);

        const reply = await callAI(history, ai.systemPrompt);
        history.push({ role: "assistant", content: reply });
        ai.history.set(hKey, history);

        await message.reply(reply);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (shouldNotifyAiFailure(guildId)) {
          logger.error(
            { guildId, channelId: message.channelId, error: errorMessage },
            "AI reply failed"
          );
          try {
            await message.reply("عذرًا، تعذّر توليد الرد الآن. يرجى مراجعة إعدادات الذكاء الاصطناعي.");
          } catch (noticeError) {
            logger.error(
              {
                guildId,
                channelId: message.channelId,
                error: noticeError instanceof Error ? noticeError.message : String(noticeError),
              },
              "Failed to send AI error notice"
            );
          }
        }
      } finally {
        if (typingInterval) clearInterval(typingInterval);
      }
    } catch (error) {
      logger.error(
        {
          guildId,
          channelId: message.channelId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Discord message handler failed"
      );
    }
  });

  await client.login(token);
  sessions.set(key, { client, guildId, token, ai });
}

export async function deactivateGuild(guildId: string): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) return;
  await session.client.destroy();
  sessions.delete(guildId);
  lastAiFailureNoticeAt.delete(guildId);
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
