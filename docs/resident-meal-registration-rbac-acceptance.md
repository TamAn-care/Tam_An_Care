# Resident meal registration — implementation and acceptance contract

Status: IN PROGRESS; NOT DEPLOYABLE. This document is not evidence of tests passing.

## Scope

Registration of meals for residents only; excludes employee meals, guest meals, food receiving, meal-menu approvals, clinical diet-order authoring and intake reporting.

## Roles (deny by default)

| Role | List/view | Register/update/cancel |
|---|---|---|
| CAREGIVER | Only active residents assigned with DIRECT_CARE | Only those assigned residents |
| CARE_MANAGER | All active residents | All active residents |
| NUTRITIONIST | All active resident registrations and totals | Deny |
| SUPERVISOR | All active resident registrations and totals | Deny |
| All other roles (including ADMIN unless explicitly approved) | Deny | Deny |

Authentication must use the validated server session and active staff account, **never request body or forged X-Actor headers**. Request-scoped resident assignment must be checked server-side on every request, including on update/cancel against the persisted residentId. Query results for caregivers must be filtered server-side. An empty or revoked assignment must deny.

## Existing production domain

- `meal_schedules` contains clinical schedules and requires an approved nutrition plan + diet order. It must NOT be repurposed blindly as meal registration.
- There is currently no verified persistent registration endpoint. Inspect actual running DB schema and client behavior read-only before defining migration.
- Do not change `nutrition-hydration` clinical command permissions as a shortcut.
- Distinguish registration state from cooking readiness, intake recording and menu approval.

## Required follow-up work (not completed in this commit)

1. Reconcile server working-tree changes in `NutritionBoard.tsx`, `role-policy.ts`, `KitchenOperationsPage.tsx`, `kitchen-operations.ts` without overwriting any uncommitted work.
2. Trace read/write functions and persistent source of truth for resident meal registration, including localStorage and demo fixtures. No auto-seed, demo or synthetic data.
3. Add server-side durable registration CRUD, unique resident/date/meal slot, revision/audit trail, idempotent updates, atomic cancellation, concurrency validation, active-resident checks and approved diet restrictions; migration only after disposable restore and approved rollout.
4. Enforce session-based role and resident-scope authorization in every route. Avoid widening the existing production authentication middleware; investigate NUTRITIONIST login route before integration.
5. Create frontend screens wired only to canonical APIs with correct status/error/empty states; remove mock display paths without deleting any real browser/DB data automatically.
6. Verify kitchen totals use only live registrations; no double count after repeat updates/cancel.
7. Validate against actual runtime source hash, CI, negative authorization tests, backup/restore and rollback.

## Minimum negative/positive tests

- CAREGIVER assigned A can register/update/cancel A; cannot view or mutate B, including guessed IDs or crafted bodies.
- CAREGIVER assignment revoked => immediate denial; stale UI cannot bypass backend.
- CARE_MANAGER can register/update/cancel A and B.
- NUTRITIONIST and SUPERVISOR can view/report but must receive 403 on every mutation method.
- ADMIN, NURSE, anonymous user, revoked session, spoofed actor headers, mismatched resident ID => denied unless governed by a separately approved rule.
- Duplicate POSTs, concurrent updates, canceled records, invalid quantity/date, past lock window, conflicting diet instruction => handled deterministically without partial writes.
- The existing diet plan, diet order, meal schedule and unrelated employee/family meal flows remain unchanged.
- No demo data, seed, reset, volume changes or PostgreSQL restarts.

## Release gates

Merge/deploy forbidden until branch tests and isolated schema migration/restore pass, active API/UI/runtime source equivalence confirmed, rollback prepared and reviewed. Never auto-merge or deploy from this draft PR.
