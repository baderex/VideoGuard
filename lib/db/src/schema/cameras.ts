import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cameraStatusEnum = pgEnum("camera_status", [
  "active",
  "inactive",
  "error",
]);

export const ppeTypeEnum = pgEnum("ppe_type", [
  "hard_hat",
  "safety_vest",
  "gloves",
  "safety_glasses",
  "face_mask",
  "safety_boots",
]);

export const camerasTable = pgTable("cameras", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  status: cameraStatusEnum("status").notNull().default("active"),
  streamUrl: text("stream_url"),
  ppeRequirements: text("ppe_requirements").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCameraSchema = createInsertSchema(camerasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCamera = z.infer<typeof insertCameraSchema>;
export type Camera = typeof camerasTable.$inferSelect;
