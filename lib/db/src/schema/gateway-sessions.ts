import { createInsertSchema } from "drizzle-zod";
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const gatewaySessionsTable = pgTable("gateway_sessions", {
  guildId: text("guild_id").primaryKey(),
  encryptedToken: text("encrypted_token").notNull(),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  channels: jsonb("channels").$type<string[]>().notNull().default([]),
  systemPrompt: text("system_prompt")
    .notNull()
    .default("أنت مساعد ذكي ومفيد في سيرفر ديسكورد. أجب بإيجاز وأدب."),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGatewaySessionSchema = createInsertSchema(gatewaySessionsTable).omit({
  updatedAt: true,
});
export type InsertGatewaySession = z.infer<typeof insertGatewaySessionSchema>;
export type GatewaySession = typeof gatewaySessionsTable.$inferSelect;
