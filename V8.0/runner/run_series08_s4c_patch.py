from pathlib import Path
import hashlib
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

EXPECTED = {
    SERVICE:
        "20296c4d1074e6b927512b99c575db1f1df301d23e3e92ea58d155c2f7525a9f",
    PAGE:
        "662d17c8d96537d7199223be7bc7f0645ebe4749d99e55133f6a84fc787b9589",
}

BACKUP_ROOT = (
    V80 / "backups" /
    "S4C-prepatch"
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

def restore():
    for src in EXPECTED:
        rel = src.relative_to(V80)
        backup = BACKUP_ROOT / rel

        if backup.exists():
            src.parent.mkdir(
                parents=True,
                exist_ok=True
            )
            shutil.copy2(
                backup,
                src
            )

def safe_replace(
    text: str,
    old: str,
    new: str,
    label: str,
) -> str:

    count = text.count(old)

    print(
        f"PATCH_ANCHOR|{label}|COUNT={count}"
    )

    if count != 1:
        raise RuntimeError(
            f"{label}: expected 1 anchor, got {count}"
        )

    return text.replace(
        old,
        new,
        1
    )

try:
    print(
        "======================================================================"
    )
    print(
        " TAM AN CARE V8.0 — SERIES 08"
    )
    print(
        " S4C — EXACT MINIMAL DASHBOARD PATCH"
    )
    print(
        " MAX FILES = 2"
    )
    print(
        " NO SCHEMA CHANGE"
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
        "===== P2 — CREATE PREPATCH BACKUP ====="
    )

    if BACKUP_ROOT.exists():
        shutil.rmtree(BACKUP_ROOT)

    for src in EXPECTED:
        rel = src.relative_to(V80)
        dst = BACKUP_ROOT / rel

        dst.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        shutil.copy2(
            src,
            dst
        )

    print(
        f"PREPATCH_BACKUP={BACKUP_ROOT}"
    )
    print(
        "PASS: PREPATCH SOURCE PRESERVED"
    )

    print("")
    print(
        "===== P3 — PATCH BACKEND SUMMARY METRICS ====="
    )

    service = SERVICE.read_text(
        encoding="utf-8"
    )

    old_query_anchor = """      const dueTasks =
        workQueue.filter(
          (item) =>
            item.operationalState
            === 'DUE',
        ).length;

      const overdueTasks =
"""

    new_query_anchor = """      const dueTasks =
        workQueue.filter(
          (item) =>
            item.operationalState
            === 'DUE',
        ).length;

      const inReviewTasks =
        workQueue.filter(
          (item) =>
            item.status
            === 'IN_REVIEW',
        ).length;

      const unassignedTasks =
        workQueue.filter(
          (item) =>
            item.assignedTo
            === null,
        ).length;

      const overdueTasks =
"""

    service = safe_replace(
        service,
        old_query_anchor,
        new_query_anchor,
        "BACKEND_DERIVED_METRICS",
    )

    old_summary = """        openTasks:
          tasksDomain.total,
        dueTasks,
        overdueTasks,
"""

    new_summary = """        openTasks:
          tasksDomain.total,
        inReviewTasks,
        unassignedTasks,
        dueTasks,
        overdueTasks,
"""

    service = safe_replace(
        service,
        old_summary,
        new_summary,
        "BACKEND_SUMMARY_RESPONSE",
    )

    SERVICE.write_text(
        service,
        encoding="utf-8"
    )

    print(
        "PASS: BACKEND SUMMARY PATCHED"
    )

    print("")
    print(
        "===== P4 — PATCH DASHBOARD PAGE TO REAL DATA ====="
    )

    page = PAGE.read_text(
        encoding="utf-8"
    )

    old_import_anchor = """import {
  ROLE_LABELS,
} from '../../auth/role-policy';
"""

    new_import_anchor = """import {
  ROLE_LABELS,
} from '../../auth/role-policy';
import {
  getOperationalDashboard,
} from '../../api/operational-care';
"""

    page = safe_replace(
        page,
        old_import_anchor,
        new_import_anchor,
        "FRONTEND_API_IMPORT",
    )

    old_component_anchor = """export function DashboardPage() {
  const { actor } = useActor();

  return (
"""

    new_component_anchor = """export function DashboardPage() {
  const { actor } = useActor();

  const [
    dashboard,
    setDashboard,
  ] = React.useState<any>(null);

  const [
    dashboardError,
    setDashboardError,
  ] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (!actor) {
      setDashboard(null);
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
  }, [actor]);

  return (
"""

    page = safe_replace(
        page,
        old_component_anchor,
        new_component_anchor,
        "FRONTEND_DATA_LOAD",
    )

    old_placeholder = """          <p className="helper">
            Dữ liệu thật sẽ được kết nối
            tại bước dashboard integration.
          </p>
"""

    new_placeholder = """          {dashboardError ? (
            <p className="helper">
              {dashboardError}
            </p>
          ) : (
            <div className="metric-grid">
              <div>
                <span className="metric-label">
                  Người cao tuổi hiển thị
                </span>
                <strong>
                  {dashboard?.summary?.visibleResidents ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Công việc đang mở
                </span>
                <strong>
                  {dashboard?.summary?.openTasks ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Đang rà soát
                </span>
                <strong>
                  {dashboard?.summary?.inReviewTasks ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Chưa phân công
                </span>
                <strong>
                  {dashboard?.summary?.unassignedTasks ?? 0}
                </strong>
              </div>
            </div>
          )}
"""

    page = safe_replace(
        page,
        old_placeholder,
        new_placeholder,
        "FRONTEND_REAL_METRICS",
    )

    PAGE.write_text(
        page,
        encoding="utf-8"
    )

    print(
        "PASS: FRONTEND DASHBOARD PATCHED"
    )

    print("")
    print(
        "===== P5 — STATIC CONTRACT CHECK ====="
    )

    service_after = SERVICE.read_text(
        encoding="utf-8"
    )

    page_after = PAGE.read_text(
        encoding="utf-8"
    )

    required = {
        "IN_REVIEW":
            "inReviewTasks" in service_after,
        "UNASSIGNED":
            "unassignedTasks" in service_after,
        "SUMMARY_IN_REVIEW":
            "inReviewTasks," in service_after,
        "SUMMARY_UNASSIGNED":
            "unassignedTasks," in service_after,
        "FRONTEND_LOAD":
            "getOperationalDashboard" in page_after,
        "FRONTEND_IN_REVIEW":
            "inReviewTasks" in page_after,
        "FRONTEND_UNASSIGNED":
            "unassignedTasks" in page_after,
    }

    for name, ok in required.items():
        print(
            f"PATCH_CONTRACT|{name}|"
            f"{'YES' if ok else 'NO'}"
        )

        if not ok:
            raise RuntimeError(
                f"missing contract: {name}"
            )

    print(
        "PASS: PATCH CONTRACT PRESENT"
    )

    print("")
    print(
        "===== P6 — ISOLATED API BUILD ====="
    )

    api_tmp = Path(
        tempfile.mkdtemp(
            prefix="taman-s4c-api-"
        )
    )

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
            prefix="taman-s4c-fe-"
        )
    )

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

    shutil.rmtree(
        fe_tmp,
        ignore_errors=True,
    )

    print(
        "PASS: PATCHED FRONTEND BUILDS"
    )

    print("")
    print(
        "===== P8 — FINAL PATCH SCOPE ====="
    )

    print(
        "PATCHED_FILE_COUNT=2"
    )
    print(
        f"PATCHED_FILE|{SERVICE}"
    )
    print(
        f"PATCHED_FILE|{PAGE}"
    )

    print(
        "SCHEMA_PATCH=NO"
    )
    print(
        "DATABASE_MUTATION=NO"
    )
    print(
        "PRODUCTION_RUNTIME_RESTART=NO"
    )

    print(
        "PASS: MINIMAL PATCH SCOPE PRESERVED"
    )

except BaseException as exc:
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
        "SAFE STOP: S4C PATCH FAILED"
    )

    sys.exit(1)

print("")
print(
    "======================================================================"
)
print(
    " STATUS: V8.0 SERIES 08 / S4C PATCH PASSED"
)
print("")
print(
    " PATCHED:"
)
print(
    " -> IN_REVIEW DASHBOARD VISIBILITY"
)
print(
    " -> UNASSIGNED DASHBOARD VISIBILITY"
)
print(
    " -> DASHBOARD REAL DATA UI"
)
print("")
print(
    " ARCHITECTURE:"
)
print(
    " -> EXISTING DASHBOARD REUSED"
)
print(
    " -> NEW REPORTING MODULE = NO"
)
print(
    " -> NEW DATABASE TABLE = NO"
)
print(
    " -> SCHEMA PATCH = NO"
)
print("")
print(
    " NEXT AUTHORIZED ACTION:"
)
print(
    " -> S4D BUILD / STATIC ACCEPTANCE"
)
print(
    "======================================================================"
)
