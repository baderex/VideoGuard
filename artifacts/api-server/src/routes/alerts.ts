import { Router, type IRouter } from "express";
import { db, alertsTable, camerasTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/alerts", async (req, res) => {
  const cameraId = req.query.cameraId ? parseInt(req.query.cameraId as string) : undefined;
  const status = req.query.status as string | undefined;
  const limit = parseInt((req.query.limit as string) ?? "50");
  const offset = parseInt((req.query.offset as string) ?? "0");

  const cameras = await db.select().from(camerasTable);
  const cameraMap = Object.fromEntries(cameras.map((c) => [c.id, c.name]));

  const conditions: ReturnType<typeof eq>[] = [];
  if (cameraId) conditions.push(eq(alertsTable.cameraId, cameraId));
  if (status) conditions.push(eq(alertsTable.status, status as "open" | "acknowledged" | "resolved"));

  const [alerts, countRows] = await Promise.all([
    db
      .select()
      .from(alertsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alertsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(alertsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  res.json({
    alerts: alerts.map((a) => ({
      ...a,
      cameraName: cameraMap[a.cameraId] ?? `Camera ${a.cameraId}`,
      missingPpe: a.missingPpe ?? [],
    })),
    total: countRows[0]?.count ?? 0,
    offset,
    limit,
  });
});

router.post("/alerts/:alertId/acknowledge", async (req, res) => {
  const alertId = parseInt(req.params.alertId);
  const [alert] = await db
    .update(alertsTable)
    .set({ status: "acknowledged", acknowledgedAt: new Date() })
    .where(eq(alertsTable.id, alertId))
    .returning();
  if (!alert) return res.status(404).json({ error: "Not found" });
  const cameras = await db.select().from(camerasTable).where(eq(camerasTable.id, alert.cameraId));
  res.json({ ...alert, cameraName: cameras[0]?.name ?? `Camera ${alert.cameraId}`, missingPpe: alert.missingPpe ?? [] });
});

router.post("/alerts/:alertId/resolve", async (req, res) => {
  const alertId = parseInt(req.params.alertId);
  const [alert] = await db
    .update(alertsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(alertsTable.id, alertId))
    .returning();
  if (!alert) return res.status(404).json({ error: "Not found" });
  const cameras = await db.select().from(camerasTable).where(eq(camerasTable.id, alert.cameraId));
  res.json({ ...alert, cameraName: cameras[0]?.name ?? `Camera ${alert.cameraId}`, missingPpe: alert.missingPpe ?? [] });
});

export default router;
