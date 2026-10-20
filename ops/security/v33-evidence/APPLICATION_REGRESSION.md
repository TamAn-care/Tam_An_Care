# Application regression — V33

Exact V33 evidence commit `3a79971298adc7a18d9e85a81b652fa0351ee99f`: Auth run `39389069937` SUCCESS; PG16 HTTP/Chromium run `39389069789` SUCCESS. Both have no skipped steps. Prior exact code candidate commit `a69ad0e564c3f59f634f77b1af81a03faaa5d6b8`; source/code candidate remains `9933cd076638b19053e02e10e68e3694b7e48d6f`. GitHub Actions exact `a69ad0e...` runs: Auth `39386735780` SUCCESS; PG16 HTTP/Chromium `39386735779` SUCCESS. Both completed with all jobs and steps successful; no skipped steps. Artifacts: Auth `12248020998` (`sha256:3934c92de6911a6019e14a33c6913f7f2462d178ea79a03b7edda4c48c52b659`); PG16 `12247413647` (`sha256:773a40dc5036cb6fbbe070e7f7cfc5465c9251e5f4339ac2df5852c082d36c54`).

| Scenario | Result | Limit |
|---|---|---|
| Build/Auth contract and Staff RBAC | PASS in exact-SHA Actions | Does not validate proposed DB role |
| Guardian login, resident scope and cross-resident denial | PASS in HTTP/Chromium scenarios | Not full owner acceptance |
| Finance read/auth separation | PASS for exercised CI scenarios | Complete workflows under new role not tested |
| Nutrition fail-closed integration check | PASS | Full nutrition CRUD not established |
| Admin/Superior user administration | NOT ESTABLISHED | No dedicated Admin/Superior E2E acceptance evidence |
| Medical, Care, Psychology/Social Work, Contracts | NOT RUN as full business regression | Static mapping only |
| Least-privilege runtime database role | NOT RUN | Role/allowlist not applied to disposable end-to-end API |
| Local build | NOT RUN | Dependencies/build output absent in local checkout; exact GitHub CI ran instead |

No reproducible source defect was observed requiring an auth contract fix, so no code change was made. Application Owner approval remains PENDING.
