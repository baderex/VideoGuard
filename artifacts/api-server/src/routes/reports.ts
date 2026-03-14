import { Router, type IRouter } from "express";
import { db, analyticsTable, alertsTable, camerasTable } from "@workspace/db";
import { and, gte, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reports/daily", async (req, res) => {
  const dateStr = req.query.date as string | undefined;
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

  const cameras = await db.select().from(camerasTable);
  const cameraMap = Object.fromEntries(cameras.map((c) => [c.id, c.name]));

  const hourExpr = sql`date_trunc('hour', ${analyticsTable.recordedAt})`;

  const rows = await db
    .select({
      timestamp: hourExpr.as("ts"),
      cameraId: analyticsTable.cameraId,
      personCount: sql<number>`sum(${analyticsTable.personCount})::int`,
      compliantCount: sql<number>`sum(${analyticsTable.compliantCount})::int`,
      nonCompliantCount: sql<number>`sum(${analyticsTable.nonCompliantCount})::int`,
      complianceRate: sql<number>`round(avg(${analyticsTable.complianceRate})::numeric, 1)`,
    })
    .from(analyticsTable)
    .where(and(gte(analyticsTable.recordedAt, targetDate), lte(analyticsTable.recordedAt, nextDay)))
    .groupBy(hourExpr, analyticsTable.cameraId)
    .orderBy(hourExpr);

  const alertCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alertsTable)
    .where(and(gte(alertsTable.createdAt, targetDate), lte(alertsTable.createdAt, nextDay)));

  const totalPersonDetections = rows.reduce((s, r) => s + (r.personCount ?? 0), 0);
  const totalNonCompliant = rows.reduce((s, r) => s + (r.nonCompliantCount ?? 0), 0);
  const avgCompliance =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.complianceRate ?? 0), 0) / rows.length
      : 100;

  const hourlyTotals: Record<string, { personCount: number; hour: string }> = {};
  rows.forEach((r) => {
    const h = String(r.timestamp);
    if (!hourlyTotals[h]) hourlyTotals[h] = { personCount: 0, hour: h };
    hourlyTotals[h].personCount += r.personCount ?? 0;
  });
  const peakEntry = Object.values(hourlyTotals).sort((a, b) => b.personCount - a.personCount)[0];

  const violationsData = await db
    .select({
      hard_hat: sql<number>`sum(${analyticsTable.missingHardHat})::int`,
      safety_vest: sql<number>`sum(${analyticsTable.missingSafetyVest})::int`,
      gloves: sql<number>`sum(${analyticsTable.missingGloves})::int`,
      safety_glasses: sql<number>`sum(${analyticsTable.missingSafetyGlasses})::int`,
      face_mask: sql<number>`sum(${analyticsTable.missingFaceMask})::int`,
      safety_boots: sql<number>`sum(${analyticsTable.missingSafetyBoots})::int`,
    })
    .from(analyticsTable)
    .where(and(gte(analyticsTable.recordedAt, targetDate), lte(analyticsTable.recordedAt, nextDay)));

  const v = violationsData[0] ?? {};
  const topViolations = [
    { ppe: "hard_hat", count: v.hard_hat ?? 0 },
    { ppe: "safety_vest", count: v.safety_vest ?? 0 },
    { ppe: "gloves", count: v.gloves ?? 0 },
    { ppe: "safety_glasses", count: v.safety_glasses ?? 0 },
    { ppe: "face_mask", count: v.face_mask ?? 0 },
    { ppe: "safety_boots", count: v.safety_boots ?? 0 },
  ]
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  res.json({
    date: targetDate.toISOString().split("T")[0],
    totalPersonDetections,
    uniqueViolations: totalNonCompliant,
    averageComplianceRate: Math.round(avgCompliance * 10) / 10,
    peakHour: peakEntry?.hour ?? null,
    peakPersonCount: peakEntry?.personCount ?? 0,
    alerts: alertCount[0]?.count ?? 0,
    hourlyData: rows,
    topViolations,
  });
});

export default router;
