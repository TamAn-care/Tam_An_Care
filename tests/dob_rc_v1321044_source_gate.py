"""V132.10.44: fail-closed source-to-image release provenance gate.

This is NOT an E2E test. It never contacts Production Test.
"""
from pathlib import Path
import hashlib
import json
import os
import re

ROOT = Path(__file__).resolve().parents[1]
TARGET_RC_API = "0832024251fa28b8bb18d79f5a888139d1bc96b96d92c8f9eded1f27401ab704"
TARGET_SCHEMA = "42cdf18b1cb2730e170ec06127ba237cfb0666d5c07f30c97b3d1776fb4e60ee"
assert os.environ.get("GITHUB_ACTIONS") == "true", "Only run on isolated CI runner"

# The GitHub worktree on this branch does NOT yet contain the
# server's independently compiled DOB route implementation.
controller = ROOT / "api/src/residents/resident.controller.ts"
source = controller.read_text(encoding="utf-8")
has_route = bool(re.search(r"@Patch\s*\(\s*['\"]?:residentId/demographics",source))
has_import = "resident-demographic-amendment" in source
metadata = {
    "checkpoint": "V132.10.44",
    "source_route_in_github_branch": has_route,
    "server_source_provenance_imported": has_import,
    "target_rc_api_sha256": TARGET_RC_API,
    "target_schema_sha256": TARGET_SCHEMA,
    "rc_image_equivalence_proven": False,
    "isolated_rc_e2e_pass": False,
    "old_api_new_schema_pass": False,
    "production_test_deploy": False,
}
out = ROOT / "dob_rc_v1321044_gate.json"
out.write_text(json.dumps(metadata,indent=2),encoding="utf-8")
print("GITHUB_SOURCE_DOB_ROUTE=" + ("FOUND" if has_route else "MISSING"))
print("RC_SOURCE_EQUIVALENCE=HOLD")
print("RC_E2E=HOLD")
print("OLD_API_NEW_SCHEMA=HOLD")
print("RELEASE_READY=NO")
print("PRODUCTION_DEPLOY=NO")
# Imported route can be staged independently from the exact RC image.
# Do not promote source import to RC image equivalence.
if has_route or has_import:
    print("GITHUB_DOB_SOURCE_STAGED=YES")
else:
    print("GITHUB_DOB_SOURCE_STAGED=NO")
