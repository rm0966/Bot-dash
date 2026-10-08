import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  createGatewaySessionStore,
  disconnectGatewaySession,
  GatewayTokenCryptoError,
  restoreGatewaySessions,
  type GatewaySessionRecord,
  type GatewaySessionRepository,
} from "../src/lib/gateway-session-domain.ts";

const previousSecret = process.env.SESSION_SECRET;
const records = new Map<string, GatewaySessionRecord>();
const repository: GatewaySessionRepository = {
  async upsert(record) {
    records.set(record.guildId, structuredClone(record));
  },
  async get(guildId) {
    return structuredClone(records.get(guildId) ?? null);
  },
  async list() {
    return [...records.values()].map((record) => structuredClone(record));
  },
  async delete(guildId) {
    records.delete(guildId);
  },
};

before(() => {
  process.env.SESSION_SECRET = "test-only-session-key";
});

after(() => {
  records.clear();
  if (previousSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSecret;
});

test("stores encrypted tokens and reads the complete AI settings back", async () => {
  const store = createGatewaySessionStore(repository);
  const settings = {
    enabled: true,
    channels: ["channel-a"],
    systemPrompt: "مساعد اختبار",
  };

  await store.save("guild-save", "fake-discord-token", settings);

  const stored = records.get("guild-save");
  assert.ok(stored);
  assert.notEqual(stored.encryptedToken, "fake-discord-token");
  assert.deepEqual(await store.get("guild-save"), {
    guildId: "guild-save",
    token: "fake-discord-token",
    ...settings,
  });
});

test("reports corrupted encrypted credentials without blocking other saved sessions", async () => {
  const store = createGatewaySessionStore(repository);
  await store.save("guild-corrupt", "fake-token-one", {
    enabled: true,
    channels: [],
    systemPrompt: "one",
  });
  await store.save("guild-valid", "fake-token-two", {
    enabled: false,
    channels: ["channel-b"],
    systemPrompt: "two",
  });
  records.set("guild-corrupt", {
    ...records.get("guild-corrupt")!,
    encryptedToken: "v1.corrupt.tag.ciphertext",
  });

  const result = await store.list();
  assert.deepEqual(result.sessions.map((session) => session.guildId), ["guild-valid"]);
  assert.deepEqual(result.failures, [
    { guildId: "guild-corrupt", code: "token_unreadable" },
  ]);
});

test("deletes a saved session after validating its token", async () => {
  const store = createGatewaySessionStore(repository);
  await store.save("guild-delete", "fake-token", {
    enabled: false,
    channels: [],
    systemPrompt: "prompt",
  });

  await disconnectGatewaySession({
    expectedToken: "fake-token",
    activeToken: null,
    loadSavedToken: async () => (await store.get("guild-delete"))?.token ?? null,
    removeSavedSession: () => store.delete("guild-delete"),
    destroyActiveSession: async () => assert.fail("No active gateway session expected"),
  });

  assert.equal(records.has("guild-delete"), false);
});

test("does not delete or disconnect when the supplied token is wrong", async () => {
  let removed = false;
  let destroyed = false;

  await assert.rejects(
    disconnectGatewaySession({
      expectedToken: "wrong-token",
      activeToken: "real-token",
      loadSavedToken: async () => null,
      removeSavedSession: async () => { removed = true; },
      destroyActiveSession: async () => { destroyed = true; },
    }),
    /Invalid bot token/
  );

  assert.equal(removed, false);
  assert.equal(destroyed, false);
});

test("continues restoring other guilds after one Discord login fails", async () => {
  const attempts: string[] = [];
  const events: Array<{ guildId: string; state: string; message?: string }> = [];

  await restoreGatewaySessions(
    [{ guildId: "guild-bad" }, { guildId: "guild-good" }],
    async ({ guildId }) => {
      attempts.push(guildId);
      if (guildId === "guild-bad") throw new Error("401 invalid token");
    },
    (guildId, event) => events.push({ guildId, ...event })
  );

  assert.deepEqual(attempts, ["guild-bad", "guild-good"]);
  assert.deepEqual(events.map(({ guildId, state }) => [guildId, state]), [
    ["guild-bad", "restoring"],
    ["guild-bad", "failed"],
    ["guild-good", "restoring"],
    ["guild-good", "connected"],
  ]);
  assert.match(events[1]?.message ?? "", /رفض ديسكورد/);
});

test("fails explicitly if token encryption has no server secret", async () => {
  const store = createGatewaySessionStore(repository);
  delete process.env.SESSION_SECRET;

  await assert.rejects(
    store.save("guild-no-key", "fake-token", {
      enabled: false,
      channels: [],
      systemPrompt: "prompt",
    }),
    (error: unknown) => error instanceof GatewayTokenCryptoError && error.code === "key_missing"
  );

  process.env.SESSION_SECRET = "test-only-session-key";
});
