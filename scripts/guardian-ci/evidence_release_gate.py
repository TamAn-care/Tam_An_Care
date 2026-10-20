#!/usr/bin/env python3
"""
Evidence-based Guardian isolated policy-test gate.

This gate PASSES only when:
  1. docs/guardian-auth/staff-guardian-regression-matrix.md contains all 22 cases.
  2. api/test-results/guardian-isolated-results.json exists and was written by
     the current GitHub Actions run (head_sha == GITHUB_SHA).
  3. The evidence identifies the in-memory policy harness explicitly.
  4. Every case ran, passed, and is bound to this exact GitHub SHA and harness.

This gate does not replace the separate PostgreSQL 16 HTTP/Chromium workflow.
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
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=MISSING_SPECIFICATION_MATRIX")
    sys.exit(1)

found = re.findall(
    r"^\|\s*((?:STAFF|GUARD)\d{2})\s*\|", matrix.read_text(encoding="utf-8"), re.M
)
if sorted(found) != sorted(REQUIRED):
    print(f"GUARDIAN_MATRIX=INCOMPLETE found={sorted(found)}")
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=INCOMPLETE_SPECIFICATION_MATRIX")
    sys.exit(1)

print("GUARDIAN_MATRIX=22_SPECIFICATIONS_VERIFIED")

# ---------------------------------------------------------------------------
# Gate 2: Executable evidence file exists
# ---------------------------------------------------------------------------
if not report.is_file():
    print("TEST_EVIDENCE=MISSING")
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=NO_EVIDENCE_FILE_api_test_results_guardian_isolated_results_json")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Gate 3: Parse and validate evidence
# ---------------------------------------------------------------------------
try:
    data = json.loads(report.read_text(encoding="utf-8"))
except (OSError, ValueError, TypeError) as exc:
    print(f"TEST_EVIDENCE_INVALID={type(exc).__name__}")
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=UNPARSEABLE_EVIDENCE_FILE")
    sys.exit(1)

if data.get("schema") != "guardian-22-case-evidence-v1":
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=UNSUPPORTED_EVIDENCE_SCHEMA")
    sys.exit(1)

tests = data.get("tests")
if not isinstance(tests, list):
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=TEST_EVIDENCE_CASE_LIST_INVALID")
    sys.exit(1)

evidence_sha = data.get("head_sha", "")
github_sha = os.getenv("GITHUB_SHA", "")

# ---------------------------------------------------------------------------
# Gate 4: SHA provenance is mandatory; local runs cannot produce CI acceptance.
# ---------------------------------------------------------------------------
if os.getenv("GITHUB_ACTIONS") != "true":
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=GITHUB_ACTIONS_RUNTIME_REQUIRED")
    sys.exit(1)

if not github_sha:
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=GITHUB_SHA_REQUIRED_FOR_CI_EVIDENCE")
    sys.exit(1)

if evidence_sha != github_sha:
    print(f"EVIDENCE_SHA={evidence_sha}")
    print(f"GITHUB_SHA={github_sha}")
    print("TEST_EVIDENCE=SHA_MISMATCH")
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=EVIDENCE_SHA_DOES_NOT_MATCH_GITHUB_SHA")
    sys.exit(1)

print(f"EVIDENCE_SHA={evidence_sha}")
print("EVIDENCE_SHA_CHECK=MATCHED")

# ---------------------------------------------------------------------------
# Gate 5: Report and each case must identify the actual in-memory harness.
# ---------------------------------------------------------------------------
required_environment = "isolated-in-memory-no-db"
if data.get("environment") != required_environment:
    print(f"TEST_ENVIRONMENT={data.get('environment', 'MISSING')}")
    print(f"REQUIRED_TEST_ENVIRONMENT={required_environment}")
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=POLICY_EVIDENCE_ENVIRONMENT_MISMATCH")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Gate 5: All 22 required cases must be present and passed
# ---------------------------------------------------------------------------
case_map = {}
invalid = []
for item in tests:
    if not isinstance(item, dict):
        invalid.append("INVALID_CASE_RECORD")
        continue
    name = item.get("name", "")
    if name not in REQUIRED or name in case_map:
        invalid.append(name or "MISSING_NAME")
        continue
    case_map[name] = item

missing = [case for case in REQUIRED if case not in case_map]
not_passed = [case for case, item in case_map.items() if item.get("status") != "passed"]
wrong_sha = [case for case, item in case_map.items() if item.get("head_sha") != github_sha]
wrong_environment = [case for case, item in case_map.items() if item.get("environment") != required_environment]
errors_present = [case for case, item in case_map.items() if item.get("error") not in (None, "")]

print("REQUIRED_CASES=22")
print(f"UNIQUE_CASES={len(case_map)}")
if invalid:
    print(f"DUPLICATE_OR_UNEXPECTED_CASES={','.join(invalid)}")
if missing:
    print(f"MISSING_CASES={','.join(missing)}")
if not_passed:
    print(f"NOT_PASSED_CASES={','.join(not_passed)}")
if wrong_sha:
    print(f"CASE_SHA_MISMATCH={','.join(wrong_sha)}")
if wrong_environment:
    print(f"CASE_ENVIRONMENT_MISMATCH={','.join(wrong_environment)}")
if errors_present:
    print(f"CASE_ERRORS_PRESENT={','.join(errors_present)}")

if invalid or missing or not_passed or wrong_sha or wrong_environment or errors_present or len(case_map) != 22:
    print("POLICY_GATE=NO_GO")
    print("CI_BLOCKER=POLICY_CASE_EVIDENCE_INCOMPLETE_OR_MISMATCHED")
    sys.exit(1)

# ---------------------------------------------------------------------------
# All gates passed
# ---------------------------------------------------------------------------
print("GUARDIAN_22_CASE_POLICY_EVIDENCE=ALL_PASSED")
print("CANONICAL_SOURCE_PROVENANCE=CI_SHA_ATTESTED")
print("POLICY_GATE=PASS")
print("NOTE=PostgreSQL 16 HTTP and Chromium acceptance is evaluated by guardian-http-browser on the same candidate SHA; neither workflow authorizes deployment")
sys.exit(0)
