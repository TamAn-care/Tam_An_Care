from pathlib import Path
import hashlib
import re
import shutil
import subprocess
import tempfile
import sys

ROOT = Path(
    "/Users/anhha/Downloads/"
    "TamAnCare_V7_4_3_Development"
)

V80 = ROOT / "V8.0"

SERVICE = (
    V80 /
    "workspace/api/src/operational-care-view/"
    "operational-dashboard.service.ts"
)

PAGE = (
    V80 /
    "workspace/frontend/src/features/dashboard/"
    "DashboardPage.tsx"
)

API_ROOT = V80 / "workspace/api"
FE_ROOT = V80 / "workspace/frontend"

EXPECTED_SERVICE_SHA = (
    "20296c4d1074e6b927512b99c575db1f1df301d23e3e92ea58d155c2f7525a9f"
)

EXPECTED_PAGE_SHA = (
    "662d17c8d96537d7199223be7bc7f0645ebe4749d99e55133f6a84fc787b9589"
)

EXPECTED = {
    SERVICE: EXPECTED_SERVICE_SHA,
    PAGE: EXPECTED_PAGE_SHA,
}

BACKUP_ROOT = (
    V80 /
    "backups/S4C-R2-prepatch"
)


def sha256(path: Path) -> str:
    h = hashlib.sha256()

    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)

            if not chunk:
                break

            h.update(chunk)

    return h.hexdigest()


def restore() -> None:
    for src in EXPECTED:
        rel = src.relative_to(V80)
        backup = BACKUP_ROOT / rel

        if backup.exists():
            src.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            shutil.copy2(
                backup,
                src,
            )


def require_unique(
    text: str,
    pattern: str,
    label: str,
    flags=0,
):
    matches = list(
        re.finditer(
            pattern,
            text,
            flags,
        )
    )

    print(
        f"PATCH_ANCHOR|{label}|"
        f"COUNT={len(matches)}"
    )

    if len(matches) != 1:
        raise RuntimeError(
            f"{label}: expected 1 anchor, "
            f"got {len(matches)}"
        )

    return matches[0]


try:
    print(
        "======================================================================"
    )
    print(
        " TAM AN CARE V8.0 — SERIES 08"
    )
    print(
        " S4C-R2 — RECOVERED MINIMAL DASHBOARD PATCH"
    )
    print(
        " SEMANTIC / STRUCTURAL ANCHORS"
    )
    print(
        " MAX APPLICATION FILES = 2"
    )
    print(
        "======================================================================"
    )

    print("")
    print(
        "===== P1 — VERIFY EXACT PREPATCH HASHES ====="
    )

    for path, expected in EXPECTED.items():
        actual = sha256(path)

        print(
            f"PREPATCH|FILE={path}|"
            f"ACTUAL={actual}|EXPECTED={expected}"
        )

        if actual != expected:
            raise RuntimeError(
                f"prepatch hash mismatch: {path}"
            )

    print(
        "PASS: EXACT PREPATCH SOURCE LOCKED"
    )

    print("")
    print(
        "===== P2 — CREATE RECOVERY BACKUP ====="
    )

    if BACKUP_ROOT.exists():
        shutil.rmtree(
            BACKUP_ROOT
        )

    for src in EXPECTED:
        rel = src.relative_to(V80)
        dst = BACKUP_ROOT / rel

        dst.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        shutil.copy2(
            src,
            dst,
        )

    print(
        f"PREPATCH_BACKUP={BACKUP_ROOT}"
    )

    print(
        "PASS: PREPATCH BACKUP CREATED"
    )

    # --------------------------------------------------
    # BACKEND
    # --------------------------------------------------

    print("")
    print(
        "===== P3 — PATCH BACKEND DASHBOARD METRICS ====="
    )

    service = SERVICE.read_text(
        encoding="utf-8"
    )

    overdue = require_unique(
        service,
        r"(?m)^(\s*)const\s+overdueTasks\s*=",
        "BACKEND_OVERDUE_DECLARATION",
    )

    indent = overdue.group(1)

    derived_metrics = (
        f"{indent}const inReviewTasks =\n"
        f"{indent}  workQueue.filter(\n"
        f"{indent}    (item: any) =>\n"
        f"{indent}      item.status === 'IN_REVIEW',\n"
        f"{indent}  ).length;\n"
        f"\n"
        f"{indent}const unassignedTasks =\n"
        f"{indent}  workQueue.filter(\n"
        f"{indent}    (item: any) =>\n"
        f"{indent}      item.assignedTo === null,\n"
        f"{indent}  ).length;\n"
        f"\n"
    )

    service = (
        service[:overdue.start()]
        + derived_metrics
        + service[overdue.start():]
    )

    open_tasks = require_unique(
        service,
        r"(?m)^(\s*)openTasks\s*:\s*\n"
        r"\s*tasksDomain\.total\s*,",
        "BACKEND_OPEN_TASKS_FIELD",
    )

    summary_indent = open_tasks.group(1)

    original_open = open_tasks.group(0)

    expanded_open = (
        original_open
        + "\n"
        + summary_indent
        + "inReviewTasks,\n"
        + summary_indent
        + "unassignedTasks,"
    )

    service = (
        service[:open_tasks.start()]
        + expanded_open
        + service[open_tasks.end():]
    )

    SERVICE.write_text(
        service,
        encoding="utf-8",
    )

    print(
        "PASS: BACKEND DASHBOARD METRICS PATCHED"
    )

    # --------------------------------------------------
    # FRONTEND
    # --------------------------------------------------

    print("")
    print(
        "===== P4 — PATCH FRONTEND DASHBOARD ====="
    )

    page = PAGE.read_text(
        encoding="utf-8"
    )

    role_import = require_unique(
        page,
        (
            r"import\s*\{\s*ROLE_LABELS\s*,?\s*\}\s*"
            r"from\s*"
            r"['\"]\.\./\.\./auth/role-policy['\"]\s*;"
        ),
        "FRONTEND_ROLE_POLICY_IMPORT",
        re.S,
    )

    import_block = role_import.group(0)

    new_import_block = (
        "import {\n"
        "  useEffect,\n"
        "  useState,\n"
        "} from 'react';\n"
        "\n"
        + import_block
        + "\n"
        "\n"
        "import {\n"
        "  getOperationalDashboard,\n"
        "} from '../../api/operational-care';"
    )

    page = (
        page[:role_import.start()]
        + new_import_block
        + page[role_import.end():]
    )

    component = require_unique(
        page,
        (
            r"export\s+function\s+DashboardPage\(\)\s*\{\s*"
            r"const\s+\{\s*actor\s*\}\s*=\s*useActor\(\)\s*;"
        ),
        "FRONTEND_COMPONENT_HEAD",
        re.S,
    )

    component_replacement = """export function DashboardPage() {
  const { actor } = useActor();

  const [
    dashboard,
    setDashboard,
  ] = useState<any>(null);

  const [
    dashboardError,
    setDashboardError,
  ] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!actor) {
      setDashboard(null);
      setDashboardError(null);
      return;
    }

    getOperationalDashboard({
      actorId: actor.actorId,
      actorRole: actor.actorRole,
    })
      .then((result) => {
        if (!cancelled) {
          setDashboard(result);
          setDashboardError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDashboard(null);

          setDashboardError(
            error instanceof Error
              ? error.message
              : 'Không tải được dữ liệu vận hành.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actor]);"""

    page = (
        page[:component.start()]
        + component_replacement
        + page[component.end():]
    )

    placeholder = require_unique(
        page,
        (
            r"<p\s+className=['\"]helper['\"]>\s*"
            r"Dữ liệu thật sẽ được kết nối\s*"
            r"tại bước dashboard integration\.\s*"
            r"</p>"
        ),
        "FRONTEND_PLACEHOLDER",
        re.S,
    )

    metrics = """{dashboardError ? (
            <p className="helper">
              {dashboardError}
            </p>
          ) : (
            <div className="metric-grid">
              <div>
                <span className="metric-label">
                  Người cao tuổi hiển thị
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.visibleResidents ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Công việc đang mở
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.openTasks ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Đang rà soát
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.inReviewTasks ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Chưa phân công
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.unassignedTasks ?? 0}
                </strong>
              </div>
            </div>
          )}"""

    page = (
        page[:placeholder.start()]
        + metrics
        + page[placeholder.end():]
    )

    PAGE.write_text(
        page,
        encoding="utf-8",
    )

    print(
        "PASS: FRONTEND DASHBOARD PATCHED"
    )

    # --------------------------------------------------
    # STATIC CONTRACT
    # --------------------------------------------------

    print("")
    print(
        "===== P5 — VERIFY EXACT PATCH CONTRACT ====="
    )

    service_after = SERVICE.read_text(
        encoding="utf-8"
    )

    page_after = PAGE.read_text(
        encoding="utf-8"
    )

    checks = {
        "BACKEND_IN_REVIEW":
            "const inReviewTasks" in service_after
            and
            "item.status === 'IN_REVIEW'"
            in service_after,

        "BACKEND_UNASSIGNED":
            "const unassignedTasks" in service_after
            and
            "item.assignedTo === null"
            in service_after,

        "SUMMARY_IN_REVIEW":
            "inReviewTasks," in service_after,

        "SUMMARY_UNASSIGNED":
            "unassignedTasks," in service_after,

        "REACT_USE_EFFECT":
            "useEffect" in page_after,

        "REACT_USE_STATE":
            "useState" in page_after,

        "FRONTEND_API":
            "getOperationalDashboard"
            in page_after,

        "FRONTEND_IN_REVIEW":
            "dashboard?.summary?.inReviewTasks"
            in page_after,

        "FRONTEND_UNASSIGNED":
            "dashboard?.summary?.unassignedTasks"
            in page_after,

        "PLACEHOLDER_REMOVED":
            "Dữ liệu thật sẽ được kết nối"
            not in page_after,
    }

    for name, ok in checks.items():
        print(
            f"PATCH_CONTRACT|{name}|"
            f"{'YES' if ok else 'NO'}"
        )

        if not ok:
            raise RuntimeError(
                f"missing contract: {name}"
            )

    print(
        "PASS: STATIC PATCH CONTRACT VERIFIED"
    )

    # --------------------------------------------------
    # BUILDS
    # --------------------------------------------------

    print("")
    print(
        "===== P6 — ISOLATED API BUILD ====="
    )

    api_tmp = Path(
        tempfile.mkdtemp(
            prefix="taman-s4c-r2-api-"
        )
    )

    try:
        shutil.copytree(
            API_ROOT,
            api_tmp,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(
                "node_modules",
                "dist",
                "coverage",
            ),
        )

        subprocess.run(
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
            ],
            cwd=api_tmp,
            check=True,
            stdout=subprocess.DEVNULL,
        )

        subprocess.run(
            [
                "npm",
                "run",
                "build",
            ],
            cwd=api_tmp,
            check=True,
        )

    finally:
        shutil.rmtree(
            api_tmp,
            ignore_errors=True,
        )

    print(
        "PASS: PATCHED API BUILDS"
    )

    print("")
    print(
        "===== P7 — ISOLATED FRONTEND BUILD ====="
    )

    fe_tmp = Path(
        tempfile.mkdtemp(
            prefix="taman-s4c-r2-fe-"
        )
    )

    try:
        shutil.copytree(
            FE_ROOT,
            fe_tmp,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(
                "node_modules",
                "dist",
                "coverage",
            ),
        )

        subprocess.run(
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
            ],
            cwd=fe_tmp,
            check=True,
            stdout=subprocess.DEVNULL,
        )

        subprocess.run(
            [
                "npm",
                "run",
                "build",
            ],
            cwd=fe_tmp,
            check=True,
        )

    finally:
        shutil.rmtree(
            fe_tmp,
            ignore_errors=True,
        )

    print(
        "PASS: PATCHED FRONTEND BUILDS"
    )

    # --------------------------------------------------
    # FINAL
    # --------------------------------------------------

    print("")
    print(
        "===== P8 — LOCK POSTPATCH HASHES ====="
    )

    print(
        "POSTPATCH_SHA256|dashboard_service="
        + sha256(SERVICE)
    )

    print(
        "POSTPATCH_SHA256|dashboard_page="
        + sha256(PAGE)
    )

    print(
        "PASS: POSTPATCH HASHES CAPTURED"
    )

    print("")
    print(
        "===== P9 — FINAL PATCH SCOPE ====="
    )

    print("PATCHED_FILE_COUNT=2")
    print(f"PATCHED_FILE={SERVICE}")
    print(f"PATCHED_FILE={PAGE}")

    print("NEW_REPORTING_MODULE=NO")
    print("NEW_DATABASE_TABLE=NO")
    print("SCHEMA_PATCH=NO")
    print("DATABASE_MUTATION=NO")
    print("PRODUCTION_RUNTIME_RESTART=NO")

    print(
        "PASS: MINIMAL PATCH SCOPE PRESERVED"
    )

except BaseException as exc:
    print("")
    print(
        "PATCH_EXCEPTION="
        + repr(exc)
    )

    print(
        "RESTORING_PREPATCH_SOURCE=YES"
    )

    restore()

    print(
        "PREPATCH_SOURCE_RESTORED=YES"
    )

    print(
        "SAFE STOP: S4C-R2 PATCH FAILED"
    )

    sys.exit(1)

print("")
print(
    "======================================================================"
)
print(
    " STATUS: V8.0 SERIES 08 / S4C-R2 PATCH PASSED"
)
print("")
print(
    " IMPLEMENTED:"
)
print(
    " -> IN_REVIEW VISIBILITY"
)
print(
    " -> UNASSIGNED VISIBILITY"
)
print(
    " -> REAL DASHBOARD DATA UI"
)
print("")
print(
    " NEXT AUTHORIZED ACTION:"
)
print(
    " -> S4D BUILD / STATIC ACCEPTANCE PREFLIGHT"
)
print(
    "======================================================================"
)
