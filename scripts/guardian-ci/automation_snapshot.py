#!/usr/bin/env python3
"""Read-only, fail-closed Guardian readiness snapshot; never authorizes deployment."""
from __future__ import annotations
import argparse, json, re, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CRITICAL = [
 "api/src/security/production-auth.middleware.ts",
 "api/src/staff-actors/staff-actor.service.ts",
 "api/src/resident-access-scope/resident-access-scope.service.ts",
 "api/src/residents/resident.controller.ts",
]
IDS = [f"STAFF{i:02d}" for i in range(1, 11)] + [f"GUARD{i:02d}" for i in range(1, 13)]
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args=parser.parse_args()
    sources={}
    for path in CRITICAL:
        f=ROOT/path
        sources[path]=f.read_text(encoding="utf-8") if f.is_file() else ""
    matrix=ROOT/"docs/guardian-auth/staff-guardian-regression-matrix.md"
    matrix_text=matrix.read_text(encoding="utf-8") if matrix.is_file() else ""
    found=re.findall(r"^\|\s*((?:STAFF|GUARD)\d{2})\s*\|", matrix_text, re.M)
    scope=sources["api/src/resident-access-scope/resident-access-scope.service.ts"]
    checks={
       "critical_sources_present":all(sources.values()),
       "22_acceptance_cases_specified_once":len(found)==22 and sorted(found)==sorted(IDS),
       "no_unconditional_scope_allow":not re.search(r"return\s+[^;]*\|\|\s*true\s*;",scope),
       "supervisor_checks_canonical_actor":bool(re.search(r"if\s*\(\s*!canonicalActor\s*\)\s*\{\s*return\s+false\s*;",scope)),
       "resident_scope_queries_active_residents":"active_status = true" in scope,
    }
    blocking=[k for k,v in checks.items() if not v]
    snapshot={
      "schema_version":1,
      "created_at":datetime.now(timezone.utc).isoformat(),
      "revision":__import__("os").environ.get("GITHUB_SHA","UNKNOWN"),
      "checks":checks,
      "static_guard": "PASS" if not blocking else "FAIL",
      "static_blockers":blocking,
      "staff_10_case_behavioral_regression":"NOT_PROVEN_BY_THIS_JOB",
      "guardian_12_case_behavioral_regression":"NOT_PROVEN_BY_THIS_JOB",
      "canonical_source_provenance":"NOT_PROVEN",
      "release_decision":"NO_GO",
      "production_deployment_authorized":False,
    }
    target=Path(args.output)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(snapshot,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("STATIC_GUARD="+snapshot["static_guard"])
    print("STATIC_BLOCKERS="+",".join(blocking) if blocking else "STATIC_BLOCKERS=NONE")
    print("RELEASE_DECISION=NO_GO")
    return 1 if blocking else 0
if __name__=="__main__":
    sys.exit(main())
