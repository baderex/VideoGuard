import { db, camerasTable, analyticsTable, alertsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  await db.delete(alertsTable);
  await db.delete(analyticsTable);
  await db.delete(camerasTable);

  const cameras = await db
    .insert(camerasTable)
    .values([
      {
        name: "Main Entrance",
        location: "Building A - Gate 1",
        status: "active",
        streamUrl: "rtsp://example.com/stream/cam1",
        ppeRequirements: ["hard_hat", "safety_vest", "safety_boots"],
      },
      {
        name: "Production Floor",
        location: "Building B - Section 2",
        status: "active",
        streamUrl: "rtsp://example.com/stream/cam2",
        ppeRequirements: ["hard_hat", "safety_vest", "gloves", "safety_glasses"],
      },
      {
        name: "Warehouse Zone A",
        location: "Warehouse - North Wing",
        status: "active",
        streamUrl: "rtsp://example.com/stream/cam3",
        ppeRequirements: ["hard_hat", "safety_vest", "safety_boots"],
      },
      {
        name: "Chemical Lab",
        location: "Lab Building - Floor 1",
        status: "active",
        streamUrl: "rtsp://example.com/stream/cam4",
        ppeRequirements: ["hard_hat", "safety_vest", "gloves", "safety_glasses", "face_mask"],
      },
      {
        name: "Outdoor Loading Dock",
        location: "East Yard - Dock 3",
        status: "inactive",
        streamUrl: "rtsp://example.com/stream/cam5",
        ppeRequirements: ["hard_hat", "safety_vest"],
      },
      {
        name: "Assembly Line B",
        location: "Building C - Line 2",
        status: "error",
        streamUrl: "rtsp://example.com/stream/cam6",
        ppeRequirements: ["hard_hat", "safety_vest", "gloves"],
      },
    ])
    .returning();

  console.log(`Created ${cameras.length} cameras`);

  // Seed historical analytics for the last 24 hours
  const analyticsRows = [];
  const now = new Date();
  for (let h = 23; h >= 0; h--) {
    const ts = new Date(now.getTime() - h * 60 * 60 * 1000);
    for (const cam of cameras.filter((c) => c.status === "active")) {
      const personCount = Math.floor(Math.random() * 8) + 1;
      const compliantCount = Math.floor(personCount * (0.6 + Math.random() * 0.4));
      const nonCompliantCount = personCount - compliantCount;
      const complianceRate = Math.round((compliantCount / personCount) * 1000) / 10;
      analyticsRows.push({
        cameraId: cam.id,
        personCount,
        compliantCount,
        nonCompliantCount,
        complianceRate,
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
  console.log(`Created ${analyticsRows.length} analytics records`);

  // Seed alerts
  const alertData = [
    {
      cameraId: cameras[0].id,
      type: "missing_ppe" as const,
      severity: "high" as const,
      message: "2 workers detected without hard hats at Main Entrance",
      missingPpe: ["hard_hat"],
      status: "open" as const,
      personCount: 2,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000),
    },
    {
      cameraId: cameras[1].id,
      type: "missing_ppe" as const,
      severity: "critical" as const,
      message: "Worker missing safety gloves and glasses on Production Floor",
      missingPpe: ["gloves", "safety_glasses"],
      status: "open" as const,
      personCount: 1,
      createdAt: new Date(now.getTime() - 12 * 60 * 1000),
    },
    {
      cameraId: cameras[2].id,
      type: "low_compliance" as const,
      severity: "medium" as const,
      message: "Compliance rate dropped below 70% in Warehouse Zone A",
      missingPpe: [],
      status: "acknowledged" as const,
      personCount: 5,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      acknowledgedAt: new Date(now.getTime() - 20 * 60 * 1000),
    },
    {
      cameraId: cameras[5].id,
      type: "camera_offline" as const,
      severity: "high" as const,
      message: "Camera Assembly Line B is offline — no feed available",
      missingPpe: [],
      status: "open" as const,
      personCount: 0,
      createdAt: new Date(now.getTime() - 45 * 60 * 1000),
    },
    {
      cameraId: cameras[3].id,
      type: "missing_ppe" as const,
      severity: "critical" as const,
      message: "Multiple workers missing face masks in Chemical Lab",
      missingPpe: ["face_mask"],
      status: "resolved" as const,
      personCount: 3,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 1.5 * 60 * 60 * 1000),
    },
    {
      cameraId: cameras[0].id,
      type: "missing_ppe" as const,
      severity: "low" as const,
      message: "1 visitor without safety vest at Main Entrance",
      missingPpe: ["safety_vest"],
      status: "resolved" as const,
      personCount: 1,
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 2.5 * 60 * 60 * 1000),
    },
  ];

  await db.insert(alertsTable).values(alertData);
  console.log(`Created ${alertData.length} alerts`);
  console.log("Seeding complete!");
}

seed().catch(console.error);
