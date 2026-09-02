#!/usr/bin/env python3

import hashlib
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(
    "/Users/anhha/Downloads/TamAnCare_V7_4_3_Development"
)

V79 = ROOT / "V7.9"

STATE = (
    V79
    / "state"
    / "series06_phase5_state.json"
)

P5A_RESULT = (
    V79
    / "results"
    / "V7.9-PHASE-5A-DISPOSABLE-BACKUP-RESTORE-RESULT.txt"
)

P5A_MANIFEST = (
    V79
    / "manifests"
    / "V7.9-PHASE-5A-DISPOSABLE-BACKUP-RESTORE.json"
)

P5B_RESULT = (
    V79
    / "results"
    / "V7.9-PHASE-5B-RESTORED-DATA-INTEGRITY-RESULT.txt"
)

P5B_MANIFEST = (
    V79
    / "manifests"
    / "V7.9-PHASE-5B-RESTORED-DATA-INTEGRITY.json"
)

FINAL_RESULT = (
    V79
    / "results"
    / "V7.9-PHASE-5-FINAL-BACKUP-DATA-INTEGRITY-RESULT.txt"
)

FINAL_MANIFEST = (
    V79
    / "manifests"
    / "V7.9-PHASE-5-FINAL-BACKUP-DATA-INTEGRITY.json"
)

API_CONTAINER = (
    "taman-care-v77-production-api"
)

UI_CONTAINER = (
    "taman-care-v77-production-ui"
)


def sha256(path):
    return hashlib.sha256(
        Path(path).read_bytes()
    ).hexdigest()


def run(
    args,
    *,
    check=False,
):
    p = subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    if check and p.returncode:
        raise RuntimeError(
            "command failed: "
            + " ".join(args)
            + "\n"
            + p.stderr.decode(
                "utf-8",
                errors="ignore",
            )[-4000:]
        )

    return p


def text(
    args,
    *,
    check=True,
):
    p = run(
        args,
        check=check,
    )

    return p.stdout.decode(
        "utf-8",
        errors="ignore",
    ).strip()


def load_json(path):
    return json.loads(
        Path(path).read_text(
            encoding="utf-8"
        )
    )


def save_state(data):
    STATE.write_text(
        json.dumps(
            data,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def health():
    probes = [
        (
            "API_HEALTH",
            "http://127.0.0.1:3100/api/health",
            "200",
        ),
        (
            "UI_HEALTH",
            "http://127.0.0.1:8080/",
            "200",
        ),
        (
            "STAFF_NO_ACTOR",
            "http://127.0.0.1:3100/api/operations/staff-actors",
            "401",
        ),
        (
            "ACCESS_NO_ACTOR",
            "http://127.0.0.1:3100/api/operations/access-assignments",
            "401",
        ),
    ]

    for name, url, expected in probes:
        code = text([
            "curl",
            "-sS",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            url,
        ])

        print(
            name
            + "="
            + code
        )

        if code != expected:
            raise RuntimeError(
                name
                + " expected "
                + expected
                + " got "
                + code
            )


def inspect_container(name):
    raw = text([
        "docker",
        "inspect",
        name,
    ])

    data = json.loads(raw)

    if not data:
        raise RuntimeError(
            "docker inspect returned no container"
        )

    return data[0]


def started_at(name):
    return (
        inspect_container(name)
        ["State"]
        ["StartedAt"]
    )


def image_id(name):
    return (
        inspect_container(name)
        ["Image"]
    )


def container_running(name):
    p = run([
        "docker",
        "inspect",
        "-f",
        "{{.State.Running}}",
        name,
    ])

    if p.returncode:
        return False

    return (
        p.stdout.decode(
            "utf-8",
            errors="ignore",
        ).strip()
        == "true"
    )


def network_exists(name):
    p = run([
        "docker",
        "network",
        "inspect",
        name,
    ])

    return p.returncode == 0


def remove_container(name):
    p = run([
        "docker",
        "rm",
        "-f",
        name,
    ])

    if p.returncode:
        raise RuntimeError(
            "failed to remove restore container: "
            + p.stderr.decode(
                "utf-8",
                errors="ignore",
            )[-2000:]
        )


def remove_network(name):
    p = run([
        "docker",
        "network",
        "rm",
        name,
    ])

    if p.returncode:
        raise RuntimeError(
            "failed to remove restore network: "
            + p.stderr.decode(
                "utf-8",
                errors="ignore",
            )[-2000:]
        )


def main():
    print(
        "=" * 78
    )
    print(
        " TAM AN CARE V7.9 — SERIES 06"
    )
    print(
        " PHASE 5 FINAL"
    )
    print(
        " BACKUP / DATA-INTEGRITY ACCEPTANCE"
    )
    print(
        " CONSOLIDATION + CLEANUP ONLY"
    )
    print(
        "=" * 78
    )

    state = load_json(
        STATE
    )

    if state.get("completed") != [
        "PHASE_5A",
        "PHASE_5B",
    ]:
        raise RuntimeError(
            "accepted Phase 5 chain mismatch"
        )

    if (
        state.get("next_gate")
        != "PHASE_5_FINAL"
    ):
        raise RuntimeError(
            "Phase 5 Final is not current gate"
        )

    if state.get("failed_gate") is not None:
        raise RuntimeError(
            "unexpected failed gate"
        )

    restore_container = (
        state.get(
            "phase5_restore_container"
        )
    )

    restore_network = (
        state.get(
            "phase5_restore_network"
        )
    )

    if not restore_container:
        raise RuntimeError(
            "restore container state handoff missing"
        )

    if not restore_network:
        raise RuntimeError(
            "restore network state handoff missing"
        )

    # Lock accepted evidence.
    for p in [
        P5A_RESULT,
        P5A_MANIFEST,
        P5B_RESULT,
        P5B_MANIFEST,
    ]:
        if not p.exists():
            raise RuntimeError(
                "accepted artifact missing: "
                + str(p)
            )

    p5a = load_json(
        P5A_MANIFEST
    )

    p5b = load_json(
        P5B_MANIFEST
    )

    if p5a.get("status") != "PASSED":
        raise RuntimeError(
            "Phase 5A not accepted"
        )

    if p5b.get("status") != "PASSED":
        raise RuntimeError(
            "Phase 5B not accepted"
        )

    if (
        p5b.get(
            "table_set_equivalent"
        )
        is not True
    ):
        raise RuntimeError(
            "Phase 5B table-set acceptance missing"
        )

    if (
        p5b.get(
            "row_count_difference_tables"
        )
        != 0
    ):
        raise RuntimeError(
            "Phase 5B row-count acceptance missing"
        )

    if (
        p5b.get(
            "production_database_delta"
        )
        is not False
    ):
        raise RuntimeError(
            "Phase 5B production DB safety missing"
        )

    if (
        p5b.get(
            "snapshot_removed"
        )
        is not True
    ):
        raise RuntimeError(
            "Phase 5B snapshot cleanup missing"
        )

    if (
        p5b.get("restore_container")
        != restore_container
    ):
        raise RuntimeError(
            "restore container handoff mismatch"
        )

    if (
        p5b.get("restore_network")
        != restore_network
    ):
        raise RuntimeError(
            "restore network handoff mismatch"
        )

    if not container_running(
        restore_container
    ):
        raise RuntimeError(
            "restore container not running before final cleanup"
        )

    if not network_exists(
        restore_network
    ):
        raise RuntimeError(
            "restore network missing before final cleanup"
        )

    health()

    api_started_before = (
        started_at(
            API_CONTAINER
        )
    )

    ui_started_before = (
        started_at(
            UI_CONTAINER
        )
    )

    api_image_before = (
        image_id(
            API_CONTAINER
        )
    )

    ui_image_before = (
        image_id(
            UI_CONTAINER
        )
    )

    print(
        "PHASE5A_STATUS=PASSED"
    )

    print(
        "PHASE5B_STATUS=PASSED"
    )

    print(
        "RESTORED_TABLE_SET_EQUIVALENT=YES"
    )

    print(
        "RESTORED_ROW_COUNT_DIFF_TABLES=0"
    )

    print(
        "PRODUCTION_DATABASE_DELTA=NO"
    )

    print(
        "FINAL_NEW_BACKUP=NO"
    )

    print(
        "FINAL_NEW_RESTORE=NO"
    )

    # Final cleanup belongs here.
    remove_container(
        restore_container
    )

    print(
        "FINAL_RESTORE_CONTAINER_REMOVED=YES"
    )

    remove_network(
        restore_network
    )

    print(
        "FINAL_RESTORE_NETWORK_REMOVED=YES"
    )

    if container_running(
        restore_container
    ):
        raise RuntimeError(
            "restore container still running after cleanup"
        )

    if network_exists(
        restore_network
    ):
        raise RuntimeError(
            "restore network still exists after cleanup"
        )

    print(
        "FINAL_RUNTIME_CLEANUP_VERIFIED=YES"
    )

    health()

    if (
        started_at(
            API_CONTAINER
        )
        != api_started_before
    ):
        raise RuntimeError(
            "production API restarted"
        )

    if (
        started_at(
            UI_CONTAINER
        )
        != ui_started_before
    ):
        raise RuntimeError(
            "production UI restarted"
        )

    if (
        image_id(
            API_CONTAINER
        )
        != api_image_before
    ):
        raise RuntimeError(
            "production API image changed"
        )

    if (
        image_id(
            UI_CONTAINER
        )
        != ui_image_before
    ):
        raise RuntimeError(
            "production UI image changed"
        )

    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )

    print(
        "PRODUCTION_IMAGE_CHANGE=NO"
    )

    final_manifest = {
        "version":
            "V7.9",

        "series":
            "06",

        "phase":
            "5-FINAL",

        "status":
            "PASSED",

        "decision":
            "BACKUP_RESTORE_DATA_INTEGRITY_ACCEPTED",

        "phase5a_result_sha256":
            sha256(
                P5A_RESULT
            ),

        "phase5a_manifest_sha256":
            sha256(
                P5A_MANIFEST
            ),

        "phase5b_result_sha256":
            sha256(
                P5B_RESULT
            ),

        "phase5b_manifest_sha256":
            sha256(
                P5B_MANIFEST
            ),

        "phase5a_accepted":
            True,

        "phase5b_accepted":
            True,

        "table_set_equivalent":
            True,

        "row_count_difference_tables":
            0,

        "production_restore":
            False,

        "production_database_write":
            False,

        "production_database_delta":
            False,

        "production_runtime_restart":
            False,

        "production_image_change":
            False,

        "new_backup_in_final":
            False,

        "new_restore_in_final":
            False,

        "restore_container_removed":
            True,

        "restore_network_removed":
            True,

        "state_handoff_removed":
            True,

        "manual_test_required":
            False,

        "next":
            "REVIEW_EXISTING_ROADMAP_AFTER_PHASE_5",
    }

    FINAL_MANIFEST.write_text(
        json.dumps(
            final_manifest,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    FINAL_RESULT.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "SERIES=06",
            "PHASE=5-FINAL",
            "STATUS=PASSED",
            "DECISION=BACKUP_RESTORE_DATA_INTEGRITY_ACCEPTED",
            "PHASE5A=PASSED",
            "PHASE5B=PASSED",
            "RESTORED_TABLE_SET_EQUIVALENT=YES",
            "RESTORED_ROW_COUNT_DIFF_TABLES=0",
            "PRODUCTION_RESTORE=NO",
            "PRODUCTION_DATABASE_WRITE=NO",
            "PRODUCTION_DATABASE_DELTA=NO",
            "PRODUCTION_RUNTIME_RESTART=NO",
            "PRODUCTION_IMAGE_CHANGE=NO",
            "FINAL_NEW_BACKUP=NO",
            "FINAL_NEW_RESTORE=NO",
            "FINAL_RESTORE_CONTAINER_REMOVED=YES",
            "FINAL_RESTORE_NETWORK_REMOVED=YES",
            "FINAL_STATE_HANDOFF_REMOVED=YES",
            "PHASE5_FINAL_MANUAL_TEST_REQUIRED=NO",
            "NEXT=REVIEW_EXISTING_ROADMAP_AFTER_PHASE_5",
        ])
        + "\n",
        encoding="utf-8",
    )

    # Only after evidence is successfully written
    # do we close state and remove handoff keys.
    state["status"] = "PASSED"

    state["completed"] = [
        "PHASE_5A",
        "PHASE_5B",
        "PHASE_5_FINAL",
    ]

    state["failed_gate"] = None
    state["reason"] = None
    state["next_gate"] = None

    state.pop(
        "phase5_restore_container",
        None,
    )

    state.pop(
        "phase5_restore_network",
        None,
    )

    save_state(
        state
    )

    print(
        "FINAL_STATE_HANDOFF_REMOVED=YES"
    )

    print(
        "PHASE5_FINAL_RESULT_SHA256="
        + sha256(
            FINAL_RESULT
        )
    )

    print(
        "PHASE5_FINAL_MANIFEST_SHA256="
        + sha256(
            FINAL_MANIFEST
        )
    )

    print(
        "SERIES06_STATUS=PASSED"
    )

    print(
        "PASS: PHASE 5 FINAL CLOSED"
    )

    print(
        "NEXT=REVIEW_EXISTING_ROADMAP_AFTER_PHASE_5"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
