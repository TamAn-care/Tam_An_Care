#!/usr/bin/env python3
"""Safely grant supervisor route visibility for existing psychosocial periodic report.
Run ONLY against an isolated copy of the accepted Production Test frontend.
No API/database changes; fail closed if route/menu not present.
"""
from pathlib import Path
import argparse
import re

p=argparse.ArgumentParser()
p.add_argument("--frontend",required=True,type=Path)
args=p.parse_args()
root=args.frontend.resolve()
if root.name!="frontend" or "supervisor-two-reports" not in str(root):
    raise SystemExit("SAFE_STOP: requires isolated supervisor-two-reports/frontend workspace")

src=root/"src"
nav=(src/"components/navigation/AppNavigation.tsx").read_text()
mobile=(src/"features/mobile-launcher/MobileLauncherPage.tsx").read_text()
router=(src/"app/router.tsx").read_text()
policy_path=src/"auth/role-policy.ts"
policy=policy_path.read_text()

required={
    "desktop psychology": ("key: 'psychosocial-reports'",nav),
    "desktop health": ("key: 'health-reports'",nav),
    "mobile psychology": ("id: 'psychosocial-reports'",mobile),
    "mobile health": ("id: 'health-reports'",mobile),
    "psychology route": ("path: '/psychosocial-reports'",router),
    "health route": ("path: '/health-reports'",router),
    "psychology role gate": ('route="psychosocial-reports"',router),
}
for name,(needle,text) in required.items():
    if needle not in text:
        raise SystemExit("SAFE_STOP_MISSING:"+name)

if policy.count("export type AppRouteKey")!=1 or policy.count("SUPERVISOR: {")!=1:
    raise SystemExit("SAFE_STOP_POLICY_STRUCTURE")

# Add the existing psychology route key to the frontend's route type, if absent.
start=policy.index("export type AppRouteKey")
end=policy.index(";",start)
union=policy[start:end]
if "'psychosocial-reports'" not in union:
    anchor="  | 'health-reports'"
    if union.count(anchor)!=1: raise SystemExit("SAFE_STOP_ROUTE_UNION")
    policy=policy[:start]+union.replace(anchor,"  | 'psychosocial-reports'\n"+anchor,1)+policy[end:]

# Only SUPERVISOR's allowedRoutes, not capabilities or roles for other staff.
start=policy.index("SUPERVISOR: {")
list_start=policy.index("allowedRoutes: [",start)
list_end=policy.index("]",list_start)
segment=policy[list_start:list_end]
if "'psychosocial-reports'" not in segment:
    if segment.count("'health-reports',")!=1:
        raise SystemExit("SAFE_STOP_SUPERVISOR_ROUTES")
    segment=segment.replace("'health-reports',","'psychosocial-reports',\n      'health-reports',",1)
    policy=policy[:list_start]+segment+policy[list_end:]

# Explicit post-conditions.
supervisor=policy[policy.index("SUPERVISOR: {"):policy.index("CARE_MANAGER: {")]
assert supervisor.count("'psychosocial-reports'")==1
assert supervisor.count("'health-reports'")==1
assert "canCreateHealthReport: false" in supervisor
assert "canPrescribeMedication: false" in supervisor
assert "canAdministerMedication: false" in supervisor

policy_path.write_text(policy)
print("RESULT=SUPERVISOR_PERIODIC_REPORT_ROUTE_FIX_PASS")
print("SUPERVISOR_PSYCHOLOGY_ROUTE=ALLOW")
print("SUPERVISOR_HEALTH_ROUTE=PRESERVED")
print("OTHER_ROLES_UNCHANGED=YES")
print("API_AND_DATABASE_UNCHANGED=YES")
