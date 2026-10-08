import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const guildFeatureSettingsTable = pgTable("guild_feature_settings", {
  guildId: text("guild_id").primaryKey(),

  welcomeEnabled: boolean("welcome_enabled").notNull().default(false),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message")
    .notNull()
    .default("أهلًا {user} بك في {server}!"),
  leaveEnabled: boolean("leave_enabled").notNull().default(false),
  leaveChannelId: text("leave_channel_id"),
  leaveMessage: text("leave_message")
    .notNull()
    .default("غادر {user} السيرفر."),

  spamEnabled: boolean("spam_enabled").notNull().default(false),
  spamMaxMessages: integer("spam_max_messages").notNull().default(5),
  spamWindowSeconds: integer("spam_window_seconds").notNull().default(6),
  spamDuplicateLimit: integer("spam_duplicate_limit").notNull().default(3),
  spamBlockInvites: boolean("spam_block_invites").notNull().default(true),
  spamBlockLinks: boolean("spam_block_links").notNull().default(false),
  spamTimeoutMinutes: integer("spam_timeout_minutes").notNull().default(10),

  ticketsEnabled: boolean("tickets_enabled").notNull().default(false),
  ticketPanelChannelId: text("ticket_panel_channel_id"),
  ticketCategoryId: text("ticket_category_id"),
  supportRoleId: text("support_role_id"),
  transcriptChannelId: text("transcript_channel_id"),
  ticketPanelMessageId: text("ticket_panel_message_id"),

  auditEnabled: boolean("audit_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const spamInfractionsTable = pgTable(
  "spam_infractions",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    strikeCount: integer("strike_count").notNull().default(0),
    lastViolationAt: timestamp("last_violation_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index("spam_infractions_last_violation_idx").on(table.lastViolationAt),
  ]
);

export const scheduledAnnouncementsTable = pgTable(
  "scheduled_announcements",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    content: text("content").notNull(),
    repeatType: text("repeat_type").$type<"once" | "daily" | "weekly">().notNull().default("once"),
    timeZone: text("time_zone").notNull().default("Asia/Riyadh"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scheduled_announcements_due_idx").on(table.isActive, table.nextRunAt),
    index("scheduled_announcements_guild_idx").on(table.guildId, table.createdAt),
  ]
);

export const ticketsTable = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull().unique(),
    openerId: text("opener_id").notNull(),
    openerName: text("opener_name").notNull(),
    status: text("status").$type<"open" | "closed">().notNull().default("open"),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("tickets_guild_status_idx").on(table.guildId, table.status, table.createdAt),
    index("tickets_opener_idx").on(table.guildId, table.openerId, table.status),
  ]
);

export const guildAuditLogsTable = pgTable(
  "guild_audit_logs",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    executorId: text("executor_id"),
    channelId: text("channel_id"),
    reason: text("reason"),
    details: text("details"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("guild_audit_logs_guild_time_idx").on(table.guildId, table.occurredAt),
  ]
);

export type GuildFeatureSettings = typeof guildFeatureSettingsTable.$inferSelect;
export type ScheduledAnnouncement = typeof scheduledAnnouncementsTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
export type GuildAuditLog = typeof guildAuditLogsTable.$inferSelect;
