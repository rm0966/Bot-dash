import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const autoRepliesTable = pgTable("auto_replies", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  trigger: text("trigger").notNull(),
  response: text("response").notNull(),
  matchType: text("match_type").notNull().default("contains"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AutoReply = typeof autoRepliesTable.$inferSelect;
export type InsertAutoReply = typeof autoRepliesTable.$inferInsert;
