#!/usr/bin/env python3

from pathlib import Path
import hashlib
import shutil
import sys
import traceback

ROOT = Path(
    "/Users/anhha/Downloads/TamAnCare_V7_4_3_Development"
)

V80 = ROOT / "V8.0"

SERVICE = (
    V80
    / "workspace"
    / "api"
    / "src"
    / "operational-care-view"
    / "operational-dashboard.service.ts"
)

BACKUP_ROOT = (
    V80
    / "backups"
    / "S4E-R3-R1-R11-R7-prepatch"
)

BACKUP_SERVICE = (
    BACKUP_ROOT
    / "operational-dashboard.service.ts"
)

EXPECTED_SERVICE_SHA = (
    "1a3057940930654837127bc1d983c7e256a167726b04f7f48a433111a67db41f"
)

OLD = "item.status === 'IN_PROGRESS'"

NEW = "item.operationalState === 'IN_PROGRESS'"


def sha256(path: Path) -> str:
    h = hashlib.sha256()

    with path.open("rb") as f:
        for chunk in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            h.update(chunk)

    return h.hexdigest()


def restore() -> None:
    if BACKUP_SERVICE.exists():
        print("RESTORING_PREPATCH_SOURCE=YES")

        shutil.copy2(
            BACKUP_SERVICE,
            SERVICE,
        )

        restored_sha = sha256(SERVICE)

        print(
            "RESTORED_SERVICE_SHA256="
            + restored_sha
        )

        if restored_sha != EXPECTED_SERVICE_SHA:
            raise RuntimeError(
                "restored service SHA does not match prepatch baseline"
            )

        print("PREPATCH_SOURCE_RESTORED=YES")


def main() -> None:
    print("=" * 70)
    print(" TAM AN CARE V8.0 — SERIES 08")
    print(" S4E-R3-R1-R11-R7 — ONE-FILE METRIC PATCH")
    print("")
    print(" EXACTLY ONE APPLICATION FILE")
    print(" NO SCHEMA CHANGE")
    print(" NO DATABASE COMMAND")
    print("=" * 70)

    print("")
    print("===== P1 — VERIFY EXACT PREPATCH HASH =====")

    actual_sha = sha256(SERVICE)

    print(
        "PREPATCH|SERVICE|ACTUAL="
        + actual_sha
        + "|EXPECTED="
        + EXPECTED_SERVICE_SHA
    )

    if actual_sha != EXPECTED_SERVICE_SHA:
        raise RuntimeError(
            "SERVICE PREPATCH SHA MISMATCH"
        )

    print("PASS: EXACT PREPATCH SERVICE LOCKED")

    print("")
    print("===== P2 — VERIFY EXACT PATCH ANCHORS =====")

    text = SERVICE.read_text(
        encoding="utf-8",
        errors="strict",
    )

    old_count = text.count(OLD)
    new_count = text.count(NEW)

    print(
        "PATCH_ANCHOR|OLD|COUNT="
        + str(old_count)
    )

    print(
        "PATCH_ANCHOR|NEW_PRE|COUNT="
        + str(new_count)
    )

    if old_count != 1:
        raise RuntimeError(
            "OLD predicate must occur exactly once"
        )

    if new_count != 0:
        raise RuntimeError(
            "NEW predicate must not preexist"
        )

    if text.count("const inReviewTasks") != 1:
        raise RuntimeError(
            "inReviewTasks declaration not unique"
        )

    if text.count("const unassignedTasks") != 1:
        raise RuntimeError(
            "unassignedTasks declaration not unique"
        )

    print("PASS: EXACT PATCH ANCHORS LOCKED")

    print("")
    print("===== P3 — CREATE PREPATCH BACKUP =====")

    if BACKUP_ROOT.exists():
        raise RuntimeError(
            "PREPATCH BACKUP ALREADY EXISTS"
        )

    BACKUP_ROOT.mkdir(
        parents=True,
        exist_ok=False,
    )

    shutil.copy2(
        SERVICE,
        BACKUP_SERVICE,
    )

    backup_sha = sha256(BACKUP_SERVICE)

    print(
        "PREPATCH_BACKUP="
        + str(BACKUP_ROOT)
    )

    print(
        "BACKUP_SERVICE_SHA256="
        + backup_sha
    )

    if backup_sha != EXPECTED_SERVICE_SHA:
        raise RuntimeError(
            "backup SHA mismatch"
        )

    print("PASS: PREPATCH BACKUP CREATED")

    print("")
    print("===== P4 — APPLY EXACT ONE-LINE PATCH =====")

    patched = text.replace(
        OLD,
        NEW,
        1,
    )

    if patched == text:
        raise RuntimeError(
            "patch produced no source delta"
        )

    SERVICE.write_text(
        patched,
        encoding="utf-8",
    )

    print(
        "PATCHED|BACKEND|"
        "item.status->item.operationalState"
    )

    print("PASS: ONE-LINE PATCH APPLIED")

    print("")
    print("===== P5 — VERIFY POSTPATCH CONTRACT =====")

    post = SERVICE.read_text(
        encoding="utf-8",
        errors="strict",
    )

    checks = {
        "OLD_REMOVED":
            post.count(OLD) == 0,

        "NEW_UNIQUE":
            post.count(NEW) == 1,

        "API_FIELD_PRESERVED":
            post.count("inReviewTasks") >= 2,

        "UNASSIGNED_PRESERVED":
            post.count("unassignedTasks") >= 2,

        "DUE_OPERATIONAL_STATE":
            "item.operationalState" in post
            and "=== 'DUE'" in post,

        "OVERDUE_OPERATIONAL_STATE":
            "item.operationalState" in post
            and "=== 'OVERDUE'" in post,

        "MISSED_OPERATIONAL_STATE":
            "item.operationalState" in post
            and "=== 'MISSED'" in post,
    }

    for name, ok in checks.items():
        print(
            f"POSTPATCH_CONTRACT|{name}|"
            + ("YES" if ok else "NO")
        )

    if not all(checks.values()):
        raise RuntimeError(
            "POSTPATCH CONTRACT FAILED"
        )

    print("PASS: POSTPATCH CONTRACT VERIFIED")

    print("")
    print("===== P6 — VERIFY EXACT PATCH DELTA =====")

    changed_lines = []

    before_lines = text.splitlines()
    after_lines = post.splitlines()

    if len(before_lines) != len(after_lines):
        raise RuntimeError(
            "unexpected line-count delta"
        )

    for index, (before, after) in enumerate(
        zip(
            before_lines,
            after_lines,
        ),
        start=1,
    ):
        if before != after:
            changed_lines.append(
                (
                    index,
                    before,
                    after,
                )
            )

    print(
        "CHANGED_LINE_COUNT="
        + str(len(changed_lines))
    )

    for line_no, before, after in changed_lines:
        print(
            f"CHANGED_LINE={line_no}"
        )
        print(
            "BEFORE="
            + before.strip()
        )
        print(
            "AFTER="
            + after.strip()
        )

    if len(changed_lines) != 1:
        raise RuntimeError(
            "patch must change exactly one source line"
        )

    if OLD not in changed_lines[0][1]:
        raise RuntimeError(
            "changed line does not contain OLD predicate"
        )

    if NEW not in changed_lines[0][2]:
        raise RuntimeError(
            "changed line does not contain NEW predicate"
        )

    print("PASS: EXACT ONE-LINE SOURCE DELTA")

    print("")
    print("===== P7 — LOCK POSTPATCH HASH =====")

    post_sha = sha256(SERVICE)

    print(
        "POSTPATCH_SHA256|dashboard_service="
        + post_sha
    )

    print("PASS: POSTPATCH HASH CAPTURED")

    print("")
    print("===== P8 — FINAL PATCH SCOPE =====")

    print("PATCHED_FILE_COUNT=1")
    print(
        "PATCHED_FILE="
        + str(SERVICE)
    )

    print("API_FIELD_RENAME=NO")
    print("FRONTEND_PATCH=NO")
    print("FE_API_PATCH=NO")
    print("SCHEMA_PATCH=NO")
    print("DATABASE_MIGRATION=NO")
    print("NEW_DATABASE_TABLE=NO")
    print("NEW_REPORTING_MODULE=NO")
    print("DATABASE_COMMAND=NO")
    print("PRODUCTION_RUNTIME_RESTART=NO")
    print("WORKSPACE_NPM_INSTALL=NO")

    print("PASS: ONE-FILE PATCH SCOPE PRESERVED")

    print("")
    print("=" * 70)
    print(
        " STATUS: S4E-R3-R1-R11-R7 PATCH EXECUTION PASSED"
    )
    print("")
    print(
        " -> item.status === IN_PROGRESS"
    )
    print(
        " -> item.operationalState === IN_PROGRESS"
    )
    print(
        " -> API FIELD inReviewTasks PRESERVED"
    )
    print(" -> PATCHED FILE COUNT = 1")
    print("=" * 70)


if __name__ == "__main__":
    try:
        main()

    except BaseException as exc:
        print(
            "PATCH_EXCEPTION="
            + repr(exc)
        )

        try:
            restore()
        except BaseException as restore_exc:
            print(
                "RESTORE_EXCEPTION="
                + repr(restore_exc)
            )

        print(
            "SAFE STOP: ONE-FILE PATCH FAILED"
        )

        traceback.print_exc()

        sys.exit(1)
