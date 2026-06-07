import { Router } from "express";
import { db, warningsTable, autoRepliesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { activateGuild, deactivateGuild, isGuildActive } from "../lib/gateway-manager";

const router = Router();

const DISCORD_API = "https://discord.com/api/v10";

async function discordRequest(
  path: string,
  token: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

router.post("/discord/connect", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }
  const r = await discordRequest("/users/@me", token);
  if (!r.ok) {
    return res.status(401).json({ error: "Invalid bot token" });
  }
  const data = await r.json() as Record<string, unknown>;
  return res.json({
    id: data.id,
    username: data.username,
    discriminator: data.discriminator,
    avatar: data.avatar ?? null,
    verified: data.verified ?? false,
  });
});

router.get("/discord/guilds", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  if (!token) {
    return res.status(401).json({ error: "Missing X-Bot-Token header" });
  }
  const r = await discordRequest("/users/@me/guilds", token);
  if (!r.ok) {
    return res.status(401).json({ error: "Invalid token or failed to fetch guilds" });
  }
  const guilds = await r.json() as Array<Record<string, unknown>>;
  return res.json(
    guilds.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ?? null,
      memberCount: null,
    }))
  );
});

router.get("/discord/guilds/:guildId/channels", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) {
    return res.status(401).json({ error: "Missing X-Bot-Token header" });
  }
  const r = await discordRequest(`/guilds/${guildId}/channels`, token);
  if (!r.ok) {
    return res.status(400).json({ error: "Failed to fetch channels" });
  }
  const channels = await r.json() as Array<Record<string, unknown>>;
  return res.json(
    channels.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }))
  );
});

router.get("/discord/guilds/:guildId/members", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) {
    return res.status(401).json({ error: "Missing X-Bot-Token header" });
  }
  const r = await discordRequest(`/guilds/${guildId}/members?limit=100`, token);
  if (!r.ok) {
    return res.status(400).json({ error: "Failed to fetch members" });
  }
  const members = await r.json() as Array<Record<string, unknown>>;
  return res.json(
    members.map((m) => {
      const user = m.user as Record<string, unknown>;
      return {
        id: user?.id,
        username: user?.username,
        discriminator: user?.discriminator ?? "0",
        avatar: user?.avatar ?? null,
        nickname: m.nick ?? null,
        roles: m.roles ?? [],
      };
    })
  );
});

router.post("/discord/send-message", async (req, res) => {
  const { token, channelId, content } = req.body;
  if (!token || !channelId || !content) {
    return res.status(400).json({ error: "token, channelId, and content are required" });
  }
  const r = await discordRequest(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  if (!r.ok) {
    const err = await r.json() as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to send message") });
  }
  return res.json({ success: true, message: "Message sent successfully" });
});

router.post("/discord/send-image", async (req, res) => {
  const { token, channelId, imageUrl, caption } = req.body;
  if (!token || !channelId || !imageUrl) {
    return res.status(400).json({ error: "token, channelId, and imageUrl are required" });
  }
  const body: Record<string, unknown> = {
    embeds: [
      {
        image: { url: imageUrl },
        ...(caption ? { description: caption } : {}),
      },
    ],
  };
  const r = await discordRequest(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json() as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to send image") });
  }
  return res.json({ success: true, message: "Image sent successfully" });
});

router.post("/discord/guilds/:guildId/members/:userId/kick", async (req, res) => {
  const { token, reason } = req.body;
  const { guildId, userId } = req.params;
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }
  const r = await discordRequest(`/guilds/${guildId}/members/${userId}`, token, {
    method: "DELETE",
    headers: reason ? { "X-Audit-Log-Reason": reason } : {},
  });
  if (!r.ok && r.status !== 204) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to kick member") });
  }
  return res.json({ success: true, message: "Member kicked successfully" });
});

router.post("/discord/guilds/:guildId/members/:userId/ban", async (req, res) => {
  const { token, reason } = req.body;
  const { guildId, userId } = req.params;
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }
  const r = await discordRequest(`/guilds/${guildId}/bans/${userId}`, token, {
    method: "PUT",
    body: JSON.stringify({}),
    headers: reason ? { "X-Audit-Log-Reason": reason } : {},
  });
  if (!r.ok && r.status !== 204) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to ban member") });
  }
  return res.json({ success: true, message: "Member banned successfully" });
});

router.post("/discord/guilds/:guildId/members/:userId/mute", async (req, res) => {
  const { token, reason, durationMinutes } = req.body;
  const { guildId, userId } = req.params;
  if (!token || durationMinutes == null) {
    return res.status(400).json({ error: "token and durationMinutes are required" });
  }
  const until = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  const r = await discordRequest(`/guilds/${guildId}/members/${userId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ communication_disabled_until: until }),
    headers: reason ? { "X-Audit-Log-Reason": reason } : {},
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to mute member") });
  }
  return res.json({ success: true, message: `Member muted for ${durationMinutes} minutes` });
});

router.post("/discord/guilds/:guildId/members/:userId/warn", async (req, res) => {
  const { token, reason } = req.body;
  const { guildId, userId } = req.params;
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }
  const warnReason = reason ?? "No reason provided";
  await db.insert(warningsTable).values({ guildId, userId, reason: warnReason });
  return res.json({ success: true, message: "Warning issued successfully" });
});

router.get("/discord/guilds/:guildId/members/:userId/warnings", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId, userId } = req.params;
  if (!token) {
    return res.status(401).json({ error: "Missing X-Bot-Token header" });
  }
  const warnings = await db
    .select()
    .from(warningsTable)
    .where(and(eq(warningsTable.guildId, guildId), eq(warningsTable.userId, userId)));
  return res.json(
    warnings.map((w) => ({
      id: w.id,
      guildId: w.guildId,
      userId: w.userId,
      reason: w.reason,
      createdAt: w.createdAt.toISOString(),
    }))
  );
});

router.get("/discord/guilds/:guildId/roles", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) return res.status(401).json({ error: "Missing X-Bot-Token header" });
  const r = await discordRequest(`/guilds/${guildId}/roles`, token);
  if (!r.ok) return res.status(400).json({ error: "Failed to fetch roles" });
  const roles = await r.json() as Array<Record<string, unknown>>;
  return res.json(
    roles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color ?? 0,
      position: role.position ?? 0,
      mentionable: role.mentionable ?? false,
      managed: role.managed ?? false,
    }))
  );
});

router.post("/discord/guilds/:guildId/roles", async (req, res) => {
  const { token, name, color, mentionable } = req.body;
  const { guildId } = req.params;
  if (!token || !name) return res.status(400).json({ error: "token and name are required" });
  const r = await discordRequest(`/guilds/${guildId}/roles`, token, {
    method: "POST",
    body: JSON.stringify({ name, color: color ?? 0, mentionable: mentionable ?? false }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to create role") });
  }
  return res.json({ success: true, message: `Role "${name}" created successfully` });
});

router.post("/discord/guilds/:guildId/roles/:roleId/delete", async (req, res) => {
  const { token } = req.body;
  const { guildId, roleId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const r = await discordRequest(`/guilds/${guildId}/roles/${roleId}`, token, { method: "DELETE" });
  if (!r.ok && r.status !== 204) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to delete role") });
  }
  return res.json({ success: true, message: "Role deleted successfully" });
});

router.post("/discord/guilds/:guildId/members/:userId/roles/:roleId/add", async (req, res) => {
  const { token } = req.body;
  const { guildId, userId, roleId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const r = await discordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, token, { method: "PUT" });
  if (!r.ok && r.status !== 204) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to add role") });
  }
  return res.json({ success: true, message: "Role added to member successfully" });
});

router.post("/discord/guilds/:guildId/members/:userId/roles/:roleId/remove", async (req, res) => {
  const { token } = req.body;
  const { guildId, userId, roleId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const r = await discordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, token, { method: "DELETE" });
  if (!r.ok && r.status !== 204) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to remove role") });
  }
  return res.json({ success: true, message: "Role removed from member successfully" });
});

router.get("/discord/guilds/:guildId/bans", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) return res.status(401).json({ error: "Missing X-Bot-Token header" });
  const r = await discordRequest(`/guilds/${guildId}/bans`, token);
  if (!r.ok) return res.status(400).json({ error: "Failed to fetch bans" });
  const bans = await r.json() as Array<Record<string, unknown>>;
  return res.json(
    bans.map((b) => {
      const user = b.user as Record<string, unknown>;
      return {
        userId: user?.id,
        username: user?.username,
        discriminator: user?.discriminator ?? "0",
        avatar: user?.avatar ?? null,
        reason: b.reason ?? null,
      };
    })
  );
});

router.post("/discord/guilds/:guildId/bans/:userId/remove", async (req, res) => {
  const { token } = req.body;
  const { guildId, userId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const r = await discordRequest(`/guilds/${guildId}/bans/${userId}`, token, { method: "DELETE" });
  if (!r.ok && r.status !== 204) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to unban member") });
  }
  return res.json({ success: true, message: "Member unbanned successfully" });
});

router.get("/discord/guilds/:guildId/auto-replies", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) return res.status(401).json({ error: "Missing X-Bot-Token header" });
  const rules = await db.select().from(autoRepliesTable).where(eq(autoRepliesTable.guildId, guildId));
  return res.json(rules.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/discord/guilds/:guildId/auto-replies", async (req, res) => {
  const { token, trigger, response, matchType } = req.body;
  const { guildId } = req.params;
  if (!token || !trigger || !response) return res.status(400).json({ error: "token, trigger, and response are required" });
  await db.insert(autoRepliesTable).values({
    guildId,
    trigger,
    response,
    matchType: matchType ?? "contains",
    isActive: true,
  });
  return res.json({ success: true, message: "Auto-reply rule created" });
});

router.get("/discord/guilds/:guildId/auto-replies/status", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) return res.status(401).json({ error: "Missing X-Bot-Token header" });
  return res.json({ active: isGuildActive(guildId), guildId });
});

router.post("/discord/guilds/:guildId/auto-replies/activate", async (req, res) => {
  const { token } = req.body;
  const { guildId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    await activateGuild(token, guildId);
    return res.json({ success: true, message: "Auto-reply listener activated" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to activate";
    return res.status(400).json({ error: msg });
  }
});

router.post("/discord/guilds/:guildId/auto-replies/deactivate", async (req, res) => {
  const { token } = req.body;
  const { guildId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  await deactivateGuild(guildId);
  return res.json({ success: true, message: "Auto-reply listener deactivated" });
});

router.post("/discord/guilds/:guildId/auto-replies/:ruleId/toggle", async (req, res) => {
  const { token } = req.body;
  const { guildId, ruleId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const [rule] = await db.select().from(autoRepliesTable).where(and(eq(autoRepliesTable.id, Number(ruleId)), eq(autoRepliesTable.guildId, guildId)));
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  await db.update(autoRepliesTable).set({ isActive: !rule.isActive }).where(eq(autoRepliesTable.id, Number(ruleId)));
  return res.json({ success: true, message: `Rule ${rule.isActive ? "disabled" : "enabled"}` });
});

router.post("/discord/guilds/:guildId/auto-replies/:ruleId/delete", async (req, res) => {
  const { token } = req.body;
  const { guildId, ruleId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  await db.delete(autoRepliesTable).where(and(eq(autoRepliesTable.id, Number(ruleId)), eq(autoRepliesTable.guildId, guildId)));
  return res.json({ success: true, message: "Rule deleted" });
});

router.post("/discord/guilds/:guildId/channels/create", async (req, res) => {
  const { token, name, type } = req.body;
  const { guildId } = req.params;
  if (!token || !name || type == null) return res.status(400).json({ error: "token, name, and type are required" });
  const r = await discordRequest(`/guilds/${guildId}/channels`, token, {
    method: "POST",
    body: JSON.stringify({ name, type }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to create channel") });
  }
  return res.json({ success: true, message: `Channel "${name}" created successfully` });
});

router.post("/discord/channels/:channelId/delete", async (req, res) => {
  const { token } = req.body;
  const { channelId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const r = await discordRequest(`/channels/${channelId}`, token, { method: "DELETE" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to delete channel") });
  }
  return res.json({ success: true, message: "Channel deleted successfully" });
});

export default router;

