#!/usr/bin/env python3
"""
Evidence-based Guardian release gate.

This gate PASSES only when:
  1. docs/guardian-auth/staff-guardian-regression-matrix.md contains all 22 cases.
  2. api/test-results/guardian-isolated-results.json exists and was written by
     the current GitHub Actions run (head_sha == GITHUB_SHA).
  3. All 22 required cases (STAFF01-STAFF10, GUARD01-GUARD12) are present with
     status == "passed".

Build success, matching names, or static assertions DO NOT substitute for this.
"""
import json
import os
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
matrix = root / "docs/guardian-auth/staff-guardian-regression-matrix.md"
report = root / "api/test-results/guardian-isolated-results.json"

REQUIRED = (
    [f"STAFF{i:02d}" for i in range(1, 11)]
    + [f"GUARD{i:02d}" for i in range(1, 13)]
)
assert len(REQUIRED) == 22  # sanity

# ---------------------------------------------------------------------------
# Gate 1: Specification matrix exists and is complete
# ---------------------------------------------------------------------------
if not matrix.is_file():
    print("GUARDIAN_MATRIX=MISSING")
    print("RELEASE_DECISION=NO_GO")
    print("CI_BLOCKER=MISSING_SPECIFICATION_MATRIX")
    sys.exit(1)

found = re.findall(
    r"^\|\s*((?:STAFF|GUARD)\d{2})\s*\|", matrix.read_text(encoding="utf-8"), re.M
)
if sorted(found) != sorted(REQUIRED):
    print(f"GUARDIAN_MATRIX=INCOMPLETE found={sorted(found)}")
    print("RELEASE_DECISION=NO_GO")
    print("CI_BLOCKER=INCOMPLETE_SPECIFICATION_MATRIX")
    sys.exit(1)

print("GUARDIAN_MATRIX=22_SPECIFICATIONS_VERIFIED")

# ---------------------------------------------------------------------------
# Gate 2: Executable evidence file exists
# ---------------------------------------------------------------------------
if not report.is_file():
    print("TEST_EVIDENCE=MISSING")
    print("RELEASE_DECISION=NO_GO")
    print("CI_BLOCKER=NO_EVIDENCE_FILE_api_test_results_guardian_isolated_results_json")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Gate 3: Parse and validate evidence
# ---------------------------------------------------------------------------
try:
    data = json.loads(report.read_text(encoding="utf-8"))
except (OSError, ValueError, TypeError) as exc:
    print(f"TEST_EVIDENCE_INVALID={type(exc).__name__}")
    print("RELEASE_DECISION=NO_GO")
    print("CI_BLOCKER=UNPARSEABLE_EVIDENCE_FILE")
    sys.exit(1)

tests = data.get("tests", [])
evidence_sha = data.get("head_sha", "")
github_sha = os.getenv("GITHUB_SHA", "")

# ---------------------------------------------------------------------------
# Gate 4: SHA provenance — evidence must match the current CI run
#         (On local runs GITHUB_SHA is empty; allow that for developer use
#          but flag it clearly.)
# ---------------------------------------------------------------------------
sha_match = (not github_sha) or (evidence_sha == github_sha)
if not sha_match:
    print(f"EVIDENCE_SHA={evidence_sha}")
    print(f"GITHUB_SHA={github_sha}")
    print("TEST_EVIDENCE=SHA_MISMATCH")
    print("RELEASE_DECISION=NO_GO")
    print("CI_BLOCKER=EVIDENCE_SHA_DOES_NOT_MATCH_GITHUB_SHA")
    sys.exit(1)

if not github_sha:
    print("EVIDENCE_SHA_CHECK=SKIPPED_LOCAL_RUN_NO_GITHUB_SHA")
else:
    print(f"EVIDENCE_SHA={evidence_sha}")
    print("EVIDENCE_SHA_CHECK=MATCHED")

# ---------------------------------------------------------------------------
# Gate 5: All 22 required cases must be present and passed
# ---------------------------------------------------------------------------
passed_map = {}
for item in tests:
    name = item.get("name", "")
    status = item.get("status", "")
    if name in REQUIRED and status == "passed":
        passed_map[name] = item

missing = [c for c in REQUIRED if c not in passed_map]

print(f"REQUIRED_CASES=22")
print(f"VERIFIED_PASSED_CASES={len(passed_map)}")
if missing:
    print(f"MISSING_OR_FAILED_CASES={','.join(missing)}")
    print("TEST_EVIDENCE=INCOMPLETE")
    print("RELEASE_DECISION=NO_GO")
    print("CI_BLOCKER=NOT_ALL_22_CASES_PASSED")
    sys.exit(1)

# ---------------------------------------------------------------------------
# All gates passed
# ---------------------------------------------------------------------------
print("GUARDIAN_22_CASE_EVIDENCE=ALL_PASSED")
print("CANONICAL_SOURCE_PROVENANCE=CI_SHA_ATTESTED" if github_sha else "CANONICAL_SOURCE_PROVENANCE=LOCAL_RUN_NOT_ATTESTED")
print("RELEASE_DECISION=TECHNICAL_ACCEPTANCE_GATES_PASSED")
print(
    "NOTE=Production deployment still requires separate human approval per production-test-safety.md"
)
sys.exit(0)
