import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { camerasTable } from "./cameras";

export const alertTypeEnum = pgEnum("alert_type", [
  "missing_ppe",
  "camera_offline",
  "low_compliance",
]);
export const alertSeverityEnum = pgEnum("alert_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const alertStatusEnum = pgEnum("alert_status", [
  "open",
  "acknowledged",
  "resolved",
]);

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  cameraId: integer("camera_id")
    .notNull()
    .references(() => camerasTable.id, { onDelete: "cascade" }),
  type: alertTypeEnum("type").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  message: text("message").notNull(),
  missingPpe: text("missing_ppe").array().notNull().default([]),
  status: alertStatusEnum("status").notNull().default("open"),
  personCount: integer("person_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
