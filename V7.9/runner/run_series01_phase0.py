from pathlib import Path
from datetime import datetime, timezone
import subprocess
import hashlib
import json
import re
import sys

ROOT = Path("/Users/anhha/Downloads/TamAnCare_V7_4_3_Development")
V77 = ROOT / "V7.7"
V78 = ROOT / "V7.8"
V79 = ROOT / "V7.9"

RUNNER = V79 / "runner"
RESULTS = V79 / "results"
MANIFESTS = V79 / "manifests"
INVENTORY = V79 / "inventory"
PREFLIGHT = V79 / "preflight"
TMP = V79 / "tmp"

for d in [RUNNER, RESULTS, MANIFESTS, INVENTORY, PREFLIGHT, TMP]:
    d.mkdir(parents=True, exist_ok=True)

STATE_FILE = V79 / "V7.9-SERIES-01-EXECUTION-STATE.json"

EXPECTED = {
    "v78_final_result":
        "f1e9481851f8fc91fb0e249f174284a03befc1c7f4c56720a3cc7d803094b758",

    "v78_final_manifest":
        "0b5899596a6bae75eacf3fe7bf8a06c72dbf18fb6dbe536e168d8123b37bf14f",

    "frozen_source":
        "bd68dcede4144c46dbb1633bd19af422ac58df2b492a62cc7a460c2db93ebac7",

    "db_tables": 118,

    "db_fingerprint":
        "7c1156b0bd562d03181259d6102412340f4ecbbb752b4eb427fd92cdc1864639",

    "api_image":
        "sha256:36b1511ed4b4872bb6ff1a669c19a0a6e245d9e649277b5db01ec433964ef4b7",

    "ui_image":
        "sha256:53bf7afecf93a6a29cb984ac20464cc82c72789bffe6f3d977a1f56731a85147",

    "db_image":
        "sha256:e17e86066e5ef83e0952a9347f5c792b7ece00972e2aa787a6986f471b3dd3d5",
}

API_BASE = "http://127.0.0.1:3100"
UI_BASE = "http://127.0.0.1:8080"

DB_USER = "taman_v743_dev"
DB_NAME = "taman_care_v743_dev"

KNOWN_API_NAMES = [
    "taman-care-v77-production-api",
]

KNOWN_UI_NAMES = [
    "taman-care-v77-production-ui",
]

KNOWN_DB_NAMES = [
    "taman-care-v743-dev-postgres",
]

IGNORED_SOURCE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
}

SOURCE_EXTENSIONS = {
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


def now():
    return datetime.now(timezone.utc).isoformat()


def run(cmd, cwd=None, input_text=None):
    return subprocess.run(
        cmd,
        cwd=cwd,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def banner(text):
    print()
    print("=" * 212)
    print(" " + text)
    print("=" * 212)


def save_state():
    STATE_FILE.write_text(
        json.dumps(
            STATE,
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )


if STATE_FILE.is_file():
    try:
        STATE = json.loads(
            STATE_FILE.read_text(encoding="utf-8")
        )
        print("RESUME_STATE_LOADED=YES")
        print(
            "RESUME_PRIOR_STATUS="
            + str(STATE.get("status", "<UNKNOWN>"))
        )
        STATE["status"] = "RUNNING"
        STATE["resumed_at"] = now()
    except Exception as e:
        print("FAIL: CANNOT LOAD V7.9 EXECUTION STATE")
        print(str(e))
        sys.exit(1)
else:
    STATE = {
        "version": "V7.9",
        "series": "01",
        "roadmap": "APPLICATION_COMPLETION_REAL_OPERATIONAL_READINESS",
        "started_at": now(),
        "parent_release": "V7.8_FINAL_OPERATIONAL_RELEASE_FROZEN",
        "completed": [],
        "status": "RUNNING",
    }

save_state()


def safe_stop(gate, reason):
    STATE["status"] = "STOPPED_SAFELY"
    STATE["failed_gate"] = gate
    STATE["reason"] = reason
    STATE["stopped_at"] = now()
    save_state()

    banner("TAM AN CARE V7.9 SERIES 01 STOPPED SAFELY")

    print(f"GATE={gate}")
    print(f"REASON={reason}")
    print()
    print("PRODUCTION_DATABASE_WRITE=NO")
    print("PRODUCTION_SCHEMA_CHANGE=NO")
    print("PRODUCTION_RUNTIME_RESTART=NO")
    print("FROZEN_PARENT_SOURCE_WRITE=NO")
    print("V7.6_ROLLBACK_ASSET_DELETE=NO")
    print()
    print("PASSED GATES MUST NOT BE RERUN.")
    print("RESUME FROM THIS EXACT GATE.")
    print()
    print("SEND THIS ENTIRE OUTPUT BACK.")

    sys.exit(1)


def completed_entry(gate):
    for item in STATE.get("completed", []):
        if item.get("gate") == gate:
            return item
    return None


def maybe_skip(gate):
    item = completed_entry(gate)

    if not item:
        return False

    result = item.get("result")
    manifest = item.get("manifest")

    if result:
        p = Path(result)
        if not p.is_file():
            safe_stop(gate, "accepted result artifact missing")

        if sha(p) != item.get("result_hash"):
            safe_stop(gate, "accepted result artifact hash changed")

    if manifest:
        p = Path(manifest)
        if not p.is_file():
            safe_stop(gate, "accepted manifest artifact missing")

        if sha(p) != item.get("manifest_hash"):
            safe_stop(gate, "accepted manifest artifact hash changed")

    print()
    print(f"SKIP_ALREADY_ACCEPTED_{gate}=YES")
    print(f"PASS: {gate} ACCEPTED EVIDENCE PRESERVED")
    return True


def complete_gate(gate, result_path, manifest_path):
    entry = {
        "gate": gate,
        "completed_at": now(),
        "result": str(result_path),
        "result_hash": sha(result_path),
        "manifest": str(manifest_path),
        "manifest_hash": sha(manifest_path),
    }

    STATE.setdefault("completed", []).append(entry)
    save_state()

    print()
    print(f"{gate}_RESULT_HASH={entry['result_hash']}")
    print(f"{gate}_MANIFEST_HASH={entry['manifest_hash']}")
    print(f"PASS: {gate}")


def locate_by_hash(search_root, expected_hash):
    matches = []

    for p in search_root.rglob("*"):
        if not p.is_file():
            continue

        try:
            if sha(p) == expected_hash:
                matches.append(p)
        except Exception:
            pass

    return matches


def inspect_container(name):
    r = run(["docker", "inspect", name])

    if r.returncode != 0:
        return None

    try:
        return json.loads(r.stdout)[0]
    except Exception:
        return None


def all_container_infos():
    r = run([
        "docker",
        "ps",
        "-aq",
        "--no-trunc",
    ])

    if r.returncode != 0:
        return []

    infos = []

    for cid in [
        x.strip()
        for x in r.stdout.splitlines()
        if x.strip()
    ]:
        i = inspect_container(cid)
        if i:
            infos.append(i)

    return infos


def resolve_container(known_names, expected_image, required_state=None):
    for name in known_names:
        info = inspect_container(name)

        if not info:
            continue

        if info.get("Image") != expected_image:
            continue

        state = info.get("State", {}).get("Status")

        if required_state and state != required_state:
            continue

        return info

    for info in all_container_infos():
        if info.get("Image") != expected_image:
            continue

        state = info.get("State", {}).get("Status")

        if required_state and state != required_state:
            continue

        return info

    return None


def cname(info):
    return info.get("Name", "").lstrip("/")


def cstate(info):
    return info.get("State", {}).get("Status", "<UNKNOWN>")


def source_hash(root):
    if not root.exists():
        raise RuntimeError(f"source root missing: {root}")

    data = {}

    for p in root.rglob("*"):
        if not p.is_file():
            continue

        if any(part in IGNORED_SOURCE_DIRS for part in p.parts):
            continue

        if p.name.endswith(".tsbuildinfo"):
            continue

        if p.suffix.lower() not in SOURCE_EXTENSIONS:
            continue

        data[str(p.relative_to(root))] = sha(p)

    raw = json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()

    return hashlib.sha256(raw).hexdigest()


def curl_code(url, method="GET", body=None):
    cmd = [
        "curl",
        "-sS",
        "--max-time", "6",
        "-o", "/dev/null",
        "-w", "%{http_code}",
    ]

    if method != "GET":
        cmd += ["-X", method]

    if body is not None:
        cmd += [
            "-H", "Content-Type: application/json",
            "--data", body,
        ]

    cmd.append(url)

    r = run(cmd)

    if r.returncode != 0 and not r.stdout.strip():
        return "000"

    return r.stdout.strip()


def prod_query(sql):
    r = run([
        "docker",
        "exec",
        DB_CONTAINER,
        "psql",
        "-X",
        "-v", "ON_ERROR_STOP=1",
        "-U", DB_USER,
        "-d", DB_NAME,
        "-At",
        "-c",
        "BEGIN READ ONLY;\n"
        + sql
        + "\nROLLBACK;",
    ])

    if r.returncode != 0:
        raise RuntimeError(r.stdout[-5000:])

    return [
        line.strip()
        for line in r.stdout.splitlines()
        if line.strip()
        and line.strip() not in {"BEGIN", "ROLLBACK"}
    ]


def database_fingerprint():
    tables = prod_query("""
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
AND table_type='BASE TABLE'
ORDER BY table_name;
""")

    canonical = []

    for table in tables:
        safe = table.replace('"', '""')

        count = prod_query(
            f'SELECT count(*) FROM public."{safe}";'
        )

        if len(count) != 1:
            raise RuntimeError(
                f"invalid count for table {table}"
            )

        canonical.append(
            f"{table}={count[0]}"
        )

    raw = "\n".join(canonical)

    return {
        "table_count": len(tables),
        "fingerprint":
            hashlib.sha256(raw.encode()).hexdigest(),
        "tables": tables,
    }


def production_http_matrix():
    api_health = curl_code(
        API_BASE + "/api/health"
    )

    staff = curl_code(
        API_BASE + "/api/operations/staff-actors"
    )

    access = curl_code(
        API_BASE + "/api/operations/access-assignments"
    )

    ai = curl_code(
        API_BASE
        + "/api/ai/engines/health-trend/resident/"
          "v79-phase0-probe/patterns",
        method="POST",
        body="{}",
    )

    ui_health = curl_code(
        UI_BASE + "/api/health"
    )

    ui_staff = curl_code(
        UI_BASE + "/api/operations/staff-actors"
    )

    ui_access = curl_code(
        UI_BASE + "/api/operations/access-assignments"
    )

    operational = curl_code(
        UI_BASE + "/operational-care"
    )

    return {
        "api":
            f"{api_health}|{staff}|{access}|{ai}",

        "ui":
            f"{ui_health}|{ui_staff}|{ui_access}|{operational}",
    }


def capture_runtime_identity():
    return {
        "api_id": API_INFO["Id"],
        "api_started_at":
            API_INFO["State"]["StartedAt"],

        "ui_id": UI_INFO["Id"],
        "ui_started_at":
            UI_INFO["State"]["StartedAt"],

        "db_id": DB_INFO["Id"],
        "db_started_at":
            DB_INFO["State"]["StartedAt"],
    }


def refresh_resolved_containers(gate):
    global API_INFO, UI_INFO, DB_INFO
    global API_CONTAINER, UI_CONTAINER, DB_CONTAINER

    API_INFO = resolve_container(
        KNOWN_API_NAMES,
        EXPECTED["api_image"],
        "running",
    )

    UI_INFO = resolve_container(
        KNOWN_UI_NAMES,
        EXPECTED["ui_image"],
        "running",
    )

    DB_INFO = resolve_container(
        KNOWN_DB_NAMES,
        EXPECTED["db_image"],
        "running",
    )

    if not API_INFO:
        safe_stop(
            gate,
            "accepted V7.8 production API container not found",
        )

    if not UI_INFO:
        safe_stop(
            gate,
            "accepted V7.8 production UI container not found",
        )

    if not DB_INFO:
        safe_stop(
            gate,
            "accepted production PostgreSQL container not found",
        )

    API_CONTAINER = cname(API_INFO)
    UI_CONTAINER = cname(UI_INFO)
    DB_CONTAINER = cname(DB_INFO)


def universal_guard(gate, runtime_before=None):
    refresh_resolved_containers(gate)

    print(f"PRODUCTION_API_CONTAINER={API_CONTAINER}")
    print(f"PRODUCTION_UI_CONTAINER={UI_CONTAINER}")
    print(f"PRODUCTION_DB_CONTAINER={DB_CONTAINER}")

    print(f"API_STATE={cstate(API_INFO)}")
    print(f"UI_STATE={cstate(UI_INFO)}")
    print(f"DB_STATE={cstate(DB_INFO)}")

    matrix = production_http_matrix()

    print(
        "PRODUCTION_API_MATRIX="
        + matrix["api"]
    )

    print(
        "PRODUCTION_UI_MATRIX="
        + matrix["ui"]
    )

    if matrix["api"] != "200|401|401|401":
        safe_stop(
            gate,
            "production API acceptance matrix changed",
        )

    if matrix["ui"] != "200|401|401|200":
        safe_stop(
            gate,
            "production UI acceptance matrix changed",
        )

    db = database_fingerprint()

    print(
        "DB_TABLE_COUNT="
        + str(db["table_count"])
    )

    print(
        "DB_FINGERPRINT="
        + db["fingerprint"]
    )

    if db["table_count"] != EXPECTED["db_tables"]:
        safe_stop(
            gate,
            "production table count changed",
        )

    if db["fingerprint"] != EXPECTED["db_fingerprint"]:
        safe_stop(
            gate,
            "production database row fingerprint changed",
        )

    if runtime_before:
        after = capture_runtime_identity()

        if after != runtime_before:
            safe_stop(
                gate,
                "production runtime restarted or changed during read-only gate",
            )

    return db


def list_source_files(root, extensions=None):
    found = []

    if not root.exists():
        return found

    for p in root.rglob("*"):
        if not p.is_file():
            continue

        if any(part in IGNORED_SOURCE_DIRS for part in p.parts):
            continue

        if extensions and p.suffix.lower() not in extensions:
            continue

        found.append(p)

    return sorted(found)


banner(
    "TAM AN CARE V7.9 — SERIES 01 MASTER EXECUTION"
)

print("ROADMAP=APPLICATION_COMPLETION_REAL_OPERATIONAL_READINESS")
print("SERIES=01")
print("GATES=0A->0B->0C->0D->0_FINAL")
print("FAIL_FAST=YES")
print("RESUMABLE=YES")
print("SHA256_ACCEPTANCE=YES")
print("PRODUCTION_DATABASE_WRITE=NO")
print("PRODUCTION_SCHEMA_CHANGE=NO")
print("PRODUCTION_RUNTIME_RESTART=NO")
print("FROZEN_PARENT_RELEASE_CHANGE=NO")

gate = "STARTUP"

v78_result_matches = locate_by_hash(
    ROOT,
    EXPECTED["v78_final_result"],
)

v78_manifest_matches = locate_by_hash(
    ROOT,
    EXPECTED["v78_final_manifest"],
)

print(
    "V78_FINAL_RESULT_MATCH_COUNT="
    + str(len(v78_result_matches))
)

print(
    "V78_FINAL_MANIFEST_MATCH_COUNT="
    + str(len(v78_manifest_matches))
)

if len(v78_result_matches) != 1:
    safe_stop(
        gate,
        "unable to uniquely locate frozen V7.8 final result by SHA-256",
    )

if len(v78_manifest_matches) != 1:
    safe_stop(
        gate,
        "unable to uniquely locate frozen V7.8 final manifest by SHA-256",
    )

V78_FINAL_RESULT = v78_result_matches[0]
V78_FINAL_MANIFEST = v78_manifest_matches[0]

print(
    "V78_FINAL_RESULT="
    + str(V78_FINAL_RESULT)
)

print(
    "V78_FINAL_MANIFEST="
    + str(V78_FINAL_MANIFEST)
)

refresh_resolved_containers(gate)

START_RUNTIME = capture_runtime_identity()
START_DB = universal_guard(gate)

SOURCE_ROOT_CANDIDATES = [
    V77 / "workspace",
    ROOT / "V7.7" / "workspace",
]

SOURCE_ROOT = next(
    (
        p
        for p in SOURCE_ROOT_CANDIDATES
        if p.exists()
    ),
    None,
)

if not SOURCE_ROOT:
    safe_stop(
        gate,
        "frozen parent source root not found",
    )

actual_source_hash = source_hash(
    SOURCE_ROOT
)

print(
    "FROZEN_PARENT_SOURCE_HASH="
    + actual_source_hash
)

if actual_source_hash != EXPECTED["frozen_source"]:
    safe_stop(
        gate,
        "frozen parent source hash changed",
    )

print("PASS: V7.9 STARTING BASELINE LOCKED")


gate = "PHASE_0A"

if not maybe_skip(gate):
    banner(
        "V7.9 PHASE 0A — FROZEN V7.8 BASELINE + ARTIFACT DISCOVERY"
    )

    runtime_before = capture_runtime_identity()

    db = universal_guard(
        gate,
        runtime_before,
    )

    rollback_inventory = []

    for info in all_container_infos():
        image = info.get("Image")

        if image in {
            "sha256:3eb6622aaa1cfdda702fe3a43ca83f5f3d48fc42498d5e9f2b50fc20cdacdca7",
            "sha256:cca4784a77a1c5957eb3c0b6a5c9733793fb768e12ee36cd7fd81890f9d8235b",
        }:
            rollback_inventory.append(
                {
                    "container": cname(info),
                    "image": image,
                    "state": cstate(info),
                }
            )

    print(
        "ROLLBACK_ASSET_COUNT="
        + str(len(rollback_inventory))
    )

    result = RESULTS / (
        "V7.9-PHASE-0A-FROZEN-V78-BASELINE-RESULT.txt"
    )

    manifest = MANIFESTS / (
        "V7.9-PHASE-0A-FROZEN-V78-BASELINE.json"
    )

    payload = {
        "version": "V7.9",
        "phase": "0A",
        "status": "PASSED",

        "parent_release": {
            "result_path": str(V78_FINAL_RESULT),
            "result_hash": sha(V78_FINAL_RESULT),
            "manifest_path": str(V78_FINAL_MANIFEST),
            "manifest_hash": sha(V78_FINAL_MANIFEST),
        },

        "production": {
            "api_container": API_CONTAINER,
            "api_image": API_INFO["Image"],
            "ui_container": UI_CONTAINER,
            "ui_image": UI_INFO["Image"],
            "db_container": DB_CONTAINER,
            "db_image": DB_INFO["Image"],
        },

        "database": {
            "table_count": db["table_count"],
            "fingerprint": db["fingerprint"],
        },

        "frozen_source_hash": actual_source_hash,

        "rollback_assets": rollback_inventory,

        "production_write": False,
        "runtime_restart": False,
        "source_write": False,

        "next": "PHASE_0B",
    }

    manifest.write_text(
        json.dumps(
            payload,
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "PHASE 0A",
            "STATUS=PASSED",
            "PARENT_RELEASE=V7.8_FINAL_OPERATIONAL_RELEASE_FROZEN",
            f"DB_TABLE_COUNT={db['table_count']}",
            f"DB_FINGERPRINT={db['fingerprint']}",
            f"FROZEN_SOURCE_HASH={actual_source_hash}",
            f"ROLLBACK_ASSET_COUNT={len(rollback_inventory)}",
            "PRODUCTION_WRITE=NO",
            "RUNTIME_RESTART=NO",
            "SOURCE_WRITE=NO",
            "NEXT=PHASE_0B",
        ]) + "\n",
        encoding="utf-8",
    )

    universal_guard(
        gate,
        runtime_before,
    )

    complete_gate(
        gate,
        result,
        manifest,
    )


gate = "PHASE_0B"

if not maybe_skip(gate):
    banner(
        "V7.9 PHASE 0B — APPLICATION / MODULE / ROUTE INVENTORY"
    )

    runtime_before = capture_runtime_identity()

    frontend_candidates = [
        SOURCE_ROOT / "frontend",
        ROOT / "frontend",
    ]

    FRONTEND = next(
        (
            p
            for p in frontend_candidates
            if p.exists()
        ),
        None,
    )

    if not FRONTEND:
        safe_stop(
            gate,
            "frontend source root not found",
        )

    frontend_files = list_source_files(
        FRONTEND,
        {
            ".ts", ".tsx",
            ".js", ".jsx",
            ".css", ".html",
            ".json",
        },
    )

    tsx_files = [
        p
        for p in frontend_files
        if p.suffix.lower() == ".tsx"
    ]

    frontend_text = ""

    for p in frontend_files:
        try:
            frontend_text += "\n" + p.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except Exception:
            pass

    route_literals = sorted(
        set(
            re.findall(
                r'''(?:path\s*[:=]\s*|to\s*=\s*)["'`](/[^"'` ]*)["'`]''',
                frontend_text,
                re.I,
            )
        )
    )

    known_routes = [
        "/",
        "/dashboard",
        "/operational-care",
        "/residents",
        "/staff-access",
        "/system-status",
    ]

    route_http = {}

    for route in known_routes:
        code = curl_code(
            UI_BASE + route
        )

        route_http[route] = code

        print(
            f"ROUTE|{route}|HTTP={code}"
        )

    if any(
        code != "200"
        for code in route_http.values()
    ):
        safe_stop(
            gate,
            "one or more accepted application routes unavailable",
        )

    feature_dirs = []

    for candidate in [
        FRONTEND / "src/features",
        FRONTEND / "src/pages",
        FRONTEND / "src/components",
    ]:
        if candidate.exists():
            for p in candidate.iterdir():
                if p.is_dir():
                    feature_dirs.append(
                        str(
                            p.relative_to(
                                FRONTEND
                            )
                        )
                    )

    inventory_file = INVENTORY / (
        "V7.9-PHASE-0B-FRONTEND-INVENTORY.json"
    )

    inventory_payload = {
        "frontend_root": str(FRONTEND),
        "frontend_file_count": len(frontend_files),
        "tsx_file_count": len(tsx_files),
        "discovered_route_literals": route_literals,
        "accepted_route_http": route_http,
        "feature_directories": sorted(set(feature_dirs)),
    }

    inventory_file.write_text(
        json.dumps(
            inventory_payload,
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result = RESULTS / (
        "V7.9-PHASE-0B-APPLICATION-MODULE-ROUTE-INVENTORY-RESULT.txt"
    )

    manifest = MANIFESTS / (
        "V7.9-PHASE-0B-APPLICATION-MODULE-ROUTE-INVENTORY.json"
    )

    manifest.write_text(
        json.dumps(
            {
                "version": "V7.9",
                "phase": "0B",
                "status": "PASSED",
                "inventory": str(inventory_file),
                "inventory_hash": sha(inventory_file),
                "frontend_file_count": len(frontend_files),
                "tsx_file_count": len(tsx_files),
                "live_primary_route_failure_count": 0,
                "production_write": False,
                "runtime_restart": False,
                "next": "PHASE_0C",
            },
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "PHASE 0B",
            "STATUS=PASSED",
            f"FRONTEND_FILE_COUNT={len(frontend_files)}",
            f"TSX_FILE_COUNT={len(tsx_files)}",
            f"DISCOVERED_ROUTE_LITERAL_COUNT={len(route_literals)}",
            "PRIMARY_ROUTE_FAILURE_COUNT=0",
            f"INVENTORY_HASH={sha(inventory_file)}",
            "PRODUCTION_WRITE=NO",
            "RUNTIME_RESTART=NO",
            "NEXT=PHASE_0C",
        ]) + "\n",
        encoding="utf-8",
    )

    universal_guard(
        gate,
        runtime_before,
    )

    complete_gate(
        gate,
        result,
        manifest,
    )


gate = "PHASE_0C"

if not maybe_skip(gate):
    banner(
        "V7.9 PHASE 0C — API + DATABASE CAPABILITY INVENTORY"
    )

    runtime_before = capture_runtime_identity()

    api_candidates = [
        SOURCE_ROOT / "api" / "src",
        ROOT / "api" / "src",
    ]

    API_SRC = next(
        (
            p
            for p in api_candidates
            if p.exists()
        ),
        None,
    )

    if not API_SRC:
        safe_stop(
            gate,
            "backend API source root not found",
        )

    backend_files = list_source_files(
        API_SRC,
        {".ts"},
    )

    controller_files = [
        p
        for p in backend_files
        if "controller" in p.name.lower()
    ]

    backend_text_by_file = {}

    for p in backend_files:
        try:
            backend_text_by_file[p] = p.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except Exception:
            backend_text_by_file[p] = ""

    endpoint_records = []

    for p, text in backend_text_by_file.items():
        controller_match = re.search(
            r'@Controller\s*\(\s*["\']([^"\']*)["\']\s*\)',
            text,
            re.I,
        )

        base = (
            controller_match.group(1)
            if controller_match
            else ""
        )

        for m in re.finditer(
            r'@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:["\']([^"\']*)["\'])?\s*\)',
            text,
            re.I,
        ):
            endpoint_records.append(
                {
                    "file":
                        str(
                            p.relative_to(
                                API_SRC
                            )
                        ),

                    "method":
                        m.group(1).upper(),

                    "controller":
                        base,

                    "route":
                        m.group(2) or "",
                }
            )

    db_tables = prod_query("""
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
AND table_type='BASE TABLE'
ORDER BY table_name;
""")

    db_columns = prod_query("""
SELECT table_name || '|' || column_name || '|' ||
       data_type || '|' || is_nullable
FROM information_schema.columns
WHERE table_schema='public'
ORDER BY table_name, ordinal_position;
""")

    key_words = {
        "staff": [
            "staff",
            "actor",
            "access",
            "assignment",
        ],

        "resident": [
            "resident",
        ],

        "care": [
            "care",
            "task",
            "action",
            "plan",
        ],

        "medication": [
            "medication",
        ],

        "nutrition": [
            "nutrition",
            "hydration",
        ],

        "skin_wound": [
            "skin",
            "wound",
        ],

        "rehabilitation": [
            "activity",
            "rehab",
            "rehabilitation",
        ],

        "ai": [
            "ai",
            "warning",
            "pattern",
        ],
    }

    domain_table_map = {}

    for domain, words in key_words.items():
        hits = [
            t
            for t in db_tables
            if any(
                w in t.lower()
                for w in words
            )
        ]

        domain_table_map[domain] = hits

        print(
            f"DB_DOMAIN|{domain}|TABLES={len(hits)}"
        )

    inventory_file = INVENTORY / (
        "V7.9-PHASE-0C-API-DB-CAPABILITY-INVENTORY.json"
    )

    inventory_file.write_text(
        json.dumps(
            {
                "api_source_root": str(API_SRC),
                "backend_ts_file_count": len(backend_files),
                "controller_file_count": len(controller_files),
                "endpoint_count": len(endpoint_records),
                "endpoints": endpoint_records,
                "db_table_count": len(db_tables),
                "db_column_count": len(db_columns),
                "db_tables": db_tables,
                "domain_table_map": domain_table_map,
            },
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result = RESULTS / (
        "V7.9-PHASE-0C-API-DB-CAPABILITY-INVENTORY-RESULT.txt"
    )

    manifest = MANIFESTS / (
        "V7.9-PHASE-0C-API-DB-CAPABILITY-INVENTORY.json"
    )

    manifest.write_text(
        json.dumps(
            {
                "version": "V7.9",
                "phase": "0C",
                "status": "PASSED",
                "backend_file_count": len(backend_files),
                "controller_count": len(controller_files),
                "endpoint_count": len(endpoint_records),
                "db_table_count": len(db_tables),
                "db_column_count": len(db_columns),
                "inventory": str(inventory_file),
                "inventory_hash": sha(inventory_file),
                "production_write": False,
                "runtime_restart": False,
                "next": "PHASE_0D",
            },
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "PHASE 0C",
            "STATUS=PASSED",
            f"BACKEND_TS_FILE_COUNT={len(backend_files)}",
            f"CONTROLLER_FILE_COUNT={len(controller_files)}",
            f"ENDPOINT_COUNT={len(endpoint_records)}",
            f"DB_TABLE_COUNT={len(db_tables)}",
            f"DB_COLUMN_COUNT={len(db_columns)}",
            f"INVENTORY_HASH={sha(inventory_file)}",
            "PRODUCTION_WRITE=NO",
            "RUNTIME_RESTART=NO",
            "NEXT=PHASE_0D",
        ]) + "\n",
        encoding="utf-8",
    )

    universal_guard(
        gate,
        runtime_before,
    )

    complete_gate(
        gate,
        result,
        manifest,
    )


gate = "PHASE_0D"

if not maybe_skip(gate):
    banner(
        "V7.9 PHASE 0D — UI ↔ API ↔ DB COVERAGE / GAP MATRIX"
    )

    runtime_before = capture_runtime_identity()

    front_inventory = json.loads(
        (
            INVENTORY
            / "V7.9-PHASE-0B-FRONTEND-INVENTORY.json"
        ).read_text(
            encoding="utf-8"
        )
    )

    api_inventory = json.loads(
        (
            INVENTORY
            / "V7.9-PHASE-0C-API-DB-CAPABILITY-INVENTORY.json"
        ).read_text(
            encoding="utf-8"
        )
    )

    endpoints_text = json.dumps(
        api_inventory.get(
            "endpoints",
            [],
        )
    ).lower()

    tables_text = " ".join(
        api_inventory.get(
            "db_tables",
            [],
        )
    ).lower()

    routes = front_inventory.get(
        "accepted_route_http",
        {}
    )

    domain_rules = {
        "dashboard": {
            "route": "/dashboard",
            "api_words": [
                "dashboard",
                "operation",
            ],
            "db_words": [
                "resident",
                "care",
            ],
        },

        "operational_care": {
            "route": "/operational-care",
            "api_words": [
                "care",
                "task",
                "action",
            ],
            "db_words": [
                "care",
            ],
        },

        "resident_management": {
            "route": "/residents",
            "api_words": [
                "resident",
            ],
            "db_words": [
                "resident",
            ],
        },

        "staff_access": {
            "route": "/staff-access",
            "api_words": [
                "staff",
                "access",
                "actor",
            ],
            "db_words": [
                "staff",
                "access",
                "actor",
            ],
        },

        "system_status": {
            "route": "/system-status",
            "api_words": [
                "health",
                "status",
            ],
            "db_words": [],
        },
    }

    matrix = []

    for domain, rule in domain_rules.items():
        route_ok = (
            routes.get(
                rule["route"]
            ) == "200"
        )

        api_ok = all(
            word in endpoints_text
            for word in rule["api_words"]
        )

        if rule["db_words"]:
            db_ok = any(
                word in tables_text
                for word in rule["db_words"]
            )
        else:
            db_ok = True

        if route_ok and api_ok and db_ok:
            classification = "COMPLETE_FOUNDATION"
        elif route_ok and (api_ok or db_ok):
            classification = "PARTIAL_REQUIRES_WORKFLOW_ACCEPTANCE"
        elif route_ok:
            classification = "UI_PRESENT_BACKEND_COVERAGE_UNRESOLVED"
        else:
            classification = "MISSING_OR_UNAVAILABLE"

        matrix.append(
            {
                "domain": domain,
                "route": rule["route"],
                "ui_route_200": route_ok,
                "api_signal": api_ok,
                "db_signal": db_ok,
                "classification": classification,
            }
        )

        print(
            "COVERAGE|"
            + domain
            + "|UI="
            + ("YES" if route_ok else "NO")
            + "|API="
            + ("YES" if api_ok else "NO")
            + "|DB="
            + ("YES" if db_ok else "NO")
            + "|CLASS="
            + classification
        )

    gap_count = sum(
        1
        for item in matrix
        if item["classification"]
        != "COMPLETE_FOUNDATION"
    )

    gap_inventory = INVENTORY / (
        "V7.9-PHASE-0D-UI-API-DB-COVERAGE-GAP-MATRIX.json"
    )

    gap_inventory.write_text(
        json.dumps(
            {
                "version": "V7.9",
                "phase": "0D",
                "matrix": matrix,
                "non_complete_foundation_count": gap_count,

                "interpretation": {
                    "COMPLETE_FOUNDATION":
                        "UI/API/DB foundation detected; functional acceptance may still be required.",

                    "PARTIAL_REQUIRES_WORKFLOW_ACCEPTANCE":
                        "Relevant implementation exists but end-to-end workflow requires V7.9 validation.",

                    "UI_PRESENT_BACKEND_COVERAGE_UNRESOLVED":
                        "Route is live but source-level backend evidence was insufficient for baseline classification.",

                    "MISSING_OR_UNAVAILABLE":
                        "Capability unavailable at the baseline gate.",
                },
            },
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result = RESULTS / (
        "V7.9-PHASE-0D-UI-API-DB-COVERAGE-GAP-MATRIX-RESULT.txt"
    )

    manifest = MANIFESTS / (
        "V7.9-PHASE-0D-UI-API-DB-COVERAGE-GAP-MATRIX.json"
    )

    manifest.write_text(
        json.dumps(
            {
                "version": "V7.9",
                "phase": "0D",
                "status": "PASSED",
                "coverage_matrix": str(gap_inventory),
                "coverage_matrix_hash": sha(gap_inventory),
                "domain_count": len(matrix),
                "non_complete_foundation_count": gap_count,
                "production_write": False,
                "runtime_restart": False,
                "next": "PHASE_0_FINAL",
            },
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "PHASE 0D",
            "STATUS=PASSED",
            f"DOMAIN_COUNT={len(matrix)}",
            f"NON_COMPLETE_FOUNDATION_COUNT={gap_count}",
            f"COVERAGE_MATRIX_HASH={sha(gap_inventory)}",
            "PRODUCTION_WRITE=NO",
            "RUNTIME_RESTART=NO",
            "NEXT=PHASE_0_FINAL",
        ]) + "\n",
        encoding="utf-8",
    )

    universal_guard(
        gate,
        runtime_before,
    )

    complete_gate(
        gate,
        result,
        manifest,
    )


gate = "PHASE_0_FINAL"

if not maybe_skip(gate):
    banner(
        "V7.9 PHASE 0 FINAL — APPLICATION COMPLETION BASELINE"
    )

    runtime_before = capture_runtime_identity()

    required_gates = [
        "PHASE_0A",
        "PHASE_0B",
        "PHASE_0C",
        "PHASE_0D",
    ]

    for required in required_gates:
        if not completed_entry(required):
            safe_stop(
                gate,
                f"required accepted gate missing: {required}",
            )

    db = universal_guard(
        gate,
        runtime_before,
    )

    current_source_hash = source_hash(
        SOURCE_ROOT
    )

    if current_source_hash != EXPECTED["frozen_source"]:
        safe_stop(
            gate,
            "parent source changed during V7.9 Phase 0",
        )

    gap_matrix_path = (
        INVENTORY
        / "V7.9-PHASE-0D-UI-API-DB-COVERAGE-GAP-MATRIX.json"
    )

    gap_matrix = json.loads(
        gap_matrix_path.read_text(
            encoding="utf-8"
        )
    )

    baseline = {
        "version": "V7.9",
        "phase": "0-FINAL",
        "status": "PASSED",

        "decision":
            "V7_9_APPLICATION_COMPLETION_BASELINE_ACCEPTED",

        "accepted_gates":
            required_gates,

        "production": {
            "api_matrix":
                production_http_matrix()["api"],

            "ui_matrix":
                production_http_matrix()["ui"],

            "runtime_restart":
                False,
        },

        "database": {
            "table_count":
                db["table_count"],

            "fingerprint":
                db["fingerprint"],

            "write":
                False,

            "schema_change":
                False,
        },

        "source": {
            "frozen_parent_hash":
                current_source_hash,

            "write":
                False,
        },

        "coverage":
            gap_matrix,

        "next":
            "V7.9_PHASE_1_ROLE_ACCESS_STAFF",
    }

    manifest = MANIFESTS / (
        "V7.9-PHASE-0-FINAL-APPLICATION-COMPLETION-BASELINE.json"
    )

    result = RESULTS / (
        "V7.9-PHASE-0-FINAL-APPLICATION-COMPLETION-BASELINE-RESULT.txt"
    )

    manifest.write_text(
        json.dumps(
            baseline,
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )

    result.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "PHASE 0 FINAL",
            "STATUS=PASSED",
            "DECISION=V7_9_APPLICATION_COMPLETION_BASELINE_ACCEPTED",
            "PHASE_0A=PASSED",
            "PHASE_0B=PASSED",
            "PHASE_0C=PASSED",
            "PHASE_0D=PASSED",
            f"DB_TABLE_COUNT={db['table_count']}",
            f"DB_FINGERPRINT={db['fingerprint']}",
            f"FROZEN_PARENT_SOURCE_HASH={current_source_hash}",
            "PRODUCTION_DATABASE_WRITE=NO",
            "PRODUCTION_SCHEMA_CHANGE=NO",
            "PRODUCTION_RUNTIME_RESTART=NO",
            "NEXT=V7.9_PHASE_1",
        ]) + "\n",
        encoding="utf-8",
    )

    universal_guard(
        gate,
        runtime_before,
    )

    complete_gate(
        gate,
        result,
        manifest,
    )


banner(
    "V7.9 PHASE 1 — AUTOMATIC PREFLIGHT GENERATION"
)

phase0_entry = completed_entry(
    "PHASE_0_FINAL"
)

if not phase0_entry:
    safe_stop(
        "PHASE_1_PREFLIGHT",
        "Phase 0 Final acceptance missing",
    )

phase1_preflight = PREFLIGHT / (
    "V7.9-PHASE-1-ROLE-ACCESS-STAFF-PREFLIGHT.json"
)

phase1_result = ROOT / (
    "V7.9-PHASE-1-ROLE-ACCESS-STAFF-PREFLIGHT-RESULT.txt"
)

gap_matrix_path = (
    INVENTORY
    / "V7.9-PHASE-0D-UI-API-DB-COVERAGE-GAP-MATRIX.json"
)

gap_matrix = json.loads(
    gap_matrix_path.read_text(
        encoding="utf-8"
    )
)

staff_access = next(
    (
        item
        for item in gap_matrix["matrix"]
        if item["domain"] == "staff_access"
    ),
    None,
)

phase1_contract = {
    "generated_at": now(),
    "version": "V7.9",
    "phase": "1",
    "title": "ROLE_ACCESS_STAFF",

    "authorization": {
        "phase0_final_result_hash":
            phase0_entry["result_hash"],

        "phase0_final_manifest_hash":
            phase0_entry["manifest_hash"],
    },

    "baseline_staff_access":
        staff_access,

    "ordered_gates": [
        {
            "gate": "1A",
            "name": "ROLE_MODEL_EXACT_CONTRACT_DISCOVERY",
            "mode": "READ_ONLY",
        },
        {
            "gate": "1B",
            "name": "PERMISSION_MATRIX_VERIFICATION",
            "mode": "READ_ONLY_OR_DISPOSABLE",
        },
        {
            "gate": "1C",
            "name": "STAFF_ACTOR_ASSIGNMENT_WORKFLOW",
            "mode": "DISPOSABLE_MUTATION",
        },
        {
            "gate": "1D",
            "name": "RESIDENT_ACCESS_ASSIGNMENT_WORKFLOW",
            "mode": "DISPOSABLE_MUTATION",
        },
        {
            "gate": "1_FINAL",
            "name": "STAFF_ACCESS_OPERATIONAL_ACCEPTANCE",
            "mode": "READ_ONLY_CONSOLIDATION",
        },
    ],

    "execution_rules": {
        "serial_execution": True,
        "fail_fast": True,
        "auto_advance_on_pass": True,
        "resumable": True,
        "skip_accepted_gates": True,
        "sha256_identity": True,
        "assumed_artifact_filenames": False,

        "real_staff_mutation":
            False,

        "real_resident_mutation":
            False,

        "production_database_mutation":
            False,

        "production_schema_change":
            False,

        "production_runtime_restart":
            False,

        "production_cutover":
            False,

        "v76_rollback_delete":
            False,
    },

    "next":
        "V7.9_PHASE_1_SERIES_02",
}

phase1_preflight.write_text(
    json.dumps(
        phase1_contract,
        indent=2,
        ensure_ascii=False,
    ) + "\n",
    encoding="utf-8",
)

phase1_result.write_text(
    "\n".join([
        "TAM AN CARE V7.9",
        "PHASE 1 PREFLIGHT",
        "STATUS=PASSED",
        "TITLE=ROLE_ACCESS_STAFF",
        f"PHASE0_FINAL_RESULT_HASH={phase0_entry['result_hash']}",
        f"PHASE0_FINAL_MANIFEST_HASH={phase0_entry['manifest_hash']}",
        "SERIAL_EXECUTION=YES",
        "FAIL_FAST=YES",
        "AUTO_ADVANCE=YES",
        "RESUMABLE=YES",
        "REAL_STAFF_MUTATION=NO",
        "REAL_RESIDENT_MUTATION=NO",
        "PRODUCTION_DATABASE_MUTATION=NO",
        "PRODUCTION_RUNTIME_RESTART=NO",
        "NEXT=V7.9_PHASE_1_SERIES_02",
    ]) + "\n",
    encoding="utf-8",
)

PHASE1_PREFLIGHT_HASH = sha(
    phase1_preflight
)

PHASE1_PREFLIGHT_RESULT_HASH = sha(
    phase1_result
)

print(
    "PHASE1_PREFLIGHT_MANIFEST_HASH="
    + PHASE1_PREFLIGHT_HASH
)

print(
    "PHASE1_PREFLIGHT_RESULT_HASH="
    + PHASE1_PREFLIGHT_RESULT_HASH
)

STATE["status"] = "SERIES_01_PASSED"
STATE["series_01_completed_at"] = now()
STATE["phase1_preflight"] = str(
    phase1_preflight
)
STATE["phase1_preflight_hash"] = (
    PHASE1_PREFLIGHT_HASH
)
STATE["phase1_preflight_result"] = str(
    phase1_result
)
STATE["phase1_preflight_result_hash"] = (
    PHASE1_PREFLIGHT_RESULT_HASH
)

save_state()

universal_guard(
    "FINAL_SERIES_01",
    START_RUNTIME,
)

final_source = source_hash(
    SOURCE_ROOT
)

if final_source != EXPECTED["frozen_source"]:
    safe_stop(
        "FINAL_SERIES_01",
        "frozen parent source changed",
    )

banner(
    "STATUS: TAM AN CARE V7.9 SERIES 01 PASSED"
)

print("V7.9 PHASE 0:")
print(" -> 0A = PASSED")
print(" -> 0B = PASSED")
print(" -> 0C = PASSED")
print(" -> 0D = PASSED")
print(" -> 0 FINAL = PASSED")
print(" -> PHASE 0 = CLOSED")

print()
print("PRODUCTION:")
print(" -> API health = 200")
print(" -> API security = 401|401|401")
print(" -> UI = 200|401|401|200")
print(" -> runtime restart = NO")

print()
print("DATABASE:")
print(
    " -> tables = "
    + str(START_DB["table_count"])
)
print(
    " -> fingerprint = "
    + START_DB["fingerprint"]
)
print(" -> write = NO")
print(" -> schema change = NO")

print()
print("SOURCE:")
print(
    " -> frozen parent hash = "
    + EXPECTED["frozen_source"]
)
print(" -> write = NO")

print()
print("PHASE 1:")
print(" -> PREFLIGHT = PASSED")
print(" -> TITLE = ROLE / ACCESS / STAFF")
print(" -> NEXT SERIES = V7.9 SERIES 02")
print(" -> GATES = 1A -> 1B -> 1C -> 1D -> 1 FINAL")

print()
print("PHASE 1 PREFLIGHT RESULT HASH:")
print(
    " "
    + PHASE1_PREFLIGHT_RESULT_HASH
)

print()
print("PHASE 1 PREFLIGHT MANIFEST HASH:")
print(
    " "
    + PHASE1_PREFLIGHT_HASH
)

print()
print("IMPORTANT:")
print(" DO NOT RERUN PASSED V7.9 PHASE 0 GATES.")
print(" DO NOT MODIFY FROZEN PARENT SOURCE.")
print(" DO NOT MUTATE REAL STAFF OR RESIDENT RECORDS.")
print(" DO NOT MODIFY PRODUCTION DATABASE.")
print(" DO NOT RESTART API/UI/POSTGRES.")
print(" DO NOT REMOVE V7.6 ROLLBACK ASSETS.")
print(" NEXT AUTHORIZED STEP = V7.9 SERIES 02 / PHASE 1.")
print()
print("SEND THIS ENTIRE OUTPUT BACK.")
