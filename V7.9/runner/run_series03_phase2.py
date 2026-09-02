from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path.cwd()
V79 = ROOT / "V7.9"
SRC = V79 / "workspace" / "api" / "src"
SCHEMA = ROOT / "database" / "schema.sql"

RESULTS = V79 / "results"
MANIFESTS = V79 / "manifests"
STATE_DIR = V79 / "state"
INVENTORY = V79 / "inventory"

STATE_FILE = STATE_DIR / "series03_phase2_state.json"

PHASE1_FINAL_RESULT_HASH = (
    "dae2d01839384b0fa51bd41687286f6d014d3266223b69bd230bba2973bc09a1"
)

PHASE1_FINAL_MANIFEST_HASH = (
    "8cd82b190ac09749c648a6920e1eb9c0a4258434a01052f5e04a9d73c35071f9"
)

PHASE2_PREFLIGHT_RESULT_HASH = (
    "de9c5f608f9572ed80147717ce18341d814669da555a65072de4269d4517c9bb"
)

PHASE2_PREFLIGHT_MANIFEST_HASH = (
    "b141ab143e8f5797ca31fc616a5ef3425f43c4428d496d401ade9b40c892c40e"
)

GATES = [
    "PHASE_2A",
    "PHASE_2B",
    "PHASE_2C",
    "PHASE_2D",
    "PHASE_2_FINAL",
]

def now():
    return datetime.now(
        timezone.utc
    ).isoformat()

def sha256(path):
    return hashlib.sha256(
        Path(path).read_bytes()
    ).hexdigest()

def banner(text):
    print()
    print("=" * 118)
    print(" " + text)
    print("=" * 118)
    print()

def run(cmd):
    return subprocess.run(
        cmd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

def curl_code(url):
    r = run([
        "curl",
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        url,
    ])

    if r.returncode:
        return "000"

    return r.stdout.strip()

def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(
                STATE_FILE.read_text(
                    encoding="utf-8"
                )
            )
        except Exception:
            pass

    return {
        "version": "V7.9",
        "series": "03",
        "phase": "2_RESIDENT_MANAGEMENT",
        "status": "RUNNING",
        "started_at": now(),
        "completed": [],
    }

STATE = load_state()

def save_state():
    STATE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    STATE_FILE.write_text(
        json.dumps(
            STATE,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

def completed(gate):
    return gate in STATE.get(
        "completed",
        []
    )

def mark_completed(gate):
    if gate not in STATE["completed"]:
        STATE["completed"].append(
            gate
        )

    STATE["status"] = "RUNNING"
    STATE["last_completed"] = gate
    STATE["updated_at"] = now()
    save_state()

def production_guard():
    values = {
        "api_health":
            curl_code(
                "http://127.0.0.1:3100/api/health"
            ),

        "ui_health":
            curl_code(
                "http://127.0.0.1:8080/api/health"
            ),

        "staff_no_actor":
            curl_code(
                "http://127.0.0.1:3100/api/operations/staff-actors"
            ),

        "access_no_actor":
            curl_code(
                "http://127.0.0.1:3100/api/operations/access-assignments"
            ),
    }

    print(
        "PRODUCTION_API_HEALTH="
        + values["api_health"]
    )

    print(
        "PRODUCTION_UI_HEALTH="
        + values["ui_health"]
    )

    print(
        "STAFF_NO_ACTOR="
        + values["staff_no_actor"]
    )

    print(
        "ACCESS_NO_ACTOR="
        + values["access_no_actor"]
    )

    if values != {
        "api_health": "200",
        "ui_health": "200",
        "staff_no_actor": "401",
        "access_no_actor": "401",
    }:
        raise RuntimeError(
            "production protection contract failed"
        )

    return values

def db_fingerprint():
    candidates = []

    for p in ROOT.rglob("*.txt"):
        try:
            text = p.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except Exception:
            continue

        if (
            "7c1156b0bd562d03181259d6102412340"
            "f4ecbbb752b4eb427fd92cdc1864639"
            in text
        ):
            candidates.append(
                str(p)
            )

    print(
        "HISTORICAL_DB_FINGERPRINT_REFERENCE_COUNT="
        + str(len(candidates))
    )

def locate_by_hash(
    expected,
    suffixes,
):
    matches = []

    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue

        if p.suffix not in suffixes:
            continue

        try:
            h = sha256(p)
        except Exception:
            continue

        if h == expected:
            matches.append(p)

    return matches

def lock_required_artifact(
    label,
    expected,
    suffixes,
):
    matches = locate_by_hash(
        expected,
        suffixes,
    )

    print(
        label
        + "_MATCH_COUNT="
        + str(len(matches))
    )

    for p in matches:
        print(
            label
            + "="
            + str(p)
            + "|SHA256="
            + expected
        )

    if len(matches) != 1:
        raise RuntimeError(
            label
            + " exact accepted artifact unresolved"
        )

    return matches[0]

def write_evidence(
    gate,
    name,
    data,
):
    RESULTS.mkdir(
        parents=True,
        exist_ok=True,
    )

    MANIFESTS.mkdir(
        parents=True,
        exist_ok=True,
    )

    result = (
        RESULTS
        / f"V7.9-{gate}-{name}-RESULT.txt"
    )

    manifest = (
        MANIFESTS
        / f"V7.9-{gate}-{name}.json"
    )

    result_lines = [
        "TAM AN CARE V7.9",
        "SERIES=03",
        "PHASE=2_RESIDENT_MANAGEMENT",
        f"GATE={gate}",
        "STATUS=PASSED",
    ]

    for key, value in data.items():
        if isinstance(
            value,
            (
                dict,
                list,
            ),
        ):
            value = json.dumps(
                value,
                sort_keys=True,
            )

        result_lines.append(
            str(key).upper()
            + "="
            + str(value)
        )

    result.write_text(
        "\n".join(
            result_lines
        )
        + "\n",
        encoding="utf-8",
    )

    manifest_data = {
        "version": "V7.9",
        "series": "03",
        "phase": "2_RESIDENT_MANAGEMENT",
        "gate": gate,
        "status": "PASSED",
        "created_at": now(),
        **data,
    }

    manifest.write_text(
        json.dumps(
            manifest_data,
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    rh = sha256(result)
    mh = sha256(manifest)

    print(
        gate
        + "_RESULT_HASH="
        + rh
    )

    print(
        gate
        + "_MANIFEST_HASH="
        + mh
    )

    return {
        "result": str(result),
        "result_hash": rh,
        "manifest": str(manifest),
        "manifest_hash": mh,
    }

def safe_stop(
    gate,
    reason,
):
    STATE["status"] = (
        "STOPPED_SAFELY"
    )

    STATE["failed_gate"] = gate
    STATE["reason"] = reason
    STATE["stopped_at"] = now()
    save_state()

    banner(
        "TAM AN CARE V7.9 SERIES 03 STOPPED SAFELY"
    )

    print(
        "GATE="
        + gate
    )

    print(
        "REASON="
        + reason
    )

    print()
    print(
        "PRODUCTION_DATABASE_MUTATION=NO"
    )
    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )
    print(
        "REAL_RESIDENT_MUTATION=NO"
    )
    print(
        "FROZEN_V7.7_SOURCE_WRITE=NO"
    )
    print(
        "V7.6_ROLLBACK_DELETE=NO"
    )

    print()
    print(
        "DO NOT RERUN ACCEPTED SERIES 02 / PHASE 1."
    )
    print(
        "DO NOT RERUN ACCEPTED SERIES 03 GATES."
    )
    print(
        "RECOVER ONLY THIS FAILED GATE."
    )
    print()
    print(
        "SEND THIS ENTIRE OUTPUT BACK."
    )

    sys.exit(1)

def parse_controller_routes():
    routes = []

    controller_pattern = re.compile(
        r'@Controller\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
    )

    method_pattern = re.compile(
        r'@(Get|Post|Put|Patch|Delete)'
        r'\(\s*(?:[\'"]([^\'"]*)[\'"])?\s*\)'
    )

    for p in SRC.rglob(
        "*controller.ts"
    ):
        text = p.read_text(
            encoding="utf-8",
            errors="ignore",
        )

        cm = controller_pattern.search(
            text
        )

        if not cm:
            continue

        base = cm.group(1).strip("/")

        for mm in method_pattern.finditer(
            text
        ):
            method = (
                mm.group(1)
                .upper()
            )

            sub = (
                mm.group(2)
                or ""
            ).strip("/")

            path = (
                "/"
                + base
                + (
                    "/"
                    + sub
                    if sub
                    else ""
                )
            )

            window = text[
                mm.start():
                min(
                    len(text),
                    mm.start()
                    + 2200,
                )
            ]

            routes.append({
                "method": method,
                "path": path,
                "file": str(
                    p.relative_to(
                        ROOT
                    )
                ),
                "resident_signal":
                    "resident" in window.lower(),
                "body_signal":
                    "@Body" in window,
                "actor_signal":
                    (
                        "x-actor-id"
                        in window.lower()
                        or
                        "x-actor-role"
                        in window.lower()
                    ),
            })

    return routes

def extract_residents_schema():
    text = SCHEMA.read_text(
        encoding="utf-8",
        errors="ignore",
    )

    m = re.search(
        r'CREATE\s+TABLE'
        r'(?:\s+IF\s+NOT\s+EXISTS)?'
        r'\s+residents\s*\(',
        text,
        re.I,
    )

    if not m:
        raise RuntimeError(
            "residents schema unresolved"
        )

    start = text.find(
        "(",
        m.start(),
    )

    depth = 0
    end = None

    for i in range(
        start,
        len(text),
    ):
        if text[i] == "(":
            depth += 1

        elif text[i] == ")":
            depth -= 1

            if depth == 0:
                end = i
                break

    if end is None:
        raise RuntimeError(
            "residents schema incomplete"
        )

    return text[
        start + 1:
        end
    ]

def gate_2a():
    gate = "PHASE_2A"

    if completed(gate):
        print(
            "SKIP_ALREADY_ACCEPTED_"
            + gate
            + "=YES"
        )
        return

    banner(
        "V7.9 PHASE 2A — RESIDENT MANAGEMENT SOURCE / ROUTE DISCOVERY"
    )

    production_guard()

    if not SRC.exists():
        safe_stop(
            gate,
            "V7.9 API workspace source absent",
        )

    routes = parse_controller_routes()

    resident_routes = [
        r
        for r in routes
        if (
            "resident"
            in r["path"].lower()
            or
            "resident"
            in r["file"].lower()
            or
            r["resident_signal"]
        )
    ]

    print(
        "TOTAL_CONTROLLER_ROUTE_COUNT="
        + str(len(routes))
    )

    print(
        "RESIDENT_ROUTE_COUNT="
        + str(len(resident_routes))
    )

    for r in resident_routes:
        print(
            "RESIDENT_ROUTE|"
            + r["method"]
            + "|"
            + r["path"]
            + "|"
            + r["file"]
        )

    if not resident_routes:
        safe_stop(
            gate,
            "no resident management HTTP contract discovered",
        )

    inv = (
        INVENTORY
        / "V7.9-PHASE-2A-RESIDENT-ROUTE-INVENTORY.json"
    )

    INVENTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    inv.write_text(
        json.dumps(
            resident_routes,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    data = {
        "resident_route_count":
            len(resident_routes),

        "inventory":
            str(inv),

        "inventory_sha256":
            sha256(inv),

        "production_mutation":
            "NO",

        "runtime_restart":
            "NO",
    }

    write_evidence(
        gate,
        "RESIDENT-ROUTE-DISCOVERY",
        data,
    )

    mark_completed(gate)

    print(
        "PASS: PHASE_2A"
    )

def gate_2b():
    gate = "PHASE_2B"

    if completed(gate):
        print(
            "SKIP_ALREADY_ACCEPTED_"
            + gate
            + "=YES"
        )
        return

    banner(
        "V7.9 PHASE 2B — RESIDENT SCHEMA + FAIL-CLOSED CONTRACT"
    )

    production_guard()

    if not SCHEMA.exists():
        safe_stop(
            gate,
            "database/schema.sql absent",
        )

    schema = extract_residents_schema()

    required_tokens = [
        "resident_id",
        "resident_code",
        "display_name",
        "date_of_birth",
        "gender",
        "care_level",
        "active_status",
    ]

    missing = [
        token
        for token
        in required_tokens
        if token.lower()
        not in schema.lower()
    ]

    for token in required_tokens:
        print(
            "RESIDENT_SCHEMA_SIGNAL|"
            + token
            + "|"
            + (
                "YES"
                if token not in missing
                else "NO"
            )
        )

    if missing:
        safe_stop(
            gate,
            "resident schema contract incomplete: "
            + ",".join(
                missing
            ),
        )

    routes = parse_controller_routes()

    resident_routes = [
        r
        for r in routes
        if (
            "resident"
            in r["path"].lower()
            or
            "resident"
            in r["file"].lower()
            or
            r["resident_signal"]
        )
    ]

    actor_routes = [
        r
        for r in resident_routes
        if r["actor_signal"]
    ]

    print(
        "RESIDENT_ACTOR_AWARE_ROUTE_COUNT="
        + str(len(actor_routes))
    )

    data = {
        "schema_required_fields":
            required_tokens,

        "schema_missing_fields":
            missing,

        "resident_actor_aware_route_count":
            len(actor_routes),

        "production_mutation":
            "NO",

        "runtime_restart":
            "NO",
    }

    write_evidence(
        gate,
        "RESIDENT-SCHEMA-AUTH-CONTRACT",
        data,
    )

    mark_completed(gate)

    print(
        "PASS: PHASE_2B"
    )

def gate_2c():
    gate = "PHASE_2C"

    if completed(gate):
        print(
            "SKIP_ALREADY_ACCEPTED_"
            + gate
            + "=YES"
        )
        return

    banner(
        "V7.9 PHASE 2C — RESIDENT WRITE WORKFLOW CONTRACT DISCOVERY"
    )

    production_guard()

    routes = parse_controller_routes()

    write_routes = [
        r
        for r in routes
        if (
            r["method"]
            in (
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
            )
            and
            (
                "resident"
                in r["path"].lower()
                or
                "resident"
                in r["file"].lower()
            )
        )
    ]

    print(
        "RESIDENT_WRITE_ROUTE_COUNT="
        + str(len(write_routes))
    )

    for r in write_routes:
        print(
            "RESIDENT_WRITE_ROUTE|"
            + r["method"]
            + "|"
            + r["path"]
            + "|BODY="
            + (
                "YES"
                if r["body_signal"]
                else "NO"
            )
            + "|ACTOR="
            + (
                "YES"
                if r["actor_signal"]
                else "NO"
            )
            + "|FILE="
            + r["file"]
        )

    inv = (
        INVENTORY
        / "V7.9-PHASE-2C-RESIDENT-WRITE-CONTRACT.json"
    )

    inv.write_text(
        json.dumps(
            write_routes,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    if not write_routes:
        safe_stop(
            gate,
            "no source-proven resident write route found",
        )

    body_routes = [
        r
        for r in write_routes
        if r["body_signal"]
    ]

    if not body_routes:
        safe_stop(
            gate,
            "resident write route exists but exact request body contract unresolved",
        )

    data = {
        "resident_write_route_count":
            len(write_routes),

        "body_aware_write_route_count":
            len(body_routes),

        "inventory":
            str(inv),

        "inventory_sha256":
            sha256(inv),

        "disposable_mutation_executed":
            "NO",

        "reason":
            "exact DTO/payload and authorization adapter must be proven before mutation",
    }

    result = write_evidence(
        gate,
        "RESIDENT-WRITE-CONTRACT-PREFLIGHT",
        data,
    )

    STATE["phase2c_preflight"] = (
        result
    )

    save_state()

    safe_stop(
        gate,
        "resident write routes discovered; disposable mutation adapter requires exact DTO/authorization recovery before execution",
    )

def gate_2d():
    gate = "PHASE_2D"

    if completed(gate):
        print(
            "SKIP_ALREADY_ACCEPTED_"
            + gate
            + "=YES"
        )
        return

    safe_stop(
        gate,
        "Phase 2D is not authorized until Phase 2C disposable resident workflow passes",
    )

def gate_final():
    gate = "PHASE_2_FINAL"

    if completed(gate):
        print(
            "SKIP_ALREADY_ACCEPTED_"
            + gate
            + "=YES"
        )
        return

    required = [
        "PHASE_2A",
        "PHASE_2B",
        "PHASE_2C",
        "PHASE_2D",
    ]

    missing = [
        x
        for x in required
        if not completed(x)
    ]

    if missing:
        safe_stop(
            gate,
            "cannot close Phase 2; missing accepted gates: "
            + ",".join(
                missing
            ),
        )

    production_guard()

    data = {
        "phase2_decision":
            "RESIDENT_MANAGEMENT_ACCEPTED",

        "production_mutation":
            "NO",

        "runtime_restart":
            "NO",
    }

    write_evidence(
        gate,
        "RESIDENT-MANAGEMENT-FINAL",
        data,
    )

    mark_completed(gate)

    STATE["status"] = "PASSED"
    STATE["closed_at"] = now()
    save_state()

    print(
        "PASS: PHASE_2_FINAL"
    )

def main():
    banner(
        "TAM AN CARE V7.9 — SERIES 03 MASTER EXECUTION"
    )

    print(
        "PHASE=2_RESIDENT_MANAGEMENT"
    )

    print(
        "GATES=2A->2B->2C->2D->2_FINAL"
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
        "REAL_RESIDENT_MUTATION=NO"
    )

    print(
        "PRODUCTION_DATABASE_MUTATION=NO"
    )

    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )

    print(
        "FROZEN_V7.7_SOURCE_WRITE=NO"
    )

    print(
        "DISPOSABLE_MUTATION_ONLY=YES"
    )

    if not SRC.exists():
        safe_stop(
            "SERIES_03_PREFLIGHT",
            "V7.9 workspace/api/src absent",
        )

    lock_required_artifact(
        "PHASE1_FINAL_RESULT",
        PHASE1_FINAL_RESULT_HASH,
        {".txt"},
    )

    lock_required_artifact(
        "PHASE1_FINAL_MANIFEST",
        PHASE1_FINAL_MANIFEST_HASH,
        {".json"},
    )

    lock_required_artifact(
        "PHASE2_PREFLIGHT_RESULT",
        PHASE2_PREFLIGHT_RESULT_HASH,
        {".txt"},
    )

    lock_required_artifact(
        "PHASE2_PREFLIGHT_MANIFEST",
        PHASE2_PREFLIGHT_MANIFEST_HASH,
        {".json"},
    )

    production_guard()
    db_fingerprint()

    print(
        "PASS: SERIES 03 STARTING CHECKPOINT LOCKED"
    )

    gate_2a()
    gate_2b()
    gate_2c()
    gate_2d()
    gate_final()

    banner(
        "STATUS: TAM AN CARE V7.9 SERIES 03 PASSED"
    )

if __name__ == "__main__":
    try:
        main()

    except RuntimeError as exc:
        safe_stop(
            STATE.get(
                "failed_gate",
                "SERIES_03_PREFLIGHT",
            ),
            str(exc),
        )
