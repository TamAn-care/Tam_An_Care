# Application SQL call-path and permission mapping — V32

Static source review timestamp: 2026-10-20 ICT. Reviewed candidate: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; current Security evidence revision at preparation: `9933cd076638b19053e02e10e68e3694b7e48d6f`. Status: **PARTIAL STATIC MAP / OWNER VALIDATION PENDING**.

This mapping is a source-level starting point, not a query parser proof or exhaustive grant matrix. The API has 277 source files and more than a thousand query-like call lines. SQL can be composed dynamically; scripts, migrations and external consumers may add access not represented here. No test database object was provisioned in this pass.

| API/domain / call path | Representative candidate files | SQL object/operation evidence | Minimum permission to validate |
|---|---|---|---|
| Authentication: staff/guardian login, session/logout | `api/src/auth/auth.controller.ts`, `api/src/auth/auth.service.ts`, `api/src/security/production-auth.middleware.ts` | Auth service queries staff and guardian credentials/session state and writes login/session/logout state; JWT signing uses process `JWT_SECRET` | Named table SELECT plus narrowly required session/login DML; sequence permissions only if used; no DDL |
| Resident administration / scope | `api/src/residents/resident.controller.ts`, `api/src/residents/resident.service.ts`, `api/src/resident-access-scope/` | Resident lookup/list/update and scope checks; cross-resident protection is app-level, as live catalog reported no RLS | Exact resident and scope table verbs after SQL inventory; no ownership |
| Staff actor / workforce | `api/src/staff-actors/`, `api/src/workforce/` | Actor lookup and workforce operations; V30 moved runtime DDL into migration | Exact source query object/verbs; DDL migration-only |
| Medical / observations | `api/src/clinical-observations/`, `api/src/medication/`, `api/src/medication-safety/`, `api/src/health-reports/` | Clinical operation paths; precise table set requires extraction and owner review | Per-object SELECT/INSERT/UPDATE as observed; no blanket grants |
| Care / care planning | `api/src/care-actions/`, `api/src/care-plans/`, `api/src/care-tasks/`, `api/src/operational-work/` | Care tasks, actions, plans, operational events; V30 removed request/startup DDL and isolated required DDL in migrations | Per-object DML; migration role only for DDL |
| Nutrition | `api/src/nutrition-hydration/`, `api/src/kitchen-operations/` | Meal/hydration reads and writes; domain services issue parameterized queries | Per-object DML and exact sequence use |
| Contracts / admissions | `api/src/admissions/`, `api/src/resident-lifecycle/`, `api/src/resident-cost/` | Admission/lifecycle/cost operations; contract-specific endpoint/object mapping incomplete | Per-object DML after owner SQL review |
| Finance | `api/src/finance-billing/` | Finance service/API path; HTTP/JWT finance acceptance exists in exact-SHA CI | Exact object/verb matrix pending; finance authorization remains application-enforced |
| Accommodation / audit | `api/src/accommodation/accommodation.controller.ts`, `api/src/accommodation/accommodation.service.ts` | Example verified source query: `staff_actors` SELECT; `bed_assignments`, `accommodation_beds`, `residents`, `accommodation_audit_events` DML (see `accommodation.service.ts:12-14`) | SELECT and DML only for mapped objects; no schema CREATE |
| Notifications | `api/src/notifications/notifications.service.ts`, `api/src/notifications/notifications.module.ts`, relevant migration | Runtime DDL moved to migration by V30; service CRUD/query path remains | Required object DML only; migration owns DDL |

## Validation gates

- Cross-check every query against PostgreSQL catalog object names, function calls, sequences, views and triggers using a read-only catalog export.
- Resolve dynamic SQL and SQL in scripts/background jobs, then freeze one row per object+verb+consumer in `DB_GRANTS_ALLOWLIST.md`.
- Run domain-specific API tests with `taman_app_runtime`; verify role is not owner and has no membership escalation.
- Confirm app Admin/Superior permissions independently from database role flags.

`APPLICATION_SQL_CALL_PATH=PARTIAL`; exact static per-object mapping and live catalog reconciliation remain pending. Application Owner signoff: PENDING.
