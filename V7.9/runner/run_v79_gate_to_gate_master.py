from __future__ import annotations

from pathlib import Path
from datetime import datetime, timezone
import subprocess
import hashlib
import json
import os
import re
import sys


ROOT = Path(
    "/Users/anhha/Downloads/"
    "TamAnCare_V7_4_3_Development"
)

V79 = ROOT / "V7.9"

RUNNERS = V79 / "runner"
RESULTS = V79 / "results"
MANIFESTS = V79 / "manifests"
STATE_DIR = V79 / "state"

STATE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

STATE_FILE = (
    STATE_DIR
    / "V7.9-GATE-TO-GATE-MASTER-STATE.json"
)

MASTER_RESULT = (
    RESULTS
    / "V7.9-GATE-TO-GATE-MASTER-RESULT.txt"
)

MASTER_MANIFEST = (
    MANIFESTS
    / "V7.9-GATE-TO-GATE-MASTER.json"
)


EXPECTED_V77_API_IMAGE = (
    "sha256:"
    "36b1511ed4b4872bb6ff1a669c19a0a6"
    "e245d9e649277b5db01ec433964ef4b7"
)

EXPECTED_V77_UI_IMAGE = (
    "sha256:"
    "53bf7afecf93a6a29cb984ac20464cc8"
    "2c72789bffe6f3d977a1f56731a85147"
)


def now():
    return datetime.now(
        timezone.utc
    ).isoformat()


def sha(path: Path) -> str:
    h = hashlib.sha256()

    with path.open("rb") as f:
        for block in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            h.update(block)

    return h.hexdigest()


def banner(text: str):
    print()
    print("=" * 110)
    print(" " + text)
    print("=" * 110)
    print()


def run(
    args,
    *,
    cwd=None,
    capture=True,
):
    p = subprocess.run(
        args,
        cwd=cwd,
        text=True,
        stdout=(
            subprocess.PIPE
            if capture
            else None
        ),
        stderr=(
            subprocess.STDOUT
            if capture
            else None
        ),
    )

    return p


def docker_value(
    container: str,
    template: str,
):
    p = run([
        "docker",
        "inspect",
        "-f",
        template,
        container,
    ])

    if p.returncode != 0:
        raise RuntimeError(
            p.stdout.strip()
        )

    return p.stdout.strip()


def http_code(
    url: str,
    method="GET",
):
    p = run([
        "curl",
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "-X",
        method,
        url,
    ])

    if p.returncode != 0:
        return "000"

    return p.stdout.strip()


def production_guard():

    api_container = (
        "taman-care-v77-production-api"
    )

    ui_container = (
        "taman-care-v77-production-ui"
    )

    api_state = docker_value(
        api_container,
        "{{.State.Status}}",
    )

    ui_state = docker_value(
        ui_container,
        "{{.State.Status}}",
    )

    api_image = docker_value(
        api_container,
        "{{.Image}}",
    )

    ui_image = docker_value(
        ui_container,
        "{{.Image}}",
    )

    api_health = http_code(
        "http://127.0.0.1:3100/api/health"
    )

    ui_health = http_code(
        "http://127.0.0.1:8080/api/health"
    )

    staff_no_actor = http_code(
        "http://127.0.0.1:3100/"
        "api/operations/staff-actors"
    )

    access_no_actor = http_code(
        "http://127.0.0.1:3100/"
        "api/operations/access-assignments"
    )

    print(
        "PRODUCTION_API_STATE="
        + api_state
    )

    print(
        "PRODUCTION_UI_STATE="
        + ui_state
    )

    print(
        "PRODUCTION_API_IMAGE="
        + api_image
    )

    print(
        "PRODUCTION_UI_IMAGE="
        + ui_image
    )

    print(
        "PRODUCTION_API_HEALTH="
        + api_health
    )

    print(
        "PRODUCTION_UI_HEALTH="
        + ui_health
    )

    print(
        "STAFF_NO_ACTOR="
        + staff_no_actor
    )

    print(
        "ACCESS_NO_ACTOR="
        + access_no_actor
    )

    checks = {
        "api_running":
            api_state == "running",

        "ui_running":
            ui_state == "running",

        "api_image":
            api_image
            == EXPECTED_V77_API_IMAGE,

        "ui_image":
            ui_image
            == EXPECTED_V77_UI_IMAGE,

        "api_health":
            api_health == "200",

        "ui_health":
            ui_health == "200",

        "staff_fail_closed":
            staff_no_actor == "401",

        "access_fail_closed":
            access_no_actor == "401",
    }

    failed = [
        k for k, v
        in checks.items()
        if not v
    ]

    if failed:
        raise RuntimeError(
            "PRODUCTION GUARD FAILED: "
            + ",".join(failed)
        )

    return {
        "api_state":
            api_state,

        "ui_state":
            ui_state,

        "api_image":
            api_image,

        "ui_image":
            ui_image,

        "api_health":
            api_health,

        "ui_health":
            ui_health,

        "staff_no_actor":
            staff_no_actor,

        "access_no_actor":
            access_no_actor,
    }


def load_state():

    if not STATE_FILE.is_file():
        return {
            "version":
                "V7.9",

            "started_at":
                now(),

            "status":
                "RUNNING",

            "completed_series":
                [],

            "series_runs":
                [],
        }

    try:
        return json.loads(
            STATE_FILE.read_text()
        )

    except Exception:
        raise RuntimeError(
            "MASTER STATE CORRUPTED"
        )


def save_state(state):

    STATE_FILE.write_text(
        json.dumps(
            state,
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )


def accepted_result_files():
    out = []

    for p in RESULTS.glob(
        "V7.9-*.txt"
    ):
        try:
            text = p.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except Exception:
            continue

        if (
            "STATUS=PASSED" in text
            or
            "STATUS: PASSED" in text
            or
            " PASS" in text
        ):
            out.append(p)

    return sorted(out)


def series_number(path: Path):

    m = re.search(
        r'run_series(\d+)',
        path.name,
        re.I,
    )

    if not m:
        return None

    return int(
        m.group(1)
    )


def discover_series_runners():

    found = []

    for p in RUNNERS.glob(
        "run_series*.py"
    ):
        num = series_number(p)

        if num is None:
            continue

        found.append(
            (
                num,
                p,
            )
        )

    return sorted(
        found,
        key=lambda x: x[0],
    )


def find_explicit_next_preflights():

    candidates = []

    search_roots = [
        V79,
        ROOT,
    ]

    seen = set()

    for base in search_roots:

        for p in base.glob(
            "V7.9*PREFLIGHT*.txt"
        ):
            rp = str(
                p.resolve()
            )

            if rp in seen:
                continue

            seen.add(rp)
            candidates.append(p)

        if base == V79:

            for p in base.rglob(
                "*PREFLIGHT*.txt"
            ):
                rp = str(
                    p.resolve()
                )

                if rp in seen:
                    continue

                if "V7.9" not in p.name:
                    continue

                seen.add(rp)
                candidates.append(p)

    return sorted(
        candidates,
        key=lambda p:
            p.stat().st_mtime
    )


def compile_runner(path: Path):

    p = run([
        sys.executable,
        "-m",
        "py_compile",
        str(path),
    ])

    if p.returncode != 0:
        print(
            p.stdout
        )

        raise RuntimeError(
            "RUNNER SYNTAX FAILED: "
            + str(path)
        )


def execute_runner(path: Path):

    banner(
        "EXECUTING "
        + path.name
    )

    before_guard = production_guard()

    compile_runner(
        path
    )

    before_results = {
        str(p):
            sha(p)
        for p in RESULTS.glob(
            "V7.9-*.txt"
        )
    }

    p = subprocess.run(
        [
            sys.executable,
            str(path),
        ],
        cwd=str(ROOT),
        text=True,
    )

    if p.returncode != 0:

        production_guard()

        raise RuntimeError(
            "SERIES RUNNER FAILED: "
            + path.name
            + " EXIT="
            + str(p.returncode)
        )

    after_guard = production_guard()

    after_results = {
        str(p):
            sha(p)
        for p in RESULTS.glob(
            "V7.9-*.txt"
        )
    }

    new_or_changed = []

    for name, digest in after_results.items():

        if (
            name not in before_results
            or
            before_results[name]
            != digest
        ):
            new_or_changed.append(
                {
                    "path":
                        name,

                    "sha256":
                        digest,
                }
            )

    return {
        "runner":
            str(path),

        "runner_sha256":
            sha(path),

        "completed_at":
            now(),

        "before_production":
            before_guard,

        "after_production":
            after_guard,

        "new_or_changed_results":
            new_or_changed,
    }


def has_series_completion(
    series_no: int,
):

    patterns = [
        f"SERIES {series_no:02d}",
        f"SERIES_{series_no:02d}",
        f"SERIES-{series_no:02d}",
    ]

    for p in accepted_result_files():

        text = p.read_text(
            encoding="utf-8",
            errors="ignore",
        ).upper()

        if not any(
            x.upper() in text
            for x in patterns
        ):
            continue

        if (
            "STATUS=PASSED" in text
            or
            "STATUS: PASSED" in text
        ):
            return True

    # Series runners used earlier may close a Phase
    # without literal SERIES status.
    #
    # Therefore use exact Phase-final evidence for
    # the known sequence as secondary checkpoint.

    phase_map = {
        1: "PHASE-0",
        2: "PHASE-1",
        3: "PHASE-2",
        4: "PHASE-3",
        5: "PHASE-4",
        6: "PHASE-5",
        7: "PHASE-6",
    }

    marker = phase_map.get(
        series_no
    )

    if marker:

        for p in accepted_result_files():

            name = p.name.upper()

            if (
                marker in name
                and
                (
                    "FINAL" in name
                    or
                    "CLOSED" in name
                )
            ):
                return True

    return False


def state_has_completed_series(
    state,
    number,
):
    return number in state.get(
        "completed_series",
        []
    )


def mark_completed(
    state,
    number,
    run_info=None,
):

    completed = state.setdefault(
        "completed_series",
        []
    )

    if number not in completed:
        completed.append(
            number
        )

    completed.sort()

    if run_info:
        state.setdefault(
            "series_runs",
            []
        ).append(
            {
                "series":
                    number,
                **run_info,
            }
        )

    save_state(
        state
    )


def latest_preflight():

    items = find_explicit_next_preflights()

    if not items:
        return None

    return items[-1]


def write_final(
    state,
    status,
    reason,
):

    guard = production_guard()

    state[
        "status"
    ] = status

    state[
        "ended_at"
    ] = now()

    state[
        "reason"
    ] = reason

    save_state(
        state
    )

    manifest = {
        "version":
            "V7.9",

        "status":
            status,

        "reason":
            reason,

        "completed_series":
            state.get(
                "completed_series",
                []
            ),

        "production":
            guard,

        "state_file":
            str(
                STATE_FILE
            ),

        "state_hash":
            sha(
                STATE_FILE
            ),

        "production_database_mutation":
            False,

        "production_runtime_restart_by_master":
            False,

        "v77_source_write":
            False,

        "v76_rollback_delete":
            False,
    }

    MASTER_MANIFEST.write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )

    MASTER_RESULT.write_text(
        "\n".join([
            "TAM AN CARE V7.9",
            "GATE-TO-GATE MASTER",

            "STATUS="
            + status,

            "REASON="
            + reason,

            "COMPLETED_SERIES="
            + ",".join(
                str(x)
                for x in state.get(
                    "completed_series",
                    []
                )
            ),

            "PRODUCTION_API_HEALTH="
            + guard[
                "api_health"
            ],

            "PRODUCTION_UI_HEALTH="
            + guard[
                "ui_health"
            ],

            "STAFF_NO_ACTOR="
            + guard[
                "staff_no_actor"
            ],

            "ACCESS_NO_ACTOR="
            + guard[
                "access_no_actor"
            ],

            "PRODUCTION_DATABASE_MUTATION=NO",
            "PRODUCTION_RUNTIME_RESTART_BY_MASTER=NO",
            "V7.7_SOURCE_WRITE=NO",
            "V7.6_ROLLBACK_DELETE=NO",
        ])
        + "\n"
    )

    print(
        "MASTER_RESULT_HASH="
        + sha(
            MASTER_RESULT
        )
    )

    print(
        "MASTER_MANIFEST_HASH="
        + sha(
            MASTER_MANIFEST
        )
    )


def main():

    banner(
        "TAM AN CARE V7.9 "
        "GATE-TO-GATE MASTER EXECUTION"
    )

    print(
        "MODE="
        "SERIAL_FAIL_FAST_RESUMABLE"
    )

    print(
        "ROADMAP_AUTHORITY="
        "EXISTING_RUNNERS_AND_EXPLICIT_PREFLIGHTS_ONLY"
    )

    print(
        "INVENT_NEW_PHASE=NO"
    )

    print(
        "RERUN_ACCEPTED_SERIES=NO"
    )

    print(
        "PRODUCTION_DATABASE_MUTATION_BY_MASTER=NO"
    )

    print(
        "PRODUCTION_RUNTIME_RESTART_BY_MASTER=NO"
    )

    print(
        "V7.7_SOURCE_WRITE=NO"
    )

    print(
        "V7.6_ROLLBACK_DELETE=NO"
    )

    state = load_state()

    production_guard()

    runners = discover_series_runners()

    if not runners:
        write_final(
            state,
            "STOPPED_SAFELY",
            "NO_V7.9_SERIES_RUNNER_FOUND",
        )

        raise SystemExit(2)

    print()
    print(
        "DISCOVERED_SERIES_RUNNER_COUNT="
        + str(len(runners))
    )

    for number, path in runners:
        print(
            "SERIES_RUNNER|"
            + str(number)
            + "|"
            + str(
                path.relative_to(ROOT)
            )
            + "|SHA256="
            + sha(path)
        )

    # ---------------------------------------------------------
    # Execute only in serial series order.
    # ---------------------------------------------------------

    for number, path in runners:

        if state_has_completed_series(
            state,
            number,
        ):
            print(
                "SKIP_STATE_ACCEPTED_SERIES_"
                + str(number)
                + "=YES"
            )
            continue

        if has_series_completion(
            number
        ):
            print(
                "SKIP_EVIDENCE_ACCEPTED_SERIES_"
                + str(number)
                + "=YES"
            )

            mark_completed(
                state,
                number,
            )

            continue

        # Do not jump across missing previous series.
        if number > 1:

            previous = number - 1

            if not (
                state_has_completed_series(
                    state,
                    previous,
                )
                or
                has_series_completion(
                    previous
                )
            ):
                write_final(
                    state,
                    "STOPPED_SAFELY",
                    (
                        "PREVIOUS_SERIES_NOT_ACCEPTED:"
                        + str(previous)
                    ),
                )

                raise SystemExit(3)

        info = execute_runner(
            path
        )

        # After runner returns 0, it still must have
        # produced accepted phase/series evidence.
        if not has_series_completion(
            number
        ):

            # Some current runner versions use resumable state
            # and return only after a safe stop.
            #
            # Treat absence of final evidence as incomplete,
            # never as success.
            write_final(
                state,
                "STOPPED_SAFELY",
                (
                    "SERIES_RETURNED_WITHOUT_FINAL_ACCEPTANCE:"
                    + str(number)
                ),
            )

            raise SystemExit(4)

        mark_completed(
            state,
            number,
            info,
        )

        print(
            "PASS: SERIES_"
            + str(number)
            + "_ACCEPTED"
        )

    # ---------------------------------------------------------
    # Re-discover runners because a completed series may have
    # generated the next series runner.
    # ---------------------------------------------------------

    rediscovered = discover_series_runners()

    known_numbers = {
        n
        for n, _
        in runners
    }

    new_numbers = [
        n
        for n, _
        in rediscovered
        if n not in known_numbers
    ]

    if new_numbers:

        print(
            "NEW_SERIES_RUNNER_GENERATED="
            + ",".join(
                str(x)
                for x
                in new_numbers
            )
        )

        # Exit intentionally with continuation state.
        #
        # This prevents the current Python process from
        # executing code that appeared after startup without
        # first SHA-locking it on the next master invocation.
        write_final(
            state,
            "CONTINUE_REQUIRED",
            "NEW_SERIES_RUNNER_DISCOVERED_REINVOKE_MASTER",
        )

        return 10

    next_pf = latest_preflight()

    if next_pf:

        print(
            "LATEST_EXPLICIT_PREFLIGHT="
            + str(
                next_pf.relative_to(ROOT)
            )
        )

        print(
            "LATEST_EXPLICIT_PREFLIGHT_HASH="
            + sha(next_pf)
        )

        # If a roadmap preflight exists but no executable
        # runner implements it, stop rather than inventing it.

        text = next_pf.read_text(
            encoding="utf-8",
            errors="ignore",
        )

        unresolved = (
            "NEXT" in text.upper()
            or
            "PREFLIGHT" in text.upper()
        )

        if unresolved:

            write_final(
                state,
                "STOPPED_SAFELY",
                (
                    "EXPLICIT_NEXT_PREFLIGHT_EXISTS_"
                    "BUT_NO_NEW_RUNNER"
                ),
            )

            return 11

    write_final(
        state,
        "PASSED",
        "ALL_CURRENTLY_DEFINED_V7.9_SERIES_ACCEPTED",
    )

    return 0


try:
    rc = main()

except Exception as exc:

    print()
    print("=" * 110)
    print(
        " V7.9 MASTER STOPPED SAFELY"
    )
    print("=" * 110)

    print(
        "REASON="
        + str(exc)
    )

    try:
        production_guard()
    except Exception as guard_exc:
        print(
            "PRODUCTION_GUARD_EXCEPTION="
            + str(guard_exc)
        )

    sys.exit(20)

sys.exit(
    rc or 0
)
