#!/usr/bin/env python3

import hashlib
import json
import os
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(
    "/Users/anhha/Downloads/TamAnCare_V7_4_3_Development"
)

V79 = ROOT / "V7.9"

STATE = (
    V79
    / "state"
    / "series06_phase5_state.json"
)

RESULT = (
    V79
    / "results"
    / "V7.9-PHASE-5B-RESTORED-DATA-INTEGRITY-RESULT.txt"
)

MANIFEST = (
    V79
    / "manifests"
    / "V7.9-PHASE-5B-RESTORED-DATA-INTEGRITY.json"
)

BACKUPS = V79 / "backups"

API_CONTAINER = "taman-care-v77-production-api"

RESTORE_USER = "restoreuser"
RESTORE_PASSWORD = "restorepass"
RESTORE_DB = "restoredb"

POSTGRES_IMAGE = "postgres:16"


def run(
    args,
    *,
    check=False,
    input_bytes=None,
):
    p = subprocess.run(
        args,
        input=input_bytes,
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


def text(args, *, check=True):
    p = run(
        args,
        check=check,
    )

    return p.stdout.decode(
        "utf-8",
        errors="ignore",
    ).strip()


def sha256(path):
    return hashlib.sha256(
        Path(path).read_bytes()
    ).hexdigest()


def load_state():
    return json.loads(
        STATE.read_text(
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


def production_health():
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


def inspect(name):
    raw = text([
        "docker",
        "inspect",
        name,
    ])

    data = json.loads(raw)

    if not data:
        raise RuntimeError(
            "docker inspect returned empty result"
        )

    return data[0]


def container_started_at(name):
    return inspect(name)["State"]["StartedAt"]


def container_image(name):
    return inspect(name)["Image"]


def get_database_url():
    raw = text([
        "docker",
        "inspect",
        API_CONTAINER,
        "--format",
        "{{range .Config.Env}}{{println .}}{{end}}",
    ])

    for line in raw.splitlines():
        if line.startswith(
            "DATABASE_URL="
        ):
            return line.split(
                "=",
                1,
            )[1]

    raise RuntimeError(
        "DATABASE_URL missing from live API container"
    )


def resolve_source_database():
    url = get_database_url()

    parsed = urlparse(url)

    source_user = parsed.username
    source_db = (
        parsed.path
        or ""
    ).lstrip("/")
    db_host = parsed.hostname

    if not source_user:
        raise RuntimeError(
            "source DB user unresolved"
        )

    if not source_db:
        raise RuntimeError(
            "source DB name unresolved"
        )

    if not db_host:
        raise RuntimeError(
            "source DB host unresolved"
        )

    candidates = []

    names = text([
        "docker",
        "ps",
        "--format",
        "{{.Names}}",
    ]).splitlines()

    for name in names:
        try:
            info = inspect(name)
        except Exception:
            continue

        image = (
            info
            .get("Config", {})
            .get("Image", "")
        )

        networks = (
            info
            .get(
                "NetworkSettings",
                {},
            )
            .get(
                "Networks",
                {},
            )
        )

        aliases = []

        for net in networks.values():
            aliases.extend(
                net.get(
                    "Aliases",
                    [],
                )
                or []
            )

        score = 0

        if db_host == name:
            score += 100

        if db_host in aliases:
            score += 200

        if image.startswith(
            "postgres:"
        ):
            score += 30

        if score:
            candidates.append(
                (
                    score,
                    name,
                    image,
                )
            )

    candidates.sort(
        reverse=True
    )

    if not candidates:
        raise RuntimeError(
            "production DB container unresolved"
        )

    best_score = candidates[0][0]

    best = [
        x
        for x in candidates
        if x[0] == best_score
    ]

    if len(best) != 1:
        raise RuntimeError(
            "production DB container not uniquely resolved"
        )

    source_container = best[0][1]

    print(
        "SOURCE_DB_HOST="
        + db_host
    )
    print(
        "SOURCE_DB_CONTAINER="
        + source_container
    )
    print(
        "SOURCE_DB_USER="
        + source_user
    )
    print(
        "SOURCE_DB_NAME="
        + source_db
    )

    return (
        source_container,
        source_user,
        source_db,
    )


def query(
    container,
    user,
    database,
    sql,
):
    p = run([
        "docker",
        "exec",
        container,
        "psql",
        "-X",
        "-U",
        user,
        "-d",
        database,
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ])

    if p.returncode:
        raise RuntimeError(
            "database query failed\n"
            + p.stderr.decode(
                "utf-8",
                errors="ignore",
            )[-4000:]
        )

    return [
        line.strip()
        for line in p.stdout.decode(
            "utf-8",
            errors="ignore",
        ).splitlines()
        if line.strip()
    ]


def public_tables(
    container,
    user,
    database,
):
    return query(
        container,
        user,
        database,
        """
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
AND table_type='BASE TABLE'
ORDER BY table_name;
""",
    )


def database_fingerprint(
    container,
    user,
    database,
):
    tables = public_tables(
        container,
        user,
        database,
    )

    parts = []

    for table in tables:
        safe = table.replace(
            '"',
            '""',
        )

        count = query(
            container,
            user,
            database,
            (
                'SELECT count(*) '
                f'FROM public."{safe}";'
            ),
        )[0]

        parts.append(
            table
            + "="
            + count
        )

    raw = "\n".join(
        parts
    ).encode()

    return hashlib.sha256(
        raw
    ).hexdigest()


def safe_remove_container(name):
    if not name:
        return

    subprocess.run(
        [
            "docker",
            "rm",
            "-f",
            name,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def safe_remove_network(name):
    if not name:
        return

    subprocess.run(
        [
            "docker",
            "network",
            "rm",
            name,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def safe_remove_file(path):
    if not path:
        return

    p = Path(path)

    if p.exists():
        p.unlink()


def stop_safely(
    state,
    reason,
    *,
    backup=None,
    restore_container=None,
    network=None,
):
    # Phase 5B failure leaves no compatibility runtime behind.
    safe_remove_container(
        restore_container
    )

    safe_remove_network(
        network
    )

    safe_remove_file(
        backup
    )

    state["status"] = (
        "STOPPED_SAFELY"
    )

    state["failed_gate"] = (
        "PHASE_5B"
    )

    state["next_gate"] = (
        "PHASE_5B"
    )

    state["reason"] = reason

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

    print()
    print(
        "=" * 78
    )
    print(
        " TAM AN CARE V7.9 SERIES 06 STOPPED SAFELY"
    )
    print(
        "=" * 78
    )
    print(
        "GATE=PHASE_5B"
    )
    print(
        "REASON="
        + reason
    )
    print(
        "PHASE5A_RERUN=NO"
    )
    print(
        "PRODUCTION_DATABASE_MUTATION=NO"
    )
    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )
    print(
        "DO NOT RERUN ACCEPTED PHASE 5A."
    )

    raise SystemExit(1)


def main():
    print(
        "=" * 78
    )
    print(
        " TAM AN CARE V7.9 — SERIES 06"
    )
    print(
        " PHASE 5B"
    )
    print(
        " RESTORED DATA INTEGRITY"
    )
    print(
        " COMPATIBILITY RUNTIME RECONSTRUCTION"
    )
    print(
        "=" * 78
    )

    state = load_state()

    if (
        state.get("completed")
        != ["PHASE_5A"]
    ):
        raise RuntimeError(
            "accepted gate chain mismatch"
        )

    if (
        state.get("next_gate")
        != "PHASE_5B"
    ):
        raise RuntimeError(
            "PHASE_5B is not current gate"
        )

    production_health()

    api_started_before = (
        container_started_at(
            API_CONTAINER
        )
    )

    api_image_before = (
        container_image(
            API_CONTAINER
        )
    )

    (
        source_container,
        source_user,
        source_db,
    ) = resolve_source_database()

    source_tables_before = (
        public_tables(
            source_container,
            source_user,
            source_db,
        )
    )

    source_fp_before = (
        database_fingerprint(
            source_container,
            source_user,
            source_db,
        )
    )

    print(
        "SOURCE_TABLE_COUNT_BEFORE="
        + str(
            len(
                source_tables_before
            )
        )
    )

    print(
        "SOURCE_DATA_FINGERPRINT_BEFORE="
        + source_fp_before
    )

    token = (
        uuid.uuid4().hex[:10]
    )

    network = (
        "taman-care-v79-p5b-"
        + token
        + "-net"
    )

    restore_container = (
        "taman-care-v79-p5b-"
        + token
        + "-postgres"
    )

    backup = (
        BACKUPS
        / (
            "TamAnCare-V7.9-Phase5B-"
            + token
            + ".dump"
        )
    )

    backup_created = False

    try:
        # Read-only snapshot for Phase 5B compatibility only.
        p = run([
            "docker",
            "exec",
            source_container,
            "pg_dump",
            "-U",
            source_user,
            "-d",
            source_db,
            "-Fc",
            "--no-owner",
            "--no-privileges",
        ])

        if p.returncode:
            raise RuntimeError(
                "Phase 5B read-only pg_dump failed\n"
                + p.stderr.decode(
                    "utf-8",
                    errors="ignore",
                )[-4000:]
            )

        backup.write_bytes(
            p.stdout
        )

        backup_created = True

        if (
            not backup.exists()
            or backup.stat().st_size <= 0
        ):
            raise RuntimeError(
                "Phase 5B snapshot empty"
            )

        backup_hash = (
            sha256(
                backup
            )
        )

        backup_size = (
            backup.stat().st_size
        )

        print(
            "PHASE5B_SNAPSHOT_MODE=READ_ONLY"
        )

        print(
            "PHASE5B_SNAPSHOT="
            + str(backup)
        )

        print(
            "PHASE5B_SNAPSHOT_SIZE="
            + str(backup_size)
        )

        print(
            "PHASE5B_SNAPSHOT_SHA256="
            + backup_hash
        )

        run([
            "docker",
            "network",
            "create",
            network,
        ], check=True)

        run([
            "docker",
            "run",
            "-d",
            "--name",
            restore_container,
            "--network",
            network,
            "-e",
            "POSTGRES_USER="
            + RESTORE_USER,
            "-e",
            "POSTGRES_PASSWORD="
            + RESTORE_PASSWORD,
            "-e",
            "POSTGRES_DB="
            + RESTORE_DB,
            POSTGRES_IMAGE,
        ], check=True)

        ready = False

        for i in range(
            1,
            31,
        ):
            p = run([
                "docker",
                "exec",
                restore_container,
                "pg_isready",
                "-U",
                RESTORE_USER,
                "-d",
                RESTORE_DB,
            ])

            if p.returncode == 0:
                print(
                    "RESTORE_DB_READY_"
                    + str(i)
                    + "=PASS"
                )

                ready = True
                break

            print(
                "RESTORE_DB_READY_"
                + str(i)
                + "=WAIT"
            )

            time.sleep(1)

        if not ready:
            raise RuntimeError(
                "Phase 5B disposable restore database not ready"
            )

        with backup.open(
            "rb"
        ) as fh:
            p = subprocess.run(
                [
                    "docker",
                    "exec",
                    "-i",
                    restore_container,
                    "pg_restore",
                    "-U",
                    RESTORE_USER,
                    "-d",
                    RESTORE_DB,
                    "--no-owner",
                    "--no-privileges",
                ],
                stdin=fh,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

        if p.returncode:
            raise RuntimeError(
                "Phase 5B pg_restore failed\n"
                + p.stderr.decode(
                    "utf-8",
                    errors="ignore",
                )[-4000:]
            )

        restored_tables = (
            public_tables(
                restore_container,
                RESTORE_USER,
                RESTORE_DB,
            )
        )

        if (
            restored_tables
            != source_tables_before
        ):
            raise RuntimeError(
                "restored table identity set differs from production"
            )

        print(
            "RESTORED_TABLE_SET_EQUIVALENT=YES"
        )

        count_diffs = []

        for table in (
            source_tables_before
        ):
            safe = table.replace(
                '"',
                '""',
            )

            prod_count = query(
                source_container,
                source_user,
                source_db,
                (
                    'SELECT count(*) '
                    f'FROM public."{safe}";'
                ),
            )[0]

            restore_count = query(
                restore_container,
                RESTORE_USER,
                RESTORE_DB,
                (
                    'SELECT count(*) '
                    f'FROM public."{safe}";'
                ),
            )[0]

            if (
                prod_count
                != restore_count
            ):
                count_diffs.append({
                    "table":
                        table,

                    "production":
                        prod_count,

                    "restored":
                        restore_count,
                })

        print(
            "RESTORED_ROW_COUNT_DIFF_TABLES="
            + str(
                len(
                    count_diffs
                )
            )
        )

        if count_diffs:
            for diff in count_diffs[:20]:
                print(
                    "RESTORE_COUNT_DIFF|"
                    + diff["table"]
                    + "|PROD="
                    + diff["production"]
                    + "|RESTORE="
                    + diff["restored"]
                )

            raise RuntimeError(
                "restored row counts do not match production snapshot baseline"
            )

        print(
            "PASS: RESTORED ROW COUNTS MATCH"
        )

        # Snapshot no longer needed once restored DB is accepted.
        safe_remove_file(
            backup
        )

        if backup.exists():
            raise RuntimeError(
                "Phase 5B temporary snapshot cleanup failed"
            )

        print(
            "PHASE5B_TEMP_SNAPSHOT_REMOVED=YES"
        )

        source_tables_after = (
            public_tables(
                source_container,
                source_user,
                source_db,
            )
        )

        source_fp_after = (
            database_fingerprint(
                source_container,
                source_user,
                source_db,
            )
        )

        if (
            source_tables_after
            != source_tables_before
        ):
            raise RuntimeError(
                "production table set changed during Phase 5B"
            )

        if (
            source_fp_after
            != source_fp_before
        ):
            raise RuntimeError(
                "production database changed during Phase 5B"
            )

        print(
            "PRODUCTION_DATABASE_DELTA=NO"
        )

        production_health()

        api_started_after = (
            container_started_at(
                API_CONTAINER
            )
        )

        api_image_after = (
            container_image(
                API_CONTAINER
            )
        )

        if (
            api_started_after
            != api_started_before
        ):
            raise RuntimeError(
                "production API restarted during Phase 5B"
            )

        if (
            api_image_after
            != api_image_before
        ):
            raise RuntimeError(
                "production API image changed during Phase 5B"
            )

        print(
            "PRODUCTION_RUNTIME_RESTART=NO"
        )

        print(
            "PRODUCTION_IMAGE_CHANGE=NO"
        )

        # Handoff compatibility runtime to Phase 5 Final.
        state["phase5_restore_container"] = (
            restore_container
        )

        state["phase5_restore_network"] = (
            network
        )

        state["status"] = "READY"

        state["completed"] = [
            "PHASE_5A",
            "PHASE_5B",
        ]

        state["failed_gate"] = None
        state["reason"] = None

        state["next_gate"] = (
            "PHASE_5_FINAL"
        )

        manifest_data = {
            "version":
                "V7.9",

            "series":
                "06",

            "phase":
                "5B",

            "status":
                "PASSED",

            "decision":
                "RESTORED_DATA_INTEGRITY_ACCEPTED",

            "compatibility_runtime_reconstruction":
                True,

            "phase5a_rerun":
                False,

            "snapshot_mode":
                "READ_ONLY",

            "snapshot_sha256":
                backup_hash,

            "snapshot_size":
                backup_size,

            "snapshot_removed":
                True,

            "table_set_equivalent":
                True,

            "row_count_difference_tables":
                0,

            "production_database_delta":
                False,

            "production_runtime_restart":
                False,

            "production_image_change":
                False,

            "restore_container":
                restore_container,

            "restore_network":
                network,

            "restore_container_kept_for":
                "PHASE_5_FINAL",

            "next":
                "PHASE_5_FINAL",
        }

        MANIFEST.write_text(
            json.dumps(
                manifest_data,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        RESULT.write_text(
            "\n".join([
                "TAM AN CARE V7.9",
                "SERIES=06",
                "PHASE=5B",
                "STATUS=PASSED",
                "DECISION=RESTORED_DATA_INTEGRITY_ACCEPTED",
                "PHASE5A_RERUN=NO",
                "COMPATIBILITY_RUNTIME_RECONSTRUCTION=YES",
                "PHASE5B_SNAPSHOT_MODE=READ_ONLY",
                "PHASE5B_SNAPSHOT_SHA256="
                + backup_hash,
                "PHASE5B_SNAPSHOT_SIZE="
                + str(
                    backup_size
                ),
                "PHASE5B_TEMP_SNAPSHOT_REMOVED=YES",
                "RESTORED_TABLE_SET_EQUIVALENT=YES",
                "RESTORED_ROW_COUNT_DIFF_TABLES=0",
                "PRODUCTION_DATABASE_DELTA=NO",
                "PRODUCTION_RUNTIME_RESTART=NO",
                "PRODUCTION_IMAGE_CHANGE=NO",
                "RESTORE_CONTAINER="
                + restore_container,
                "RESTORE_NETWORK="
                + network,
                "RESTORE_CONTAINER_KEEP_FOR_PHASE_5_FINAL=YES",
                "NEXT=PHASE_5_FINAL",
            ])
            + "\n",
            encoding="utf-8",
        )

        save_state(
            state
        )

        print(
            "PHASE5B_RESULT_SHA256="
            + sha256(
                RESULT
            )
        )

        print(
            "PHASE5B_MANIFEST_SHA256="
            + sha256(
                MANIFEST
            )
        )

        print(
            "PHASE5B_RESTORE_CONTAINER="
            + restore_container
        )

        print(
            "PHASE5B_RESTORE_NETWORK="
            + network
        )

        print(
            "PASS: PHASE 5B CLOSED"
        )

        print(
            "NEXT_GATE=PHASE_5_FINAL"
        )

        return 0

    except Exception as exc:
        stop_safely(
            state,
            str(exc),
            backup=(
                backup
                if backup_created
                else None
            ),
            restore_container=
                restore_container,
            network=
                network,
        )


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
