#!/usr/bin/env python3

from pathlib import Path
import hashlib
import shutil
import sys


ROOT = Path(
    "/Users/anhha/Downloads/"
    "TamAnCare_V7_4_3_Development"
)

V80 = ROOT / "V8.0"

SERVICE = (
    V80
    / "workspace/api/src/operational-care-view/"
      "operational-dashboard.service.ts"
)

PAGE = (
    V80
    / "workspace/frontend/src/features/dashboard/"
      "DashboardPage.tsx"
)

BACKUP = (
    V80
    / "backups/S4E-R3-R1-R5-prepatch"
)

EXPECTED_SERVICE_SHA = (
    "5272675b9a2bf02bff913f944b9bec768dd037a47a2d253c93475a8939d44115"
)

EXPECTED_PAGE_SHA = (
    "2028b960c82d490e43fa82c03a47e164238859bcccf23cee554182fe5039a19d"
)

OLD_BACKEND = "item.status === 'IN_REVIEW'"
NEW_BACKEND = "item.status === 'IN_PROGRESS'"

OLD_FRONTEND = "Đang rà soát"
NEW_FRONTEND = "Đang thực hiện"


def sha256(path: Path) -> str:
    h = hashlib.sha256()

    with path.open("rb") as f:
        for chunk in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            h.update(chunk)

    return h.hexdigest()


def fail(message: str) -> None:
    print(f"SAFE STOP: {message}")
    raise SystemExit(1)


def restore() -> None:
    service_backup = BACKUP / SERVICE.name
    page_backup = BACKUP / PAGE.name

    if service_backup.exists():
        shutil.copy2(
            service_backup,
            SERVICE,
        )

    if page_backup.exists():
        shutil.copy2(
            page_backup,
            PAGE,
        )


print(
    "============================================================"
)
print(
    " TAM AN CARE V8.0 — S4E-R3-R1-R5 MINIMAL STATUS PATCH"
)
print(
    " EXACTLY 2 APPLICATION FILES"
)
print(
    " NO SCHEMA CHANGE"
)
print(
    "============================================================"
)

try:
    print(
        "===== P1 — VERIFY EXACT PREPATCH HASHES ====="
    )

    service_sha = sha256(SERVICE)
    page_sha = sha256(PAGE)

    print(
        f"PREPATCH|SERVICE|ACTUAL={service_sha}"
        f"|EXPECTED={EXPECTED_SERVICE_SHA}"
    )

    print(
        f"PREPATCH|PAGE|ACTUAL={page_sha}"
        f"|EXPECTED={EXPECTED_PAGE_SHA}"
    )

    if service_sha != EXPECTED_SERVICE_SHA:
        fail("service prepatch hash mismatch")

    if page_sha != EXPECTED_PAGE_SHA:
        fail("page prepatch hash mismatch")

    print("PASS: EXACT PREPATCH SOURCE LOCKED")

    print(
        "===== P2 — VERIFY PATCH ANCHORS ====="
    )

    service_text = SERVICE.read_text(
        encoding="utf-8",
    )

    page_text = PAGE.read_text(
        encoding="utf-8",
    )

    backend_old_count = service_text.count(
        OLD_BACKEND
    )

    backend_new_count = service_text.count(
        NEW_BACKEND
    )

    frontend_old_count = page_text.count(
        OLD_FRONTEND
    )

    frontend_new_count = page_text.count(
        NEW_FRONTEND
    )

    print(
        "PATCH_ANCHOR|BACKEND_OLD"
        f"|COUNT={backend_old_count}"
    )

    print(
        "PATCH_ANCHOR|BACKEND_NEW_PRE"
        f"|COUNT={backend_new_count}"
    )

    print(
        "PATCH_ANCHOR|FRONTEND_OLD"
        f"|COUNT={frontend_old_count}"
    )

    print(
        "PATCH_ANCHOR|FRONTEND_NEW_PRE"
        f"|COUNT={frontend_new_count}"
    )

    if backend_old_count != 1:
        fail("backend patch anchor not unique")

    if backend_new_count != 0:
        fail("backend target already present")

    if frontend_old_count != 1:
        fail("frontend patch anchor not unique")

    if frontend_new_count != 0:
        fail("frontend target already present")

    print("PASS: PATCH ANCHORS LOCKED")

    print(
        "===== P3 — CREATE RECOVERY BACKUP ====="
    )

    if BACKUP.exists():
        fail("recovery backup already exists")

    BACKUP.mkdir(
        parents=True,
        exist_ok=False,
    )

    shutil.copy2(
        SERVICE,
        BACKUP / SERVICE.name,
    )

    shutil.copy2(
        PAGE,
        BACKUP / PAGE.name,
    )

    if (
        sha256(BACKUP / SERVICE.name)
        != EXPECTED_SERVICE_SHA
    ):
        fail("service backup hash mismatch")

    if (
        sha256(BACKUP / PAGE.name)
        != EXPECTED_PAGE_SHA
    ):
        fail("page backup hash mismatch")

    print(
        f"PREPATCH_BACKUP={BACKUP}"
    )

    print("PASS: RECOVERY BACKUP CREATED")

    print(
        "===== P4 — APPLY MINIMAL SEMANTIC PATCH ====="
    )

    new_service_text = service_text.replace(
        OLD_BACKEND,
        NEW_BACKEND,
        1,
    )

    new_page_text = page_text.replace(
        OLD_FRONTEND,
        NEW_FRONTEND,
        1,
    )

    SERVICE.write_text(
        new_service_text,
        encoding="utf-8",
    )

    PAGE.write_text(
        new_page_text,
        encoding="utf-8",
    )

    print(
        "PATCHED|BACKEND|IN_REVIEW->IN_PROGRESS"
    )

    print(
        "PATCHED|FRONTEND|Đang rà soát->Đang thực hiện"
    )

    print("PASS: MINIMAL PATCH APPLIED")

    print(
        "===== P5 — VERIFY POSTPATCH CONTRACT ====="
    )

    service_post = SERVICE.read_text(
        encoding="utf-8",
    )

    page_post = PAGE.read_text(
        encoding="utf-8",
    )

    checks = {
        "OLD_BACKEND_REMOVED":
            service_post.count(OLD_BACKEND) == 0,

        "NEW_BACKEND_UNIQUE":
            service_post.count(NEW_BACKEND) == 1,

        "API_FIELD_PRESERVED":
            service_post.count("inReviewTasks") == 2,

        "OLD_LABEL_REMOVED":
            page_post.count(OLD_FRONTEND) == 0,

        "NEW_LABEL_UNIQUE":
            page_post.count(NEW_FRONTEND) == 1,

        "FRONTEND_BINDING_PRESERVED":
            page_post.count(
                "dashboard?.summary?.inReviewTasks"
            ) == 1,
    }

    for name, passed in checks.items():
        print(
            f"POSTPATCH_CONTRACT|{name}|"
            + ("YES" if passed else "NO")
        )

    if not all(checks.values()):
        fail("postpatch contract failed")

    print("PASS: POSTPATCH CONTRACT VERIFIED")

    print(
        "===== P6 — LOCK POSTPATCH HASHES ====="
    )

    print(
        "POSTPATCH_SHA256|dashboard_service="
        + sha256(SERVICE)
    )

    print(
        "POSTPATCH_SHA256|dashboard_page="
        + sha256(PAGE)
    )

    print("PASS: POSTPATCH HASHES CAPTURED")

    print(
        "===== P7 — FINAL PATCH SCOPE ====="
    )

    print("PATCHED_FILE_COUNT=2")
    print(f"PATCHED_FILE={SERVICE}")
    print(f"PATCHED_FILE={PAGE}")

    print("API_FIELD_RENAME=NO")
    print("FE_API_PATCH=NO")
    print("SCHEMA_PATCH=NO")
    print("DATABASE_MIGRATION=NO")
    print("NEW_DATABASE_TABLE=NO")
    print("NEW_REPORTING_MODULE=NO")

    print("PASS: MINIMAL PATCH SCOPE PRESERVED")

    print(
        "============================================================"
    )

    print(
        " STATUS: S4E-R3-R1-R5 PATCH EXECUTION PASSED"
    )

    print(
        " -> BACKEND STATUS = IN_PROGRESS"
    )

    print(
        " -> API FIELD = inReviewTasks PRESERVED"
    )

    print(
        " -> UI LABEL = Đang thực hiện"
    )

    print(
        " -> PATCHED FILE COUNT = 2"
    )

    print(
        "============================================================"
    )

except BaseException:
    try:
        restore()
        print(
            "RECOVERY_RESTORE_ATTEMPTED=YES"
        )
    except BaseException as restore_error:
        print(
            "RECOVERY_RESTORE_FAILED="
            + repr(restore_error)
        )

    raise
