# Application RBAC and auth regression — V32

Evidence checked: GitHub Actions exact-head SHA `9933cd076638b19053e02e10e68e3694b7e48d6f`, runs 39379888909 (Auth) and 39379888908 (PostgreSQL 16 HTTP/Chromium); completed 2026-10-20 UTC. Baseline checkpoint remains `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`. Status is limited to the CI acceptance scopes below.

| Case | Evidence/result | Limitation |
|---|---|---|
| API build | PASS in Auth run | Does not prove DB least-privilege runtime |
| 22-case Guardian policy evidence | PASS, exactly 22 cases, 0 skipped under truthful in-memory environment | In-memory policy suite; not PostgreSQL object-grant testing |
| Guardian JWT/resident scope | PASS in isolated PostgreSQL 16 actual HTTP + Chromium workflow | Synthetic CI identities/key; no Production Test secret/provider proof |
| Finance HTTP/JWT | PASS in PG16 HTTP workflow | Does not cover every finance function under proposed DB role |
| Negative authorization checks | PASS within named Guardian/HTTP acceptance suite | No full cross-module target-role negative SQL matrix |
| Admin/Superior | App semantics remain separate from PG SUPERUSER; complete V32 role-backed regression not evidenced | Application Owner confirmation/test evidence needed |
| Staff | Auth policy contract evidence exists; full role-backed module matrix absent | Partial |
| Medical, Care, Nutrition, Contracts | CI includes selected product checks but this dossier has no run-level per-module role-backed matrix | UNVERIFIED for target runtime role |
| Synthetic cleanup | CI cleanup step PASS in run 39379888908 | No live/test production mutation; cleanup evidence scope is CI resources only |

No test is declared passed because it was skipped. The full application regression under proposed `taman_app_runtime` and frozen object allowlist has not been demonstrated. Do not expand database grants just to make an application test green; diagnose exact failing query and review least privilege with owner.

`APPLICATION_RBAC_REGRESSION=PARTIAL`; Application Owner signoff remains PENDING.
