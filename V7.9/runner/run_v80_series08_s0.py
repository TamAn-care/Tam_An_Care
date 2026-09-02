from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(
    "/Users/anhha/Downloads/"
    "TamAnCare_V7_4_3_Development"
)

V79 = ROOT / "V7.9"
V80 = ROOT / "V8.0"

FRONTEND_SRC = ROOT / "V7.7/workspace/frontend"
API_SRC = V79 / "workspace/api"
SCHEMA_SRC = ROOT / "database/schema.sql"

FRONTEND_DST = V80 / "workspace/frontend"
API_DST = V80 / "workspace/api"
SCHEMA_DST = V80 / "database/schema.sql"

STATE = V80 / "state/series08_s0_state.json"
RESULT = V80 / "results/V8.0-S0-INITIALIZATION-RESULT.txt"
MANIFEST = V80 / "manifests/V8.0-S0-INITIALIZATION.json"


def sha_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def sha_tree(root: Path) -> str:
    h = hashlib.sha256()

    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue

        if "node_modules" in p.parts:
            continue

        if "dist" in p.parts:
            continue

        if "coverage" in p.parts:
            continue

        rel = str(p.relative_to(root)).encode()

        h.update(rel)
        h.update(b"\0")
        h.update(p.read_bytes())
        h.update(b"\0")

    return h.hexdigest()


def copy_tree_controlled(src: Path, dst: Path) -> None:
    shutil.copytree(
        src,
        dst,
        ignore=shutil.ignore_patterns(
            "node_modules",
            "dist",
            "coverage",
            "*.log",
        ),
    )


def runtime_state(container: str) -> str:
    return subprocess.check_output(
        [
            "docker",
            "inspect",
            "-f",
            "{{.State.Status}}",
            container,
        ],
        text=True,
    ).strip()


def main() -> None:
    if V80.exists():
        raise SystemExit(
            "SAFE STOP: V8.0 already exists"
        )

    if runtime_state(
        "taman-care-v77-production-api"
    ) != "running":
        raise SystemExit(
            "SAFE STOP: production API not running"
        )

    if runtime_state(
        "taman-care-v77-production-ui"
    ) != "running":
        raise SystemExit(
            "SAFE STOP: production UI not running"
        )

    expected_frontend = sha_tree(FRONTEND_SRC)
    expected_api = sha_tree(API_SRC)
    expected_schema = sha_file(SCHEMA_SRC)

    V80.mkdir()

    for d in [
        V80 / "workspace",
        V80 / "database",
        V80 / "runner",
        V80 / "state",
        V80 / "results",
        V80 / "manifests",
        V80 / "preflight",
        V80 / "freeze",
        V80 / "backups",
    ]:
        d.mkdir(parents=True, exist_ok=True)

    copy_tree_controlled(
        FRONTEND_SRC,
        FRONTEND_DST,
    )

    copy_tree_controlled(
        API_SRC,
        API_DST,
    )

    shutil.copy2(
        SCHEMA_SRC,
        SCHEMA_DST,
    )

    frontend_hash = sha_tree(FRONTEND_DST)
    api_hash = sha_tree(API_DST)
    schema_hash = sha_file(SCHEMA_DST)

    if frontend_hash != expected_frontend:
        raise SystemExit(
            "FAIL: frontend clone hash mismatch"
        )

    if api_hash != expected_api:
        raise SystemExit(
            "FAIL: api clone hash mismatch"
        )

    if schema_hash != expected_schema:
        raise SystemExit(
            "FAIL: schema clone hash mismatch"
        )

    state = {
        "version": "V8.0",
        "series": "SERIES_08",
        "status": "READY",
        "completed": ["S0"],
        "failed_gate": None,
        "next_gate": "S1",
        "manual_gate": {
            "gate": "S8",
            "status": "DEFERRED_NOT_PASSED",
            "owner": "USER",
        },
    }

    STATE.write_text(
        json.dumps(
            state,
            indent=2
        ) + "\n",
        encoding="utf-8",
    )

    manifest = {
        "version": "V8.0",
        "gate": "S0",
        "status": "PASSED",
        "decision":
            "V8_0_CONTROLLED_WORKSPACE_INITIALIZED",

        "parent": "V7.9",

        "frontend_source":
            "V7.7/workspace/frontend",

        "api_source":
            "V7.9/workspace/api",

        "schema_source":
            "database/schema.sql",

        "frontend_sha256":
            frontend_hash,

        "api_sha256":
            api_hash,

        "schema_sha256":
            schema_hash,

        "production_database_mutation":
            False,

        "production_runtime_restart":
            False,

        "next_gate":
            "S1",

        "created_at":
            datetime.now(
                timezone.utc
            ).isoformat(),
    }

    MANIFEST.write_text(
        json.dumps(
            manifest,
            indent=2
        ) + "\n",
        encoding="utf-8",
    )

    RESULT.write_text(
        "\n".join([
            "TAM AN CARE V8.0",
            "PHASE=S0",
            "STATUS=PASSED",
            "DECISION=V8_0_CONTROLLED_WORKSPACE_INITIALIZED",
            "SERIES=SERIES_08",
            "PARENT=V7.9",
            "FRONTEND_CLONE=PASSED",
            "API_CLONE=PASSED",
            "SCHEMA_CLONE=PASSED",
            "PRODUCTION_DATABASE_MUTATION=NO",
            "PRODUCTION_RUNTIME_RESTART=NO",
            "S8_MANUAL_TEST_STATUS=DEFERRED_NOT_PASSED",
            "NEXT_GATE=S1",
        ]) + "\n",
        encoding="utf-8",
    )

    print(
        "V80_FRONTEND_SHA256="
        + frontend_hash
    )

    print(
        "V80_API_SHA256="
        + api_hash
    )

    print(
        "V80_SCHEMA_SHA256="
        + schema_hash
    )

    print(
        "S0_RESULT_SHA256="
        + sha_file(RESULT)
    )

    print(
        "S0_MANIFEST_SHA256="
        + sha_file(MANIFEST)
    )

    print(
        "SERIES08_STATE_SHA256="
        + sha_file(STATE)
    )

    print("PASS: V8.0 S0 INITIALIZATION CLOSED")
    print("NEXT_GATE=S1")


if __name__ == "__main__":
    main()
