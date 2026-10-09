# Finance controlled release evidence (NO DEPLOY)

Canonical migrations are currently on the private server worktree, not the Finance GitHub branch. The CI PostgreSQL schema is only a reconstructed behavioral fixture.

## Verified original SQL hashes
- ops/finance/v22/001_finance_foundation.sql — 25c82188511752fea1d7659c4550d34e2ec30b593a4f36dfe74a561564955c61
- ops/finance/v28/002_finance_transaction_safety.sql — b848f9440cccf5001741ec6f53d0da2dcc852a21fe53f446b3356ce9e7f8d8cf
- ops/finance/v29/003_finance_allocation_invariants.sql — 80d1cea6b45e97446194e86f36bb69d8a4e0a0298c747dd17674dc7eb826e3b3
- ops/finance/v29/004_finance_integrity_hardening.sql — 2c878dd909da82da56d27d5b83477d193152aaabdbfcb31b1ff35929e0209584

## Release blockers
1. Original migrations must be verified and applied only in GitHub isolated PostgreSQL before Production Test approval.
2. Source of truth for service contracts must be reviewed, with no duplicate master contract records.
3. Ledger bridge must enforce one revenue accrual event and separate cash settlement; reconcile existing manual/system entries.
4. Finance write transactions need server-verified auth, RBAC, idempotency, concurrency, audit and rollback tests.
5. Real HTTP JWT positive/negative tests must pass in isolated environment.
6. Runtime schema, PostgreSQL version, backup and restore and rollback must be separately reviewed.
7. Explicit deployment and migration authorization remains mandatory; do not auto-migrate or auto-deploy.

## Source-only handoff
Only the four code-only SQL files may be submitted after reviewing them for secrets and real resident/financial data. Never upload .env, backups, dumps, logs or real records to the public repository. Abort on hash mismatch.

Readiness is NO_GO until evidence proves every gate. CI success alone is not production-ready.