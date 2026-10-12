# Care View specialist access: security audit and release gate

## Symptom
Professional roles (NURSE, PSYCHOLOGIST, SOCIAL_WORKER, etc.) see "Hồ sơ không khả dụng", not an actual diagnosis of absent data. A 404 may be intentional non-disclosure for denied access. Do not change 404 into 200 without a verified resident scope.

## Source inspection
- CareViewPage calls GET /api/operations/residents/:residentId/care-view and shows generic 404 unavailable / no access.
- OperationalCareViewService.authorize() permits NURSE but not PSYCHOLOGIST/SOCIAL_WORKER. It maps some other roles into scopes using unsafe role casting.
- ResidentAccessScopeService.canAccessResident() permits supervisory role or an ACTIVE `resident_access_assignments` row with role-specific scope; presently only NURSE=>CLINICAL_CARE, CAREGIVER=>DIRECT_CARE. Roles without an explicit scope are denied.
- A separate critical security defect `result.rowCount === 1 || true` permitted supervisors to bypass resident existence checks; this branch corrects it to `result.rowCount === 1`. Must validate on actual runtime before rollout.

## Required before an authorized fix
1. READ-ONLY inspect deployed API source/image, deployed DB schema: `resident_access_assignments` role and scope constraints; staff actor canonical role; assigned medical/psychology case relationships; actual open-page browser request method and response status; and any Care Manager assignment UI. Redact any real patient data before uploading logs to GitHub.
2. Establish explicit policy: NURSE may access assigned patients' care view, PSYCHOLOGIST and SOCIAL_WORKER may read assigned patients' relevant sections only, no implicit write permission and no full-centre broadening. Do not infer access merely from staff title or list visibility.
3. Implement assigned-resident lookup backed by canonical server-side state for psychology/social work rather than client `localStorage`; introduce needed scope labels only if verified DB constraints support them.
4. Test positive assigned and negative unassigned/cross-resident, disabled actor, role spoofing, guardian identity, missing resident, data non-disclosure, concurrency and audit. Ensure no DB changes on denied reads.
5. Reconcile Github main against the accepted V14 Production Test runtime; do not deploy whole main branch. Backup/isolated restore, staged API/frontend, rollback preserving DB and all frontend V11-V14 patches.

## Release state
`PRODUCTION_TEST_DEPLOY=BLOCKED`
`NO_MIGRATION=YES`
`NO_SEED=YES`
`NO_DB_RESET=YES`
`SECURITY_FIX_COMMITTED=YES`
`SPECIALIST_ACCESS_READY=NO`
