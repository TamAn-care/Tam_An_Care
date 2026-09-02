#!/usr/bin/env python3

from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
V79 = ROOT / "V7.9"

STATE_FILE = (
    V79
    / "state"
    / "series04_phase3_state.json"
)

ROADMAP_FILE = (
    V79
    / "preflight"
    / "V7.9-PHASE-3-PERFORMANCE-ROADMAP.json"
)

PHASE2_FINAL = (
    V79
    / "results"
    / "V7.9-PHASE-2-FINAL-RESIDENT-MANAGEMENT-ACCEPTANCE-RESULT.txt"
)

AUTHORITY_RESULT = (
    V79
    / "results"
    / "V7.9-SERIES-04-R1-PHASE-3-VERSION-SPECIFIC-AUTHORITY-RESULT.txt"
)


def now():
    return datetime.now(
        timezone.utc
    ).isoformat()


def sha256(path):
    return hashlib.sha256(
        path.read_bytes()
    ).hexdigest()


def run(cmd):
    return subprocess.run(
        cmd,
        text=True,
        capture_output=True
    )


def http_code(url):
    r = run([
        "curl",
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        url,
    ])

    if r.returncode != 0:
        return "000"

    return r.stdout.strip()


def production_guard():
    matrix = {
        "API_HEALTH":
            http_code(
                "http://127.0.0.1:3100/api/health"
            ),

        "UI_HEALTH":
            http_code(
                "http://127.0.0.1:8080/api/health"
            ),

        "STAFF_NO_ACTOR":
            http_code(
                "http://127.0.0.1:3100/api/operations/staff-actors"
            ),

        "ACCESS_NO_ACTOR":
            http_code(
                "http://127.0.0.1:3100/api/operations/access-assignments"
            ),
    }

    for k, v in matrix.items():
        print(
            f"{k}={v}"
        )

    expected = {
        "API_HEALTH": "200",
        "UI_HEALTH": "200",
        "STAFF_NO_ACTOR": "401",
        "ACCESS_NO_ACTOR": "401",
    }

    if matrix != expected:
        raise RuntimeError(
            "production protection matrix changed"
        )


def load_state():
    return json.loads(
        STATE_FILE.read_text(
            encoding="utf-8"
        )
    )


def save_state(state):
    STATE_FILE.write_text(
        json.dumps(
            state,
            indent=2
        )
        + "\n",
        encoding="utf-8"
    )


def stop(gate, reason):
    state = load_state()

    state["status"] = (
        "STOPPED_SAFELY"
    )

    state["failed_gate"] = gate
    state["reason"] = reason
    state["updated_at"] = now()

    save_state(state)

    print()
    print(
        "=" * 110
    )

    print(
        " TAM AN CARE V7.9 SERIES 04 STOPPED SAFELY"
    )

    print(
        "=" * 110
    )

    print(
        f"GATE={gate}"
    )

    print(
        f"REASON={reason}"
    )

    print(
        "PRODUCTION_DATABASE_MUTATION=NO"
    )

    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )

    print(
        "APPLICATION_SOURCE_WRITE=NO"
    )

    print(
        "V7.7_SOURCE_WRITE=NO"
    )

    print(
        "V7.6_ROLLBACK_DELETE=NO"
    )

    print()
    print(
        "DO NOT RERUN ACCEPTED PHASE 3 GATES."
    )

    print(
        "RECOVER ONLY THIS FAILED GATE."
    )

    sys.exit(1)


def accepted(gate):
    state = load_state()

    return (
        gate
        in state.get(
            "completed",
            []
        )
    )


def require_base():
    for path in [
        PHASE2_FINAL,
        AUTHORITY_RESULT,
        ROADMAP_FILE,
        STATE_FILE,
    ]:
        if not path.exists():
            raise RuntimeError(
                "required checkpoint missing: "
                + str(path)
            )

    if (
        "STATUS=PASSED"
        not in PHASE2_FINAL.read_text(
            encoding="utf-8"
        )
    ):
        raise RuntimeError(
            "Phase 2 Final not accepted"
        )

    authority = (
        AUTHORITY_RESULT.read_text(
            encoding="utf-8"
        )
    )

    if (
        "DECISION=V7.8_IMMEDIATE_PREDECESSOR_PHASE3_CONTINUITY"
        not in authority
    ):
        raise RuntimeError(
            "Series 04 authority not locked"
        )


def phase_3a():
    stop(
        "PHASE_3A",
        (
            "Phase 3A execution runner not yet generated; "
            "next authorized action is low-impact "
            "read-only latency baseline implementation"
        ),
    )


def phase_3b():
    stop(
        "PHASE_3B",
        "Phase 3B awaits accepted Phase 3A"
    )


def phase_3b_r1():
    stop(
        "PHASE_3B_R1",
        "Phase 3B-R1 awaits accepted Phase 3B"
    )


def phase_3c():
    stop(
        "PHASE_3C",
        "Phase 3C awaits accepted Phase 3B-R1"
    )


def phase_3_final():
    stop(
        "PHASE_3_FINAL",
        "Phase 3 Final awaits accepted Phase 3C"
    )


def main():
    print(
        "=" * 110
    )

    print(
        " TAM AN CARE V7.9 — SERIES 04 MASTER EXECUTION"
    )

    print(
        "=" * 110
    )

    print(
        "PHASE=3_PERFORMANCE_LATENCY_CONTROLLED_READ_ONLY_CONCURRENCY"
    )

    print(
        "GATES=3A->3B->3B_R1->3C->3_FINAL"
    )

    print(
        "SERIAL_EXECUTION=YES"
    )

    print(
        "FAIL_FAST=YES"
    )

    print(
        "RESUMABLE=YES"
    )

    print(
        "SHA256_ACCEPTANCE=YES"
    )

    print(
        "MAX_AUTHORIZED_CONCURRENCY=5"
    )

    print(
        "MUTATION_ENDPOINTS=FORBIDDEN"
    )

    print(
        "PRODUCTION_DATABASE_MUTATION=NO"
    )

    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )

    print(
        "V7.7_SOURCE_WRITE=NO"
    )

    require_base()

    production_guard()

    print(
        "PHASE2_FINAL_SHA256="
        + sha256(
            PHASE2_FINAL
        )
    )

    print(
        "SERIES04_AUTHORITY_SHA256="
        + sha256(
            AUTHORITY_RESULT
        )
    )

    print(
        "PHASE3_ROADMAP_SHA256="
        + sha256(
            ROADMAP_FILE
        )
    )

    print(
        "PASS: SERIES 04 STARTING CHECKPOINT LOCKED"
    )

    gates = [
        (
            "PHASE_3A",
            phase_3a,
        ),
        (
            "PHASE_3B",
            phase_3b,
        ),
        (
            "PHASE_3B_R1",
            phase_3b_r1,
        ),
        (
            "PHASE_3C",
            phase_3c,
        ),
        (
            "PHASE_3_FINAL",
            phase_3_final,
        ),
    ]

    for gate, fn in gates:
        if accepted(gate):
            print(
                "SKIP_ALREADY_ACCEPTED_"
                + gate
                + "=YES"
            )

            continue

        fn()

    production_guard()

    print(
        "PASS: SERIES 04 CLOSED"
    )


if __name__ == "__main__":
    main()
