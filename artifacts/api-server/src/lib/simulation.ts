import type { Camera } from "@workspace/db";

const PPE_ITEMS = [
  "hard_hat",
  "safety_vest",
  "gloves",
  "safety_glasses",
  "face_mask",
  "safety_boots",
] as const;

type PpeItem = typeof PPE_ITEMS[number];

export interface DetectedPerson {
  id: string;
  confidence: number;
  ppe: Record<PpeItem, boolean>;
  compliant: boolean;
  missingPpe: string[];
}

export interface DetectionSnapshot {
  cameraId: number;
  timestamp: string;
  personCount: number;
  compliantCount: number;
  nonCompliantCount: number;
  complianceRate: number;
  detectedPersons: DetectedPerson[];
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateDetectionSnapshot(camera: Camera): DetectionSnapshot {
  const now = Date.now();
  const seed = (camera.id * 1000 + Math.floor(now / 5000)) % 1000000;

  if (camera.status !== "active") {
    return {
      cameraId: camera.id,
      timestamp: new Date().toISOString(),
      personCount: 0,
      compliantCount: 0,
      nonCompliantCount: 0,
      complianceRate: 0,
      detectedPersons: [],
    };
  }

  const r = (s: number) => seededRandom(seed + s);
  const personCount = Math.floor(r(1) * 6) + 1;
  const requirements = (camera.ppeRequirements ?? []) as string[];

  const detectedPersons: DetectedPerson[] = Array.from({ length: personCount }, (_, i) => {
    const personSeed = seed + i * 100;
    const ppe: Record<PpeItem, boolean> = {
      hard_hat: seededRandom(personSeed + 1) > 0.2,
      safety_vest: seededRandom(personSeed + 2) > 0.15,
      gloves: seededRandom(personSeed + 3) > 0.25,
      safety_glasses: seededRandom(personSeed + 4) > 0.3,
      face_mask: seededRandom(personSeed + 5) > 0.35,
      safety_boots: seededRandom(personSeed + 6) > 0.1,
    };

    const missingPpe = requirements.filter((req) => !ppe[req as PpeItem]);
    const compliant = missingPpe.length === 0;

    return {
      id: `person-${camera.id}-${i + 1}`,
      confidence: 0.75 + seededRandom(personSeed + 7) * 0.24,
      ppe,
      compliant,
      missingPpe,
    };
  });

  const compliantCount = detectedPersons.filter((p) => p.compliant).length;
  const nonCompliantCount = personCount - compliantCount;
  const complianceRate = personCount > 0 ? (compliantCount / personCount) * 100 : 100;

  return {
    cameraId: camera.id,
    timestamp: new Date().toISOString(),
    personCount,
    compliantCount,
    nonCompliantCount,
    complianceRate: Math.round(complianceRate * 10) / 10,
    detectedPersons,
  };
}
