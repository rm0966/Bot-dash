import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export interface GatewayAiSettings {
  enabled: boolean;
  channels: string[];
  systemPrompt: string;
}

export interface SavedGatewaySession extends GatewayAiSettings {
  guildId: string;
  token: string;
}

export interface GatewaySessionRecord {
  guildId: string;
  encryptedToken: string;
  aiEnabled: boolean;
  channels: string[];
  systemPrompt: string;
}

export interface GatewaySessionRepository {
  upsert(record: GatewaySessionRecord): Promise<void>;
  get(guildId: string): Promise<GatewaySessionRecord | null>;
  list(): Promise<GatewaySessionRecord[]>;
  delete(guildId: string): Promise<void>;
}

export type GatewayTokenCryptoErrorCode = "key_missing" | "token_unreadable";

export class GatewayTokenCryptoError extends Error {
  readonly code: GatewayTokenCryptoErrorCode;

  constructor(code: GatewayTokenCryptoErrorCode) {
    super(code === "key_missing"
      ? "SESSION_SECRET is not configured"
      : "Saved Discord bot token could not be decrypted");
    this.name = "GatewayTokenCryptoError";
    this.code = code;
  }
}

const tokenEncryptionInfo = Buffer.from("discord-gateway-token-v1");

function getTokenEncryptionKey(): Buffer {
  const masterSecret = process.env.SESSION_SECRET;
  if (!masterSecret) throw new GatewayTokenCryptoError("key_missing");

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

export function encryptBotToken(token: string): string {
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

export function decryptBotToken(encryptedToken: string): string {
  try {
    const [version, encodedIv, encodedTag, encodedValue, ...extra] = encryptedToken.split(".");
    if (version !== "v1" || !encodedIv || !encodedTag || !encodedValue || extra.length > 0) {
      throw new GatewayTokenCryptoError("token_unreadable");
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
  } catch (error) {
    if (error instanceof GatewayTokenCryptoError) throw error;
    throw new GatewayTokenCryptoError("token_unreadable");
  }
}

export function tokensMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function decodeRecord(record: GatewaySessionRecord): SavedGatewaySession {
  return {
    guildId: record.guildId,
    token: decryptBotToken(record.encryptedToken),
    enabled: record.aiEnabled,
    channels: Array.isArray(record.channels)
      ? record.channels.filter((channel): channel is string => typeof channel === "string")
      : [],
    systemPrompt: record.systemPrompt,
  };
}

export function createGatewaySessionStore(repository: GatewaySessionRepository) {
  return {
    async save(
      guildId: string,
      token: string,
      settings: GatewayAiSettings
    ): Promise<void> {
      await repository.upsert({
        guildId,
        encryptedToken: encryptBotToken(token),
        aiEnabled: settings.enabled,
        channels: settings.channels,
        systemPrompt: settings.systemPrompt,
      });
    },

    async get(guildId: string): Promise<SavedGatewaySession | null> {
      const record = await repository.get(guildId);
      return record ? decodeRecord(record) : null;
    },

    async list(): Promise<{
      sessions: SavedGatewaySession[];
      failures: Array<{ guildId: string; code: GatewayTokenCryptoErrorCode }>;
    }> {
      const records = await repository.list();
      const sessions: SavedGatewaySession[] = [];
      const failures: Array<{ guildId: string; code: GatewayTokenCryptoErrorCode }> = [];

      for (const record of records) {
        try {
          sessions.push(decodeRecord(record));
        } catch (error) {
          failures.push({
            guildId: record.guildId,
            code: error instanceof GatewayTokenCryptoError ? error.code : "token_unreadable",
          });
        }
      }

      return { sessions, failures };
    },

    async delete(guildId: string): Promise<void> {
      await repository.delete(guildId);
    },
  };
}

export type GatewayRestoreEvent =
  | { state: "restoring" }
  | { state: "connected" }
  | { state: "failed"; message: string };

export function safeGatewayRestoreFailure(error: unknown): string {
  if (error instanceof GatewayTokenCryptoError) {
    if (error.code === "key_missing") {
      return "تعذّر فك تشفير رمز البوت. تحقّق من إعداد SESSION_SECRET على الخادم.";
    }
    return "تعذّر فك تشفير الرمز المحفوظ. أعد إدخال رمز البوت ثم حاول مجددًا.";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/invalid.{0,20}token|token.{0,20}invalid|unauthorized|\b401\b/i.test(message)) {
    return "رفض ديسكورد رمز البوت المحفوظ. حدّث الرمز ثم أعد المحاولة.";
  }
  if (/econn|enotfound|timeout|network|websocket|socket|gateway|fetch failed/i.test(message)) {
    return "تعذّر الوصول إلى ديسكورد مؤقتًا. أعد المحاولة من اللوحة.";
  }
  return "فشلت استعادة اتصال البوت. أعد المحاولة من اللوحة أو راجع سجل الخادم.";
}

export async function restoreGatewaySessions<T extends { guildId: string }>(
  savedSessions: T[],
  connect: (session: T) => Promise<void>,
  report: (guildId: string, event: GatewayRestoreEvent) => void
): Promise<void> {
  for (const saved of savedSessions) {
    report(saved.guildId, { state: "restoring" });
    try {
      await connect(saved);
      report(saved.guildId, { state: "connected" });
    } catch (error) {
      report(saved.guildId, {
        state: "failed",
        message: safeGatewayRestoreFailure(error),
      });
    }
  }
}

export async function disconnectGatewaySession(options: {
  expectedToken: string;
  activeToken: string | null;
  loadSavedToken: () => Promise<string | null>;
  removeSavedSession: () => Promise<void>;
  destroyActiveSession: () => Promise<void>;
}): Promise<void> {
  const currentToken = options.activeToken ?? await options.loadSavedToken();
  if (currentToken && !tokensMatch(currentToken, options.expectedToken)) {
    throw new Error("Invalid bot token");
  }

  await options.removeSavedSession();
  if (options.activeToken) await options.destroyActiveSession();
}
