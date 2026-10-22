# Tâm An Care — Manual release, GitHub CI and FAST-RESUME policy
Effective proposal: 2026-10-14. Scope: all Tâm An Care modules and Production Test.

## Separation of duties
- GitHub is canonical for reviewed source, pull requests and isolated CI. No workflow, bot, coding agent or GitHub token may automatically deploy to Production Test merely because a push, PR, CI pass or merge occurred.
- MacBook/manual release is an **explicit, gated action**, not an exception to review, security or reconciliation. Deployment requires a named reviewed SHA, artifact digest, release decision and operator authorization. Maintain a separate manual process for server deployment.
- CI/coding agents may continue on isolated branches; they must not access Production Test credentials, database, live volumes or host. No self-hosted runner connected to production for untrusted changes. Use least privilege tokens and protected environments for any future manual release workflow.
- Audit all GitHub workflows, branch rules, Vercel/Netlify integrations, webhooks, server cron and SSH deployment paths before claiming that automatic production deployment is technically disabled. This document is a policy, not proof of disabled triggers.

## FAST-RESUME checkpoint rules
- Record checkpoint ID, module/scope, Git SHA, artifact digest, schema/migration fingerprint, environment and dependency versions, test command, test dataset class, date, PASS evidence link and approver.
- Reuse PASS only if source/dependencies/schema/config/environment and relevant security boundaries remain equivalent. If any are changed or unknown, rerun impacted tests; always run smoke, live RBAC/negative checks, contract/Finance reconciliation and post-deploy acceptance as relevant. Historical PASS is evidence, not blanket release authorization.
- Never mark missing/unknown as PASS, never assume a server-side PASS proves GitHub CI. Preserve failed and skipped checkpoint status and explain why.
- Track a small immutable manifest in GitHub with **no** resident names, real medical/financial rows, credentials, backups or sensitive logs.

## Production Test release gates
1. READ-ONLY runtime/source/database-schema parity inspection, branch diff and cross-module dependency review.
2. Build API/frontend from reviewed SHA and test in isolated environments; verify permissions/JWT/RBAC, integration and regression cases.
3. For Finance: separately reconcile active contracts, billing periods, receivables, payments, earned revenue, 7 ledger types and monthly profit. Do not equate active contracts with recognized revenue or collected cash; unknown readiness stays unknown/null.
4. Verify current backup and isolated restore ability; create pre-release safety backup and record rollback artifact.
5. Approve required migration separately; never reset DB, seed/demo, delete volumes, change DNS, restart PostgreSQL or migrate without explicit scoped approval.
6. Deploy only authorized artifacts manually. Capture deployment identity and SHA; run public/private health, JS MIME, data invariants, RBAC negative checks and live contract-finance acceptance. Roll back application if checks fail; do not blindly roll back schema.
7. Reconcile deployed SHA/digest with GitHub; port validated manual changes into a dedicated reviewed PR without uploading sensitive server material. Never auto-merge.

## Stop conditions
- Missing runtime parity, failed tests, unclear live-data semantics, unproven restore, unreviewed schema, access-control regression, or unexpected auto-deploy triggers => **NO_GO**.
- Do not bypass NO_GO because the operator requested speed. Record a precise blocker and resume from unaffected PASS checkpoints.

## First adoption checklist (not yet verified)
- Inventory all auto-deploy paths and disable/unlink them with separate operator authorization.
- Establish scoped checkpoint manifest and validated release tags for each module.
- Resolve Finance PR #5 source parity and accounting gates; deploy only after its own release readiness is verified.
