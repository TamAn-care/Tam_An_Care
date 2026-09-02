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
    / "series07_phase6_state.json"
)

PREFLIGHT = (
    V79
    / "preflight"
    / "V7.9-PHASE-6-FINAL-OPERATIONAL-ACCEPTANCE-PREFLIGHT.json"
)

P3_FINAL = (
    V79
    / "results"
    / "V7.9-PHASE-3-FINAL-PERFORMANCE-ACCEPTANCE-RESULT.txt"
)

P4_FINAL = (
    V79
    / "results"
    / "V7.9-PHASE-4-FINAL-UX-OPERATIONAL-SMOOTHNESS-RESULT.txt"
)

P5_FINAL = (
    V79
    / "results"
    / "V7.9-PHASE-5-FINAL-BACKUP-DATA-INTEGRITY-RESULT.txt"
)

FINAL_RESULT = (
    V79
    / "results"
    / "V7.9-PHASE-6-FINAL-OPERATIONAL-ACCEPTANCE-RESULT.txt"
)

FINAL_MANIFEST = (
    V79
    / "manifests"
    / "V7.9-PHASE-6-FINAL-OPERATIONAL-ACCEPTANCE.json"
)

RELEASE_MANIFEST = (
    V79
    / "V7.9-FINAL-OPERATIONAL-RELEASE-MANIFEST.json"
)

RELEASE_FREEZE_RESULT = (
    V79
    / "results"
    / "V7.9-FINAL-OPERATIONAL-RELEASE-FREEZE-RESULT.txt"
)

API_CONTAINER = (
    "taman-care-v77-production-api"
)

UI_CONTAINER = (
    "taman-care-v77-production-ui"
)

FINAL_ROUTES = [
    "/",
    "/dashboard",
    "/operational-care",
    "/residents",
    "/staff-access",
    "/system-status",
]


def sha256(path):
    return hashlib.sha256(
        Path(path).read_bytes()
    ).hexdigest()


def run(args, check=False):
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


def text(args, check=True):
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


def save_json(path, data):
    Path(path).write_text(
        json.dumps(
            data,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )


def save_state(data):
    save_json(
        STATE,
        data,
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


def container_info(name):
    raw = text([
        "docker",
        "inspect",
        name,
    ])

    data = json.loads(raw)

    if not data:
        raise RuntimeError(
            "container missing: "
            + name
        )

    return data[0]


def runtime_identity(name):
    info = container_info(
        name
    )

    return {
        "container_id":
            info["Id"],

        "started_at":
            info["State"]["StartedAt"],

        "image_id":
            info["Image"],
    }


def route_check():
    for route in FINAL_ROUTES:
        code = text([
            "curl",
            "-sS",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "http://127.0.0.1:8080"
            + route,
        ])

        print(
            "FINAL_ROUTE|"
            + route
            + "|HTTP="
            + code
        )

        if code != "200":
            raise RuntimeError(
                "final UX route failed: "
                + route
                + " HTTP "
                + code
            )


def require_status_passed(path):
    content = Path(path).read_text(
        encoding="utf-8",
        errors="ignore",
    )

    if "STATUS=PASSED" not in content:
        raise RuntimeError(
            "accepted result missing PASS: "
            + str(path)
        )


def source_hash(root):
    root = Path(root)

    ignored = {
        ".git",
        "node_modules",
        "dist",
        "build",
        "coverage",
    }

    allowed = {
        ".ts", ".tsx",
        ".js", ".jsx",
        ".json",
        ".sql",
        ".css",
        ".html",
        ".md",
        ".yml",
        ".yaml",
    }

    data = {}

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        if any(
            part in ignored
            for part in path.parts
        ):
            continue

        if path.name.endswith(
            ".tsbuildinfo"
        ):
            continue

        if path.suffix.lower() not in allowed:
            continue

        data[
            str(
                path.relative_to(root)
            )
        ] = hashlib.sha256(
            path.read_bytes()
        ).hexdigest()

    raw = json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()

    return hashlib.sha256(
        raw
    ).hexdigest()


def prod_query(sql):
    p = run([
        "docker",
        "exec",
        "taman-care-v743-dev-postgres",
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "taman_v743_dev",
        "-d",
        "taman_care_v743_dev",
        "-At",
        "-c",
        "BEGIN READ ONLY;\n"
        + sql
        + "\nROLLBACK;",
    ])

    if p.returncode:
        raise RuntimeError(
            "read-only production query failed:\n"
            + p.stdout.decode(
                "utf-8",
                errors="ignore",
            )
            + p.stderr.decode(
                "utf-8",
                errors="ignore",
            )
        )

    return [
        line.strip()
        for line in p.stdout.decode(
            "utf-8",
            errors="ignore",
        ).splitlines()
        if line.strip()
        and line.strip() not in {
            "BEGIN",
            "ROLLBACK",
        }
    ]


def db_fingerprint():
    tables = prod_query("""
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
AND table_type='BASE TABLE'
ORDER BY table_name;
""")

    rows = []

    for table in tables:
        safe = table.replace(
            '"',
            '""',
        )

        count = prod_query(
            f'SELECT count(*) '
            f'FROM public."{safe}";'
        )

        if len(count) != 1:
            raise RuntimeError(
                "invalid row count for "
                + table
            )

        rows.append(
            f"{table}={count[0]}"
        )

    canonical = "\n".join(
        rows
    )

    fingerprint = hashlib.sha256(
        canonical.encode()
    ).hexdigest()

    return {
        "table_count":
            len(rows),

        "fingerprint":
            fingerprint,
    }


def verify_source_integrity():
    expected = (
        "bd68dcede4144c46dbb1633bd19af422"
        "ac58df2b492a62cc7a460c2db93ebac7"
    )

    actual = source_hash(
        ROOT
        / "V7.7"
        / "workspace"
    )

    print(
        "V77_SOURCE_HASH="
        + actual
    )

    if actual != expected:
        raise RuntimeError(
            "frozen V7.7 source integrity changed"
        )

    print(
        "SOURCE_INTEGRITY=PASSED"
    )


def verify_database_integrity():
    expected_tables = 118

    expected_fingerprint = (
        "7c1156b0bd562d03181259d6102412340"
        "f4ecbbb752b4eb427fd92cdc1864639"
    )

    current = db_fingerprint()

    print(
        "PRODUCTION_DB_TABLE_COUNT="
        + str(
            current["table_count"]
        )
    )

    print(
        "PRODUCTION_DB_FINGERPRINT="
        + current["fingerprint"]
    )

    if (
        current["table_count"]
        != expected_tables
    ):
        raise RuntimeError(
            "production DB table count changed"
        )

    if (
        current["fingerprint"]
        != expected_fingerprint
    ):
        raise RuntimeError(
            "production DB fingerprint changed"
        )

    print(
        "DATABASE_INTEGRITY=PASSED"
    )


def verify_v76_rollback_assets():
    expected = {
        "taman-care-v743-dev-api":
            "exited",

        "taman-care-v75-ui":
            "exited",
    }

    for container, expected_state in expected.items():
        info = container_info(
            container
        )

        actual = (
            info["State"]["Status"]
        )

        print(
            "ROLLBACK_ASSET|"
            + container
            + "|STATE="
            + actual
        )

        if actual != expected_state:
            raise RuntimeError(
                "V7.6 rollback asset state changed: "
                + container
            )

    print(
        "V76_ROLLBACK_ASSETS_PRESERVED=YES"
    )


def main():
    print("=" * 78)
    print(" TAM AN CARE V7.9 — SERIES 07")
    print(" PHASE 6")
    print(" FINAL OPERATIONAL ACCEPTANCE")
    print(" READ-ONLY ACCEPTANCE + RELEASE FREEZE")
    print("=" * 78)

    state = load_json(
        STATE
    )

    if state.get("status") != "READY":
        raise RuntimeError(
            "Series 07 not READY"
        )

    if state.get("completed") != []:
        raise RuntimeError(
            "Phase 6 already completed"
        )

    if state.get("next_gate") != "PHASE_6":
        raise RuntimeError(
            "Phase 6 not current gate"
        )

    if state.get("failed_gate") is not None:
        raise RuntimeError(
            "unexpected failed gate"
        )

    preflight = load_json(
        PREFLIGHT
    )

    if (
        preflight.get("status")
        != "PREFLIGHT_COMPLETE"
    ):
        raise RuntimeError(
            "Phase 6 preflight not accepted"
        )

    if (
        preflight.get(
            "manual_test_required"
        )
        is not False
    ):
        raise RuntimeError(
            "manual-test policy mismatch"
        )

    require_status_passed(
        P3_FINAL
    )

    require_status_passed(
        P4_FINAL
    )

    require_status_passed(
        P5_FINAL
    )

    print(
        "PHASE3_FINAL=PASSED"
    )

    print(
        "PHASE4_FINAL=PASSED"
    )

    print(
        "PHASE5_FINAL=PASSED"
    )

    api_before = runtime_identity(
        API_CONTAINER
    )

    ui_before = runtime_identity(
        UI_CONTAINER
    )

    print(
        "API_STARTED_BEFORE="
        + api_before["started_at"]
    )

    print(
        "UI_STARTED_BEFORE="
        + ui_before["started_at"]
    )

    print(
        "API_IMAGE_BEFORE="
        + api_before["image_id"]
    )

    print(
        "UI_IMAGE_BEFORE="
        + ui_before["image_id"]
    )

    health()

    verify_source_integrity()

    verify_database_integrity()

    verify_v76_rollback_assets()

    route_check()

    api_after = runtime_identity(
        API_CONTAINER
    )

    ui_after = runtime_identity(
        UI_CONTAINER
    )

    if api_after != api_before:
        raise RuntimeError(
            "production API runtime identity changed"
        )

    if ui_after != ui_before:
        raise RuntimeError(
            "production UI runtime identity changed"
        )

    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )

    print(
        "PRODUCTION_IMAGE_CHANGE=NO"
    )

    health()

    manifest = {
        "version":
            "V7.9",

        "series":
            "07",

        "phase":
            "PHASE_6",

        "phase_name":
            "FINAL_OPERATIONAL_ACCEPTANCE",

        "status":
            "PASSED",

        "decision":
            "FINAL_OPERATIONAL_ACCEPTANCE_PASSED",

        "phase3_accepted":
            True,

        "phase4_accepted":
            True,

        "phase5_accepted":
            True,

        "final_route_count":
            len(FINAL_ROUTES),

        "final_route_http_acceptance":
            200,

        "production_restore":
            False,

        "production_database_write":
            False,

        "production_database_mutation":
            False,

        "production_runtime_restart":
            False,

        "production_image_change":
            False,

        "v77_source_write":
            False,

        "manual_test_required":
            False,

        "real_person_test_mutation":
            False,

        "release_status":
            "FINAL_OPERATIONAL_RELEASE_FROZEN",

        "next_roadmap_step":
            None,

        "preflight_sha256":
            sha256(
                PREFLIGHT
            ),

        "phase3_final_sha256":
            sha256(
                P3_FINAL
            ),

        "phase4_final_sha256":
            sha256(
                P4_FINAL
            ),

        "phase5_final_sha256":
            sha256(
                P5_FINAL
            ),
    }

    save_json(
        FINAL_MANIFEST,
        manifest,
    )

    FINAL_RESULT.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "SERIES=07",
            "PHASE=PHASE_6",
            "PHASE_NAME=FINAL_OPERATIONAL_ACCEPTANCE",
            "STATUS=PASSED",
            "DECISION=FINAL_OPERATIONAL_ACCEPTANCE_PASSED",
            "PHASE3_FINAL=PASSED",
            "PHASE4_FINAL=PASSED",
            "PHASE5_FINAL=PASSED",
            "FINAL_ROUTE_COUNT=6",
            "FINAL_ROUTE_HTTP_ACCEPTANCE=200",
            "PRODUCTION_RESTORE=NO",
            "PRODUCTION_DATABASE_WRITE=NO",
            "PRODUCTION_DATABASE_MUTATION=NO",
            "PRODUCTION_RUNTIME_RESTART=NO",
            "PRODUCTION_IMAGE_CHANGE=NO",
            "V7.7_SOURCE_WRITE=NO",
            "MANUAL_TEST_REQUIRED=NO",
            "REAL_PERSON_TEST_MUTATION=NO",
            "RELEASE_STATUS=FINAL_OPERATIONAL_RELEASE_FROZEN",
            "NEXT_ROADMAP_STEP=NONE",
        ]) + "\n",
        encoding="utf-8",
    )

    release = {
        "version":
            "V7.9",

        "status":
            "FINAL_OPERATIONAL_RELEASE_FROZEN",

        "phase6_status":
            "PASSED",

        "phase3":
            "ACCEPTED",

        "phase4":
            "ACCEPTED",

        "phase5":
            "ACCEPTED",

        "final_route_count":
            6,

        "manual_test_required":
            False,

        "production_restore":
            False,

        "production_database_write":
            False,

        "production_database_mutation":
            False,

        "production_runtime_restart":
            False,

        "production_image_change":
            False,

        "v77_source_write":
            False,

        "next_roadmap_step":
            None,

        "phase6_result_sha256":
            sha256(
                FINAL_RESULT
            ),

        "phase6_manifest_sha256":
            sha256(
                FINAL_MANIFEST
            ),
    }

    save_json(
        RELEASE_MANIFEST,
        release,
    )

    RELEASE_FREEZE_RESULT.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "STATUS=FINAL_OPERATIONAL_RELEASE_FROZEN",
            "PHASE6=PASSED",
            "PHASE3=ACCEPTED",
            "PHASE4=ACCEPTED",
            "PHASE5=ACCEPTED",
            "FINAL_ROUTE_COUNT=6",
            "PRODUCTION_DATABASE_MUTATION=NO",
            "PRODUCTION_RUNTIME_RESTART=NO",
            "PRODUCTION_IMAGE_CHANGE=NO",
            "V7.7_SOURCE_WRITE=NO",
            "NEXT_ROADMAP_STEP=NONE",
        ]) + "\n",
        encoding="utf-8",
    )

    state["status"] = "PASSED"

    state["completed"] = [
        "PHASE_6",
    ]

    state["failed_gate"] = None
    state["reason"] = None
    state["next_gate"] = None
    state["execution_authorized"] = False

    save_state(
        state
    )

    print(
        "PHASE6_RESULT_SHA256="
        + sha256(
            FINAL_RESULT
        )
    )

    print(
        "PHASE6_MANIFEST_SHA256="
        + sha256(
            FINAL_MANIFEST
        )
    )

    print(
        "RELEASE_MANIFEST_SHA256="
        + sha256(
            RELEASE_MANIFEST
        )
    )

    print(
        "RELEASE_FREEZE_RESULT_SHA256="
        + sha256(
            RELEASE_FREEZE_RESULT
        )
    )

    print(
        "SERIES07_STATUS=PASSED"
    )

    print(
        "FINAL_OPERATIONAL_RELEASE_FROZEN=YES"
    )

    print(
        "NEXT_ROADMAP_STEP=NONE"
    )

    print(
        "PASS: PHASE 6 FINAL OPERATIONAL ACCEPTANCE CLOSED"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
