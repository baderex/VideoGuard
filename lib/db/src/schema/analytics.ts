import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { camerasTable } from "./cameras";

export const analyticsTable = pgTable("analytics", {
  id: serial("id").primaryKey(),
  cameraId: integer("camera_id")
    .notNull()
    .references(() => camerasTable.id, { onDelete: "cascade" }),
  personCount: integer("person_count").notNull().default(0),
  compliantCount: integer("compliant_count").notNull().default(0),
  nonCompliantCount: integer("non_compliant_count").notNull().default(0),
  complianceRate: real("compliance_rate").notNull().default(0),
  missingHardHat: integer("missing_hard_hat").notNull().default(0),
  missingSafetyVest: integer("missing_safety_vest").notNull().default(0),
  missingGloves: integer("missing_gloves").notNull().default(0),
  missingSafetyGlasses: integer("missing_safety_glasses").notNull().default(0),
  missingFaceMask: integer("missing_face_mask").notNull().default(0),
  missingSafetyBoots: integer("missing_safety_boots").notNull().default(0),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const insertAnalyticsSchema = createInsertSchema(analyticsTable).omit({
  id: true,
  recordedAt: true,
});
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type Analytics = typeof analyticsTable.$inferSelect;
