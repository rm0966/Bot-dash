import { Client, GatewayIntentBits, Message } from "discord.js";
import { db, autoRepliesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

interface ActiveSession {
  client: Client;
  guildId: string;
  token: string;
}

const sessions = new Map<string, ActiveSession>();

function makeKey(guildId: string) {
  return guildId;
}

export async function activateGuild(token: string, guildId: string): Promise<void> {
  const key = makeKey(guildId);
  if (sessions.has(key)) {
    return;
  }

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

    const rules = await db
      .select()
      .from(autoRepliesTable)
      .where(and(eq(autoRepliesTable.guildId, guildId), eq(autoRepliesTable.isActive, true)));

    const content = message.content.toLowerCase();

    for (const rule of rules) {
      const trigger = rule.trigger.toLowerCase();
      let matched = false;

      if (rule.matchType === "exact") {
        matched = content === trigger;
      } else if (rule.matchType === "startsWith") {
        matched = content.startsWith(trigger);
      } else {
        matched = content.includes(trigger);
      }

      if (matched) {
        await message.reply(rule.response);
        break;
      }
    }
  });

  await client.login(token);
  sessions.set(key, { client, guildId, token });
}

export async function deactivateGuild(guildId: string): Promise<void> {
  const key = makeKey(guildId);
  const session = sessions.get(key);
  if (!session) return;
  await session.client.destroy();
  sessions.delete(key);
}

export function isGuildActive(guildId: string): boolean {
  return sessions.has(makeKey(guildId));
}
