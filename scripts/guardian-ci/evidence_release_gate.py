#!/usr/bin/env python3
"""Evidence-based Guardian release gate. Never equate test specifications with execution."""
import json
import os
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
matrix = root / "docs/guardian-auth/staff-guardian-regression-matrix.md"
report = root / "api/test-results/guardian-isolated-results.json"
required = [f"STAFF{i:02d}" for i in range(1, 11)] + [f"GUARD{i:02d}" for i in range(1, 13)]
if not matrix.is_file():
    print("GUARDIAN_MATRIX=MISSING")
    sys.exit(1)
found = re.findall(r"^\|\s*((?:STAFF|GUARD)\d{2})\s*\|", matrix.read_text(encoding="utf-8"), re.M)
if sorted(found) != sorted(required):
    print("GUARDIAN_MATRIX=INCOMPLETE_OR_DUPLICATED")
    sys.exit(1)
print("GUARDIAN_MATRIX=22_SPECIFICATIONS_PASS")
# No guessed links between internal node tests and mandatory authorization scenarios.
evidence = {}
if report.exists():
    try:
        data = json.loads(report.read_text(encoding="utf-8"))
        for item in data.get("tests", []):
            name = item.get("name", "")
            match = re.fullmatch(r"(STAFF\d{2}|GUARD\d{2})", name)
            if match and item.get("status") == "passed" and item.get("head_sha") == os.getenv("GITHUB_SHA"):
                evidence[name] = item
    except (OSError, ValueError, TypeError) as exc:
        print(f"TEST_EVIDENCE_INVALID={type(exc).__name__}")
missing = [case for case in required if case not in evidence]
print("REQUIRED_CASES=22")
print("VERIFIED_REQUIRED_CASES=" + str(22-len(missing)))
print("MISSING_CASES=" + ",".join(missing))
print("EXISTING_ISOLATED_TESTS_ARE_NOT_AUTOMATICALLY_22_CASE_EVIDENCE=YES")
# Source parity must be separately attested against production runtime digest.
print("CANONICAL_SOURCE_PROVENANCE=NOT_PROVEN")
print("RELEASE_DECISION=NO_GO")
print("CI_BLOCKER=EXECUTABLE_CASES_AND_RUNTIME_SOURCE_PROVENANCE")
sys.exit(1)
