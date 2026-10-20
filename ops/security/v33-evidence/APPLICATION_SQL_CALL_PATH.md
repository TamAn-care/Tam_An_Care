# Application SQL call-path matrix — V33

Static analysis source SHA `9933cd076638b19053e02e10e68e3694b7e48d6f`; reviewed 2026-10-20 ICT. Paths below identify source, not an exhaustive query inventory or grant test.

| Feature/API path | Service and SQL operations | Objects / required DB verbs (minimum inferred) | Evidence status |
|---|---|---|---|
| Staff/Guardian auth, sessions | `api/src/auth/auth.controller.ts`; `auth.service.ts` | staff actors, auth credentials, guardian identities, auth sessions, audit: SELECT/INSERT/UPDATE | Static path verified; target role untested |
| User and role management | `staff-actor.controller.ts`; `staff-actor.service.ts` | staff actors, auth credentials, audit, session revocation: SELECT/INSERT/UPDATE | Static path verified; app Admin E2E incomplete |
| Guardian finance scope | `finance-read.controller.ts`; `residentScope` | invoices, allocations, receipts: scoped SELECT | CI resident-scope scenarios pass; DB role untested |
| Medical/clinical | `clinical.controller.ts`; `clinical.repository.ts` | clinical observations, nursing notes, abnormal findings, escalations: SELECT/INSERT/UPDATE | Static path verified |
| Care plans | `care-plan.repository.ts` | care plans and audit: SELECT/INSERT/UPDATE | Static path verified |
| Psychology/social work | `behavioral-cognitive.controller.ts` and service | residents, psychological assessments, cognitive observations: SELECT/INSERT | Static path verified |
| Nutrition | `nutrition-hydration.controller.ts` and service | nutrition/hydration and linked billing objects: SELECT/INSERT/UPDATE | Partial source mapping; CI fail-closed integration checks pass |
| Contracts | `contract-signoff.controller.ts` and service | contract records/versions/signatures/approvals: SELECT/INSERT/UPDATE | Static path verified |
| Finance | `finance-read.controller.ts`, `finance-write.controller.ts`, billing service | invoices, allocations, ledger/payment records: SELECT/INSERT/UPDATE | Selected CI flows pass; complete Finance matrix not run |

No database object names are expanded into a signed allowlist until SQL call paths are exhaustively reconciled with catalog objects. App authorization, including Guardian resident scope and Admin/Superior privileges, remains application-level; PostgreSQL SUPERUSER is not required for Admin/Superior.
