import { Router, type IRouter } from "express";
import { db, camerasTable, analyticsTable, alertsTable } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { generateDetectionSnapshot } from "../lib/simulation.js";

const router: IRouter = Router();

router.get("/cameras", async (_req, res) => {
  const cameras = await db.select().from(camerasTable).orderBy(camerasTable.id);
  res.json(cameras.map((c) => ({ ...c, ppeRequirements: c.ppeRequirements ?? [] })));
});

router.post("/cameras", async (req, res) => {
  const { name, location, streamUrl, ppeRequirements } = req.body as {
    name: string;
    location: string;
    streamUrl?: string;
    ppeRequirements: string[];
  };
  const [camera] = await db
    .insert(camerasTable)
    .values({ name, location, streamUrl, ppeRequirements: ppeRequirements ?? [] })
    .returning();
  res.status(201).json({ ...camera, ppeRequirements: camera.ppeRequirements ?? [] });
});

router.get("/cameras/:cameraId", async (req, res) => {
  const cameraId = parseInt(req.params.cameraId);
  const [camera] = await db.select().from(camerasTable).where(eq(camerasTable.id, cameraId));
  if (!camera) return res.status(404).json({ error: "Not found" });
  res.json({ ...camera, ppeRequirements: camera.ppeRequirements ?? [] });
});

router.patch("/cameras/:cameraId", async (req, res) => {
  const cameraId = parseInt(req.params.cameraId);
  const updates = req.body as Partial<{
    name: string;
    location: string;
    status: "active" | "inactive" | "error";
    streamUrl: string;
    ppeRequirements: string[];
  }>;
  const [camera] = await db
    .update(camerasTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(camerasTable.id, cameraId))
    .returning();
  if (!camera) return res.status(404).json({ error: "Not found" });
  res.json({ ...camera, ppeRequirements: camera.ppeRequirements ?? [] });
});

router.delete("/cameras/:cameraId", async (req, res) => {
  const cameraId = parseInt(req.params.cameraId);
  await db.delete(camerasTable).where(eq(camerasTable.id, cameraId));
  res.status(204).send();
});

router.get("/cameras/:cameraId/snapshot", async (req, res) => {
  const cameraId = parseInt(req.params.cameraId);
  const [camera] = await db.select().from(camerasTable).where(eq(camerasTable.id, cameraId));
  if (!camera) return res.status(404).json({ error: "Not found" });
  const snapshot = generateDetectionSnapshot(camera);
  res.json(snapshot);
});

export default router;
