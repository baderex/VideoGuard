import { Router, type IRouter } from "express";
import { db, camerasTable, analyticsTable, alertsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { generateDetectionSnapshot } from "../lib/simulation.js";

const router: IRouter = Router();

router.get("/analytics/live", async (_req, res) => {
  const cameras = await db.select().from(camerasTable).orderBy(camerasTable.id);

  const snapshots = cameras.map((c) => generateDetectionSnapshot(c));
  const activeCameras = cameras.filter((c) => c.status === "active").length;
  const totalPersons = snapshots.reduce((s, snap) => s + snap.personCount, 0);
  const totalCompliant = snapshots.reduce((s, snap) => s + snap.compliantCount, 0);
  const totalNonCompliant = snapshots.reduce((s, snap) => s + snap.nonCompliantCount, 0);
  const overallComplianceRate =
    totalPersons > 0 ? Math.round((totalCompliant / totalPersons) * 1000) / 10 : 100;

  const openAlerts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alertsTable)
    .where(eq(alertsTable.status, "open"));

  res.json({
    timestamp: new Date().toISOString(),
    totalCameras: cameras.length,
    activeCameras,
    totalPersonsDetected: totalPersons,
    totalCompliant,
    totalNonCompliant,
    overallComplianceRate,
    openAlerts: openAlerts[0]?.count ?? 0,
    cameraSnapshots: snapshots,
  });
});

router.get("/analytics/history", async (req, res) => {
  const cameraId = req.query.cameraId ? parseInt(req.query.cameraId as string) : undefined;
  const intervalRaw = (req.query.interval as string) || "hour";
  const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();

  const truncUnit = intervalRaw === "minute" ? "minute" : intervalRaw === "day" ? "day" : "hour";

  const conditions: ReturnType<typeof eq>[] = [
    gte(analyticsTable.recordedAt, from),
    lte(analyticsTable.recordedAt, to),
  ];
  if (cameraId) conditions.push(eq(analyticsTable.cameraId, cameraId));

  const groupExpr =
    truncUnit === "minute"
      ? sql`date_trunc('minute', ${analyticsTable.recordedAt})`
      : truncUnit === "day"
        ? sql`date_trunc('day', ${analyticsTable.recordedAt})`
        : sql`date_trunc('hour', ${analyticsTable.recordedAt})`;

  const rows = await db
    .select({
      timestamp: groupExpr.as("ts"),
      cameraId: analyticsTable.cameraId,
      personCount: sql<number>`sum(${analyticsTable.personCount})::int`,
      compliantCount: sql<number>`sum(${analyticsTable.compliantCount})::int`,
      nonCompliantCount: sql<number>`sum(${analyticsTable.nonCompliantCount})::int`,
      complianceRate: sql<number>`round(avg(${analyticsTable.complianceRate})::numeric, 1)`,
    })
    .from(analyticsTable)
    .where(and(...conditions))
    .groupBy(groupExpr, analyticsTable.cameraId)
    .orderBy(groupExpr);

  res.json(rows);
});

router.get("/analytics/compliance-summary", async (req, res) => {
  const period = (req.query.period as string) || "today";
  const now = new Date();
  let from: Date;

  if (period === "week") {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  }

  const rows = await db
    .select({
      cameraId: analyticsTable.cameraId,
      detections: sql<number>`sum(${analyticsTable.personCount})::int`,
      compliant: sql<number>`sum(${analyticsTable.compliantCount})::int`,
      nonCompliant: sql<number>`sum(${analyticsTable.nonCompliantCount})::int`,
      complianceRate: sql<number>`round(avg(${analyticsTable.complianceRate})::numeric, 1)`,
      missingHardHat: sql<number>`sum(${analyticsTable.missingHardHat})::int`,
      missingSafetyVest: sql<number>`sum(${analyticsTable.missingSafetyVest})::int`,
      missingGloves: sql<number>`sum(${analyticsTable.missingGloves})::int`,
      missingSafetyGlasses: sql<number>`sum(${analyticsTable.missingSafetyGlasses})::int`,
      missingFaceMask: sql<number>`sum(${analyticsTable.missingFaceMask})::int`,
      missingSafetyBoots: sql<number>`sum(${analyticsTable.missingSafetyBoots})::int`,
    })
    .from(analyticsTable)
    .where(gte(analyticsTable.recordedAt, from))
    .groupBy(analyticsTable.cameraId);

  const cameras = await db.select().from(camerasTable);
  const cameraMap = Object.fromEntries(cameras.map((c) => [c.id, c.name]));

  const totalDetections = rows.reduce((s, r) => s + (r.detections ?? 0), 0);
  const totalCompliant = rows.reduce((s, r) => s + (r.compliant ?? 0), 0);
  const totalNonCompliant = rows.reduce((s, r) => s + (r.nonCompliant ?? 0), 0);
  const overallComplianceRate =
    totalDetections > 0 ? Math.round((totalCompliant / totalDetections) * 1000) / 10 : 100;

  res.json({
    period,
    totalDetections,
    totalCompliant,
    totalNonCompliant,
    overallComplianceRate,
    ppeMissingBreakdown: {
      hard_hat: rows.reduce((s, r) => s + (r.missingHardHat ?? 0), 0),
      safety_vest: rows.reduce((s, r) => s + (r.missingSafetyVest ?? 0), 0),
      gloves: rows.reduce((s, r) => s + (r.missingGloves ?? 0), 0),
      safety_glasses: rows.reduce((s, r) => s + (r.missingSafetyGlasses ?? 0), 0),
      face_mask: rows.reduce((s, r) => s + (r.missingFaceMask ?? 0), 0),
      safety_boots: rows.reduce((s, r) => s + (r.missingSafetyBoots ?? 0), 0),
    },
    cameraBreakdown: rows.map((r) => ({
      cameraId: r.cameraId,
      cameraName: cameraMap[r.cameraId] ?? `Camera ${r.cameraId}`,
      detections: r.detections ?? 0,
      complianceRate: r.complianceRate ?? 0,
    })),
  });
});

export default router;
