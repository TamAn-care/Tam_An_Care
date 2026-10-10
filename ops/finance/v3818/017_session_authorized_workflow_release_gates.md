# Finance V3.8.18.17 — session-verified atomic workflow

Status: **CI ISOLATION ONLY**. This release develops a transactional PostgreSQL workflow that resolves the responsible actor from a stored session and requires role segregation for manual payroll/expense documents. The testing schema `finance_manual_ci` and session table `session_authorizations_ci` belong to the disposable GitHub Actions database `finance_ci`. Rows in that laboratory are CI fixtures only, never Production Test/demo business rows.

Workflow tested: DRAFT → SUBMITTED → REVIEWED → APPROVED, with audit and optimistic revision guards inside a single SQL transaction. No user-supplied actor/role fields are accepted by the SQL transition function. Public EXECUTE access is revoked.

**NOT YET IMPLEMENTED:** real Nest HTTP endpoint; wiring against actual server auth_sessions; persisted real draft creation; attachment verification and access controls; production permission grants; payroll confidentiality integration; production schema or frontend save/approve actions. Live database remains completely untouched. There is no automatic posting to Finance Ledger.

**Mandatory release gates**: authenticated server session from existing verified-finance-identity path, per-resource visibility/role checks, isolated restore validation, source↔image reproducibility, production-compatible migrations authorized with rollback, anti-duplicate financial origin checks, verification of approved documents and signatures, and end-to-end user acceptance. These remain NO_GO.
