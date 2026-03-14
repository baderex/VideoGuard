import math
import time
from datetime import datetime, timezone
from typing import List, Dict, Any

PPE_ITEMS = [
    "hard_hat",
    "safety_vest",
    "gloves",
    "safety_glasses",
    "face_mask",
    "safety_boots",
]


def seeded_random(seed: int) -> float:
    x = math.sin(seed) * 10000
    return x - math.floor(x)


def generate_detection_snapshot(camera: Dict[str, Any]) -> Dict[str, Any]:
    now = int(time.time() * 1000)
    seed = (camera["id"] * 1000 + (now // 5000)) % 1000000

    if camera.get("status") != "active":
        return {
            "cameraId": camera["id"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "personCount": 0,
            "compliantCount": 0,
            "nonCompliantCount": 0,
            "complianceRate": 0,
            "detectedPersons": [],
        }

    def r(s: int) -> float:
        return seeded_random(seed + s)

    person_count = int(r(1) * 6) + 1
    requirements: List[str] = camera.get("ppe_requirements") or []

    detected_persons = []
    for i in range(person_count):
        person_seed = seed + i * 100
        ppe = {
            "hard_hat": seeded_random(person_seed + 1) > 0.2,
            "safety_vest": seeded_random(person_seed + 2) > 0.15,
            "gloves": seeded_random(person_seed + 3) > 0.25,
            "safety_glasses": seeded_random(person_seed + 4) > 0.3,
            "face_mask": seeded_random(person_seed + 5) > 0.35,
            "safety_boots": seeded_random(person_seed + 6) > 0.1,
        }

        missing_ppe = [req for req in requirements if not ppe.get(req, True)]
        compliant = len(missing_ppe) == 0

        detected_persons.append({
            "id": f"person-{camera['id']}-{i + 1}",
            "confidence": 0.75 + seeded_random(person_seed + 7) * 0.24,
            "ppe": ppe,
            "compliant": compliant,
            "missingPpe": missing_ppe,
        })

    compliant_count = sum(1 for p in detected_persons if p["compliant"])
    non_compliant_count = person_count - compliant_count
    compliance_rate = (compliant_count / person_count * 100) if person_count > 0 else 100

    return {
        "cameraId": camera["id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "personCount": person_count,
        "compliantCount": compliant_count,
        "nonCompliantCount": non_compliant_count,
        "complianceRate": round(compliance_rate * 10) / 10,
        "detectedPersons": detected_persons,
    }
