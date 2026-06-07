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

router.get("/discord/guilds/:guildId/overview", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) return res.status(401).json({ error: "Missing X-Bot-Token header" });
  const r = await discordRequest(`/guilds/${guildId}?with_counts=true`, token);
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to fetch guild info") });
  }
  const g = await r.json() as Record<string, unknown>;
  return res.json({
    id: g.id,
    name: g.name,
    icon: g.icon ?? null,
    description: g.description ?? null,
    memberCount: (g.approximate_member_count as number) ?? 0,
    channelCount: 0,
    roleCount: Array.isArray(g.roles) ? g.roles.length : 0,
    emojiCount: Array.isArray(g.emojis) ? g.emojis.length : 0,
    boostLevel: (g.premium_tier as number) ?? 0,
    boostCount: (g.premium_subscription_count as number) ?? 0,
    ownerId: g.owner_id,
    createdAt: new Date(Number(BigInt(g.id as string) >> 22n) + 1420070400000).toISOString(),
  });
});

router.get("/discord/guilds/:guildId/emojis", async (req, res) => {
  const token = req.headers["x-bot-token"] as string;
  const { guildId } = req.params;
  if (!token) return res.status(401).json({ error: "Missing X-Bot-Token header" });
  const r = await discordRequest(`/guilds/${guildId}/emojis`, token);
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to fetch emojis") });
  }
  const emojis = await r.json() as Array<Record<string, unknown>>;
  return res.json(emojis.map(e => ({
    id: e.id,
    name: e.name,
    animated: e.animated ?? false,
    managed: e.managed ?? false,
    url: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}`,
  })));
});

router.post("/discord/guilds/:guildId/members/:userId/nickname", async (req, res) => {
  const { token, nickname } = req.body;
  const { guildId, userId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const r = await discordRequest(`/guilds/${guildId}/members/${userId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ nick: nickname ?? null }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    const msg = String(err.message ?? "Failed to change nickname");
    if (r.status === 403) return res.status(400).json({ error: `Permission denied: ${msg}. Make sure the bot has 'Manage Nicknames' permission and the member is not the server owner.` });
    return res.status(400).json({ error: msg });
  }
  return res.json({ success: true, message: nickname ? `Nickname changed to "${nickname}"` : "Nickname cleared" });
});

router.post("/discord/guilds/:guildId/send-dm", async (req, res) => {
  const { token, userId, content } = req.body;
  const { guildId } = req.params;
  if (!token || !userId || !content) return res.status(400).json({ error: "token, userId, and content are required" });
  const dmChan = await discordRequest("/users/@me/channels", token, {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!dmChan.ok) {
    const err = await dmChan.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to open DM channel. The user may have DMs disabled.") });
  }
  const chan = await dmChan.json() as Record<string, unknown>;
  const sendRes = await discordRequest(`/channels/${chan.id}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  if (!sendRes.ok) {
    const err = await sendRes.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to send DM") });
  }
  return res.json({ success: true, message: "Direct message sent successfully" });
});

router.post("/discord/guilds/:guildId/channels/:channelId/invite", async (req, res) => {
  const { token, maxAge, maxUses } = req.body;
  const { channelId } = req.params;
  if (!token) return res.status(400).json({ error: "token is required" });
  const r = await discordRequest(`/channels/${channelId}/invites`, token, {
    method: "POST",
    body: JSON.stringify({ max_age: maxAge ?? 86400, max_uses: maxUses ?? 0, temporary: false }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to create invite") });
  }
  const invite = await r.json() as Record<string, unknown>;
  const expiresAt = invite.expires_at ? new Date(invite.expires_at as string).toISOString() : null;
  return res.json({
    success: true,
    code: invite.code,
    url: `https://discord.gg/${invite.code}`,
    expiresAt,
  });
});

router.post("/discord/channels/:channelId/purge", async (req, res) => {
  const { token, count } = req.body;
  const { channelId } = req.params;
  if (!token || !count) return res.status(400).json({ error: "token and count are required" });
  const limit = Math.min(Math.max(1, Number(count)), 100);
  const msgsRes = await discordRequest(`/channels/${channelId}/messages?limit=${limit}`, token);
  if (!msgsRes.ok) {
    const err = await msgsRes.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(400).json({ error: String(err.message ?? "Failed to fetch messages") });
  }
  const msgs = await msgsRes.json() as Array<Record<string, unknown>>;
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const validIds = msgs
    .filter(m => {
      const ts = Number(BigInt(m.id as string) >> 22n) + 1420070400000;
      return ts > twoWeeksAgo;
    })
    .map(m => m.id as string);
  if (validIds.length === 0) return res.status(400).json({ error: "No messages found within the last 14 days to delete" });
  if (validIds.length === 1) {
    const delRes = await discordRequest(`/channels/${channelId}/messages/${validIds[0]}`, token, { method: "DELETE" });
    if (!delRes.ok) return res.status(400).json({ error: "Failed to delete message" });
  } else {
    const bulkRes = await discordRequest(`/channels/${channelId}/messages/bulk-delete`, token, {
      method: "POST",
      body: JSON.stringify({ messages: validIds }),
    });
    if (!bulkRes.ok) {
      const err = await bulkRes.json().catch(() => ({})) as Record<string, unknown>;
      return res.status(400).json({ error: String(err.message ?? "Failed to bulk delete messages") });
    }
  }
  return res.json({ success: true, message: `Deleted ${validIds.length} message(s) successfully` });
});

export default router;

