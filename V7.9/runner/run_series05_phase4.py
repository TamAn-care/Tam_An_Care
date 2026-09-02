#!/usr/bin/env python3

from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
V79 = ROOT / "V7.9"

STATE_PATH = (
    V79
    / "state"
    / "series05_phase4_state.json"
)

ROADMAP_PATH = (
    V79
    / "preflight"
    / "V7.9-PHASE-4-UX-OPERATIONAL-SMOOTHNESS-ROADMAP.json"
)

AUTH_PATH = (
    V79
    / "manifests"
    / "V7.9-SERIES-05-PHASE-4-ROADMAP-RESOLUTION.json"
)

P3_FINAL = (
    V79
    / "manifests"
    / "V7.9-PHASE-3-FINAL-PERFORMANCE-ACCEPTANCE.json"
)

EXPECTED_GATES = [
    "PHASE_4A",
    "PHASE_4B",
    "PHASE_4C_R1",
    "PHASE_4C",
    "PHASE_4_FINAL",
]

def banner(text):
    print()
    print("=" * 110)
    print(" " + text)
    print("=" * 110)

def sha(path):
    return hashlib.sha256(
        path.read_bytes()
    ).hexdigest()

def http_code(url):
    r = subprocess.run(
        [
            "curl",
            "-sS",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            url,
        ],
        text=True,
        capture_output=True,
    )

    if r.returncode != 0:
        return "000"

    return r.stdout.strip()

def save(state):
    STATE_PATH.write_text(
        json.dumps(
            state,
            indent=2
        )
        + "\n",
        encoding="utf-8",
    )

def stop(state, gate, reason):
    state["status"] = "STOPPED_SAFELY"
    state["failed_gate"] = gate
    state["next_gate"] = gate
    state["reason"] = reason
    state["updated_at"] = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    save(state)

    banner(
        "TAM AN CARE V7.9 SERIES 05 STOPPED SAFELY"
    )

    print("GATE=" + gate)
    print("REASON=" + reason)
    print()
    print("PRODUCTION_DATABASE_MUTATION=NO")
    print("PRODUCTION_RUNTIME_RESTART=NO")
    print("V7.7_SOURCE_WRITE=NO")
    print("V7.6_ROLLBACK_DELETE=NO")
    print()
    print("DO NOT RERUN ACCEPTED PHASE 4 GATES.")
    print("RECOVER ONLY THIS FAILED GATE.")

    sys.exit(1)

banner(
    "TAM AN CARE V7.9 — SERIES 05 MASTER EXECUTION"
)

print(
    "PHASE=4_END_TO_END_UX_OPERATIONAL_SMOOTHNESS"
)

print(
    "GATES=4A->4B->4C_R1->4C->4_FINAL"
)

print("SERIAL_EXECUTION=YES")
print("FAIL_FAST=YES")
print("RESUMABLE=YES")
print("SHA256_ACCEPTANCE=YES")
print("INVENT_NEW_PHASE=NO")
print("PRODUCTION_DATABASE_MUTATION=NO")
print("PRODUCTION_RUNTIME_RESTART=NO")
print("V7.7_SOURCE_WRITE=NO")

for path in [
    STATE_PATH,
    ROADMAP_PATH,
    AUTH_PATH,
    P3_FINAL,
]:
    if not path.exists():
        raise SystemExit(
            "FAIL: missing checkpoint artifact: "
            + str(path)
        )

roadmap = json.loads(
    ROADMAP_PATH.read_text(
        encoding="utf-8"
    )
)

authority = json.loads(
    AUTH_PATH.read_text(
        encoding="utf-8"
    )
)

state = json.loads(
    STATE_PATH.read_text(
        encoding="utf-8"
    )
)

actual_gates = roadmap.get(
    "gate_sequence",
    []
)

if actual_gates != EXPECTED_GATES:
    raise SystemExit(
        "FAIL: Phase 4 gate sequence changed"
    )

if (
    authority.get("status")
    != "PASSED"
):
    raise SystemExit(
        "FAIL: Phase 4 authority not accepted"
    )

if (
    authority.get(
        "implementation_authorized"
    )
    is not True
):
    raise SystemExit(
        "FAIL: Phase 4 implementation not authorized"
    )

print(
    "PHASE3_FINAL_SHA256="
    + sha(P3_FINAL)
)

print(
    "PHASE4_AUTHORITY_SHA256="
    + sha(AUTH_PATH)
)

print(
    "PHASE4_ROADMAP_SHA256="
    + sha(ROADMAP_PATH)
)

api = http_code(
    "http://127.0.0.1:3100/api/health"
)

ui = http_code(
    "http://127.0.0.1:8080/"
)

staff = http_code(
    "http://127.0.0.1:3100/api/operations/staff-actors"
)

access = http_code(
    "http://127.0.0.1:3100/api/operations/access-assignments"
)

print("API_HEALTH=" + api)
print("UI_HEALTH=" + ui)
print("STAFF_NO_ACTOR=" + staff)
print("ACCESS_NO_ACTOR=" + access)

if (
    api != "200"
    or ui != "200"
    or staff != "401"
    or access != "401"
):
    raise SystemExit(
        "FAIL: production protection baseline changed"
    )

print(
    "PASS: SERIES 05 STARTING CHECKPOINT LOCKED"
)

completed = state.get(
    "completed",
    []
)

for gate in EXPECTED_GATES:

    if gate in completed:
        print(
            "SKIP_ALREADY_ACCEPTED_"
            + gate
            + "=YES"
        )
        continue

    if gate == "PHASE_4A":
        stop(
            state,
            gate,
            (
                "Phase 4A execution runner not yet generated; "
                "next authorized action is UX route + screen "
                "baseline implementation"
            ),
        )

    if gate == "PHASE_4B":
        stop(
            state,
            gate,
            "Phase 4B awaits accepted Phase 4A",
        )

    if gate == "PHASE_4C_R1":
        stop(
            state,
            gate,
            "Phase 4C-R1 awaits accepted Phase 4B",
        )

    if gate == "PHASE_4C":
        stop(
            state,
            gate,
            "Phase 4C awaits accepted Phase 4C-R1",
        )

    if gate == "PHASE_4_FINAL":
        stop(
            state,
            gate,
            "Phase 4 Final awaits accepted Phase 4C",
        )

raise SystemExit(
    "FAIL: Series 05 reached unexpected terminal state"
)
