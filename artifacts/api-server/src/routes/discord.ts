import { Router } from "express";
import { db, warningsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

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

export default router;
