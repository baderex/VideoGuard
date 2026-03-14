import { db, camerasTable, analyticsTable, alertsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function autoSeedIfEmpty() {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(camerasTable);
  if ((rows[0]?.count ?? 0) > 0) return;

  console.log("[seed] No cameras found — seeding initial data...");

  const cameras = await db
    .insert(camerasTable)
    .values([
      { name: "Main Entrance", location: "Building A - Gate 1", status: "active", streamUrl: "rtsp://example.com/stream/cam1", ppeRequirements: ["hard_hat", "safety_vest", "safety_boots"] },
      { name: "Production Floor", location: "Building B - Section 2", status: "active", streamUrl: "rtsp://example.com/stream/cam2", ppeRequirements: ["hard_hat", "safety_vest", "gloves", "safety_glasses"] },
      { name: "Warehouse Zone A", location: "Warehouse - North Wing", status: "active", streamUrl: "rtsp://example.com/stream/cam3", ppeRequirements: ["hard_hat", "safety_vest", "safety_boots"] },
      { name: "Chemical Lab", location: "Lab Building - Floor 1", status: "active", streamUrl: "rtsp://example.com/stream/cam4", ppeRequirements: ["hard_hat", "safety_vest", "gloves", "safety_glasses", "face_mask"] },
      { name: "Outdoor Loading Dock", location: "East Yard - Dock 3", status: "inactive", streamUrl: "rtsp://example.com/stream/cam5", ppeRequirements: ["hard_hat", "safety_vest"] },
      { name: "Assembly Line B", location: "Building C - Line 2", status: "error", streamUrl: "rtsp://example.com/stream/cam6", ppeRequirements: ["hard_hat", "safety_vest", "gloves"] },
    ])
    .returning();

  // Seed 24 hours of historical analytics
  const now = new Date();
  const analyticsRows = [];
  for (let h = 23; h >= 0; h--) {
    const ts = new Date(now.getTime() - h * 60 * 60 * 1000);
    for (const cam of cameras.filter((c) => c.status === "active")) {
      const personCount = Math.floor(Math.random() * 8) + 1;
      const compliantCount = Math.floor(personCount * (0.6 + Math.random() * 0.4));
      const nonCompliantCount = personCount - compliantCount;
      analyticsRows.push({
        cameraId: cam.id,
        personCount,
        compliantCount,
        nonCompliantCount,
        complianceRate: Math.round((compliantCount / personCount) * 1000) / 10,
        missingHardHat: Math.floor(Math.random() * 2),
        missingSafetyVest: Math.floor(Math.random() * 2),
        missingGloves: Math.floor(Math.random() * 2),
        missingSafetyGlasses: Math.floor(Math.random() * 2),
        missingFaceMask: Math.floor(Math.random() * 2),
        missingSafetyBoots: Math.floor(Math.random() * 2),
        recordedAt: ts,
      });
    }
  }
  await db.insert(analyticsTable).values(analyticsRows);

  // Seed alerts
  await db.insert(alertsTable).values([
    { cameraId: cameras[0].id, type: "missing_ppe", severity: "high", message: "2 workers detected without hard hats at Main Entrance", missingPpe: ["hard_hat"], status: "open", personCount: 2, createdAt: new Date(now.getTime() - 5 * 60 * 1000) },
    { cameraId: cameras[1].id, type: "missing_ppe", severity: "critical", message: "Worker missing safety gloves and glasses on Production Floor", missingPpe: ["gloves", "safety_glasses"], status: "open", personCount: 1, createdAt: new Date(now.getTime() - 12 * 60 * 1000) },
    { cameraId: cameras[2].id, type: "low_compliance", severity: "medium", message: "Compliance rate dropped below 70% in Warehouse Zone A", missingPpe: [], status: "acknowledged", personCount: 5, createdAt: new Date(now.getTime() - 30 * 60 * 1000), acknowledgedAt: new Date(now.getTime() - 20 * 60 * 1000) },
    { cameraId: cameras[5].id, type: "camera_offline", severity: "high", message: "Camera Assembly Line B is offline — no feed available", missingPpe: [], status: "open", personCount: 0, createdAt: new Date(now.getTime() - 45 * 60 * 1000) },
    { cameraId: cameras[3].id, type: "missing_ppe", severity: "critical", message: "Multiple workers missing face masks in Chemical Lab", missingPpe: ["face_mask"], status: "resolved", personCount: 3, createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), resolvedAt: new Date(now.getTime() - 90 * 60 * 1000) },
  ]);

  console.log(`[seed] Done — seeded ${cameras.length} cameras, ${analyticsRows.length} analytics records, 5 alerts.`);
}
