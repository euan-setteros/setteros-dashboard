import { pgTable, pgEnum, serial, integer, varchar, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const setterRoleEnum = pgEnum("lb_setter_role", ["setter", "manager", "admin"]);
export const adjustmentTypeEnum = pgEnum("lb_adjustment_type", ["weekly", "alltime"]);

/** Slack team members who post bells */
export const setters = pgTable("lb_setters", {
  id: serial("id").primaryKey(),
  slackUserId: varchar("slack_user_id", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  realName: varchar("real_name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  role: setterRoleEnum("role").default("setter").notNull(),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Setter = typeof setters.$inferSelect;
export type InsertSetter = typeof setters.$inferInsert;

/** Individual bell entries parsed from Slack messages */
export const bellEntries = pgTable("lb_bell_entries", {
  id: serial("id").primaryKey(),
  setterId: integer("setter_id").notNull(),
  slackMessageTs: varchar("slack_message_ts", { length: 64 }).notNull(),
  bellCount: integer("bell_count").default(1).notNull(),
  messageText: text("message_text"),
  /** UTC timestamp of the Slack message */
  messageDate: timestamp("message_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("lb_unique_message").on(table.slackMessageTs),
]);

export type BellEntry = typeof bellEntries.$inferSelect;
export type InsertBellEntry = typeof bellEntries.$inferInsert;

/** Manual adjustments made by admins to override bell counts */
export const manualAdjustments = pgTable("lb_manual_adjustments", {
  id: serial("id").primaryKey(),
  setterId: integer("setter_id").notNull(),
  adjustmentDate: timestamp("adjustment_date", { withTimezone: true }).notNull(),
  bellDelta: integer("bell_delta").notNull(),
  adjustmentType: adjustmentTypeEnum("adjustment_type").default("weekly").notNull(),
  reason: text("reason"),
  adjustedBy: varchar("adjusted_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ManualAdjustment = typeof manualAdjustments.$inferSelect;
export type InsertManualAdjustment = typeof manualAdjustments.$inferInsert;
