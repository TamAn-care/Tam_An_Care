# Admission DOB correction — blocking audit and release criteria

## User-reported defect
A received/admitted elder's DOB edited through “Bổ sung phiếu” appears to save but admission list still shows the old DOB. The screenshot shows the entry for Hoàng Quốc Hùng; the user-supplied text and pictured full date do not unambiguously agree on birth year. **Do not write a value to the real DB before explicit confirmation.** Do not commit identifying resident details into a fixture.

## Root cause in GitHub main
- `frontend/src/features/admissions/AdmissionPage.tsx`: `handleEditDraft` blocks statuses ADMITTED and COMPLETED (lines ~860-865).
- `handleSave` (lines ~913-929) only POSTs an admission if none exists; existing cases do not send a DOB update to their canonical row.
- It POSTs a new assessment summary (lines ~983-1008) and closes modal regardless of whether canonical birth date changed.
- `api/src/admissions/admission.controller.ts` exposes no authenticated PATCH/PUT correction route.
- `frontend/src/api/admissions.ts` silently falls back to localStorage on API failures and contains demo records: never use it as confirmation of a successful server write.

## Safe implementation contract
1. Explicit DOB correction UI action separate from supplemental assessment, for both DRAFT and ADMITTED (authorized role); do not bypass original admission lifecycle.
2. Backend PATCH `/api/admissions/:admissionCaseId/demographics`, requiring active canonical staff role SUPERVISOR/CARE_MANAGER, strong ISO date validation including real calendar day and future-date rejection, expected recordVersion optimistic concurrency and a mandatory correction reason.
3. Transaction lock the admission row. If linked `resident_id` exists, determine canonical resident table and all dependent DOB projections, synchronize or fail closed rather than permit mismatched admission/resident DOB; update admission and resident in one transaction.
4. Persist old/new values, actor, timestamp, reason in append-only audit using existing verified audit schema; never place sensitive DOB in public CI logs.
5. Return authoritative updated values; re-fetch admission list/detail, no optimistic success or offline fake save.
6. Regression: success DRAFT, ADMITTED linked-resident, conflict 409, illegal dates, unauthorized role, partial-write rollback, source consistency, full compatibility with V14; isolated Postgres only, no seeded data on Production Test.
7. Source-to-runtime provenance and isolated-restore-verified safety backup before any real migration/deploy. Never deploy GitHub main directly over V14 source.

## Release gates
- GitHub main is divergent from actual Production Test V14 source. Confirm active schema and server code READ-ONLY before coding table writes.
- `PRODUCTION_TEST_DEPLOY=BLOCKED`
- `REAL_DOB_WRITE=NO`
- `MIGRATION=NO`
- `SEED=NO`
- `DB_RESET=NO`
