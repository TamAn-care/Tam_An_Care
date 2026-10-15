# Staff authentication and Guardian resident-scope regression specification

**Scope:** isolated test harness only; no live Production Test database, services or resident records.  
**Status:** specifications prepared; **no case has executed or passed**.  
**Origin:** locally prepared Gate 50.32 regression matrices, transcribed as actionable GitHub acceptance scenarios.

## Staff Auth — 10 cases

| ID | Scenario | Expected result |
|---|---|---|
| STAFF01 | Existing staff with valid token and sufficient privileges | ALLOW only for active, authorized identity |
| STAFF02 | Missing authentication token | DENY |
| STAFF03 | Malformed token | DENY |
| STAFF04 | Expired token | DENY |
| STAFF05 | Invalid token signature | DENY |
| STAFF06 | Disabled staff account | DENY |
| STAFF07 | Authenticated staff lacking required role | DENY |
| STAFF08 | Cross-role privilege escalation | DENY |
| STAFF09 | Guardian token submitted to staff-only route | DENY |
| STAFF10 | Guardian identity used to infer staff identity | DENY staff access |

## Guardian resident-scope — 12 cases

| ID | Scenario | Expected result |
|---|---|---|
| GUARD01 | Guardian actively linked to resident A reads permitted information on A | ALLOW only within assigned scope |
| GUARD02 | Guardian linked only to A requests resident B | DENY; no B data disclosed |
| GUARD03 | Guardian without resident link | DENY |
| GUARD04 | Guardian with revoked resident link | DENY |
| GUARD05 | Guardian with expired resident link | DENY |
| GUARD06 | Guardian identity deactivated | DENY |
| GUARD07 | Guardian identity used as staff identity | DENY |
| GUARD08 | Guardian attempts unauthorized update to resident | DENY; no mutation |
| GUARD09 | Guardian changes resident ID/path/body in request | DENY unauthorized resident; no mutation |
| GUARD10 | Guardian requests listing beyond assigned residents | DENY or server-side filter; no leakage |
| GUARD11 | Guardian requests access after link revocation | DENY (including previously valid sessions subject to specified revocation policy) |
| GUARD12 | Unauthenticated caller requests protected resident data | DENY |

## Requirements for executable tests

- Map each case to actual repository route/handler/service and enforce server-side authorization.
- Use isolated synthetic fixtures **only in a disposable test process/database**, never in Production Test. No production seed or demo fixtures.
- Assert HTTP outcomes **and** absence of unauthorized data disclosure/writes; HTTP status alone is insufficient.
- Preserve staff login behavior, distinguish staff and guardian principals and protect cross-resident boundaries.
- Record CI run SHA, case-level PASS/FAIL, test environment and artifact checksum.
- Negative tests must be in the required GitHub branch protection checks.
- Build success, matching identifier names and static text comparisons do **not** substitute for runtime regression tests.

## Release acceptance

All mapped cases implemented, run and PASS on the source revision proposed for release, with source/image provenance confirmed against controlled deployment artifact. Review and sign off separately on rollback and Production Test acceptance.

**Status: 22 specified / 22 executable cases implemented in api/test/guardian-22-case-evidence.test.cjs; production deployment requires separate human approval.**
