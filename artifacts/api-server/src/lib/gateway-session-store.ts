import { eq } from "drizzle-orm";
import { db, gatewaySessionsTable } from "@workspace/db";
import { logger } from "./logger";
import {
  createGatewaySessionStore,
  type GatewaySessionRecord,
  type GatewaySessionRepository,
} from "./gateway-session-domain";

const repository: GatewaySessionRepository = {
  async upsert(record) {
    await db
      .insert(gatewaySessionsTable)
      .values(record)
      .onConflictDoUpdate({
        target: gatewaySessionsTable.guildId,
        set: {
          encryptedToken: record.encryptedToken,
          aiEnabled: record.aiEnabled,
          channels: record.channels,
          systemPrompt: record.systemPrompt,
          updatedAt: new Date(),
        },
      });
  },

  async get(guildId) {
    const [record] = await db
      .select({
        guildId: gatewaySessionsTable.guildId,
        encryptedToken: gatewaySessionsTable.encryptedToken,
        aiEnabled: gatewaySessionsTable.aiEnabled,
        channels: gatewaySessionsTable.channels,
        systemPrompt: gatewaySessionsTable.systemPrompt,
      })
      .from(gatewaySessionsTable)
      .where(eq(gatewaySessionsTable.guildId, guildId));
    return record ?? null;
  },

  async list() {
    return db
      .select({
        guildId: gatewaySessionsTable.guildId,
        encryptedToken: gatewaySessionsTable.encryptedToken,
        aiEnabled: gatewaySessionsTable.aiEnabled,
        channels: gatewaySessionsTable.channels,
        systemPrompt: gatewaySessionsTable.systemPrompt,
      })
      .from(gatewaySessionsTable);
  },

  async delete(guildId) {
    await db.delete(gatewaySessionsTable).where(eq(gatewaySessionsTable.guildId, guildId));
  },
};

const store = createGatewaySessionStore(repository);

export const saveGatewaySession = store.save;
export const getSavedGatewaySession = store.get;
export const deleteSavedGatewaySession = store.delete;

export async function listSavedGatewaySessions() {
  const result = await store.list();
  for (const failure of result.failures) {
    logger.error(
      { guildId: failure.guildId, failureCode: failure.code },
      "Could not decrypt a saved Discord bot token"
    );
  }
  return result;
}

export type { GatewayAiSettings, SavedGatewaySession } from "./gateway-session-domain";
export type SavedGatewaySessionsResult = Awaited<ReturnType<typeof store.list>>;
export type { GatewaySessionRecord };
