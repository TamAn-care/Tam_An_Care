#!/usr/bin/env python3
"""Fail-closed CI gate: specification is NOT evidence of executed tests."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[2]
matrix = root / "docs/guardian-auth/staff-guardian-regression-matrix.md"
baseline = root / "docs/guardian-auth/github-transition-baseline-20261012.md"

if not matrix.is_file() or not baseline.is_file():
    print("GUARDIAN_AUTH_MATRIX=FAIL_MISSING_DOCUMENTS")
    sys.exit(1)

text = matrix.read_text(encoding="utf-8")
required = [f"STAFF{i:02d}" for i in range(1, 11)] + [
    f"GUARD{i:02d}" for i in range(1, 13)
]
found = re.findall(r"^\|\s*((?:STAFF|GUARD)\d{2})\s*\|", text, re.M)
if len(found) != 22 or set(found) != set(required):
    print(f"GUARDIAN_AUTH_MATRIX=FAIL_EXPECTED_22_ACTUAL_{len(found)}")
    sys.exit(1)

print("GUARDIAN_AUTH_MATRIX=22_SPECIFICATIONS_PASS")
print("GUARDIAN_AUTH_EXECUTABLE_REGRESSION=NOT_IMPLEMENTED")
print("STAFF_AUTH_REGRESSION=NOT_RUN")
print("GUARDIAN_SCOPE_REGRESSION=NOT_RUN")
print("CANONICAL_SOURCE_PROVENANCE=NOT_PROVEN")
print("RELEASE_DECISION=NO_GO")
print("CI_BLOCKER=INTENTIONAL_FAIL_CLOSED_UNTIL_REAL_TESTS_AND_PROVENANCE")
sys.exit(1)
