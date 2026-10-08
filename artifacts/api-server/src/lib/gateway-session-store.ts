import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, gatewaySessionsTable } from "@workspace/db";
import { logger } from "./logger";

export interface GatewayAiSettings {
  enabled: boolean;
  channels: string[];
  systemPrompt: string;
}

export interface SavedGatewaySession extends GatewayAiSettings {
  guildId: string;
  token: string;
}

const tokenEncryptionInfo = Buffer.from("discord-gateway-token-v1");

function getTokenEncryptionKey(): Buffer {
  const masterSecret = process.env.SESSION_SECRET;
  if (!masterSecret) {
    throw new Error("SESSION_SECRET must be configured to persist Discord bot sessions");
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(masterSecret),
      Buffer.from("discord-bot-panel"),
      tokenEncryptionInfo,
      32
    )
  );
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptToken(encryptedToken: string): string {
  const [version, encodedIv, encodedTag, encodedValue, ...extra] = encryptedToken.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedValue || extra.length > 0) {
    throw new Error("Saved Discord bot token has an unsupported format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(),
    Buffer.from(encodedIv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function tokensMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function toSavedGatewaySession(
  record: typeof gatewaySessionsTable.$inferSelect
): SavedGatewaySession {
  return {
    guildId: record.guildId,
    token: decryptToken(record.encryptedToken),
    enabled: record.aiEnabled,
    channels: Array.isArray(record.channels)
      ? record.channels.filter((channel): channel is string => typeof channel === "string")
      : [],
    systemPrompt: record.systemPrompt,
  };
}

export async function saveGatewaySession(
  guildId: string,
  token: string,
  settings: GatewayAiSettings
): Promise<void> {
  const encryptedToken = encryptToken(token);
  await db
    .insert(gatewaySessionsTable)
    .values({
      guildId,
      encryptedToken,
      aiEnabled: settings.enabled,
      channels: settings.channels,
      systemPrompt: settings.systemPrompt,
    })
    .onConflictDoUpdate({
      target: gatewaySessionsTable.guildId,
      set: {
        encryptedToken,
        aiEnabled: settings.enabled,
        channels: settings.channels,
        systemPrompt: settings.systemPrompt,
        updatedAt: new Date(),
      },
    });
}

export async function getSavedGatewaySession(
  guildId: string
): Promise<SavedGatewaySession | null> {
  const [record] = await db
    .select()
    .from(gatewaySessionsTable)
    .where(eq(gatewaySessionsTable.guildId, guildId));
  return record ? toSavedGatewaySession(record) : null;
}

export async function listSavedGatewaySessions(): Promise<SavedGatewaySession[]> {
  const records = await db.select().from(gatewaySessionsTable);
  const sessions: SavedGatewaySession[] = [];

  for (const record of records) {
    try {
      sessions.push(toSavedGatewaySession(record));
    } catch (error) {
      logger.error(
        {
          guildId: record.guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Could not decrypt a saved Discord bot token"
      );
    }
  }

  return sessions;
}

export async function deleteSavedGatewaySession(guildId: string): Promise<void> {
  await db.delete(gatewaySessionsTable).where(eq(gatewaySessionsTable.guildId, guildId));
}
