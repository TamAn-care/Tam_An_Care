# Tâm An Care — Contract Grand FAST-RESUME, 5-stage execution checkpoint
Date: 2026-10-09. GitHub CI only. **Production deployment prohibited until independent real runtime evidence and explicit sign-off.**

| Stage | GitHub-side implementation / evidence | Remaining external acceptance |
|---|---|---|
| 1. Archive | `contract-archive-verifier.ts`: server PDF bytes, SHA256, traversal/symlink containment, invalid/mutated PDF rejection. | Confirm real archive mount, retention, permissions, backup and authorized file access on Production Test. No signed personal PDFs sent to GitHub. |
| 2. End-to-end JWT | Signoff controller requires verified session, active staff, independent verifier/approver, closed release flag. CI unit/PG and existing Finance JWT smoke. | Contract-specific **real HTTP/JWT** via equivalent runtime and authentic assigned roles; do not assert verified based on controller tests alone. |
| 3. Legacy/migration/backup | Pure legacy browser triage rejects mock, quarantines unverifiable contracts, never imports. Forward-only v30 migration SQL tested on ephemeral PG16. | Human verification of actual signed contracts; Production Test schema drift, capacity, restore rehearsal and migration approval. |
| 4. Finance | `contract-invoice-basis.ts` pure preflight rejects wrong identity/version/fee/dates and issued invoice changes. | Wire into actual invoice creation transactional path after safe review; verify historical billed version, canonical `finance_entries` ledger source/amount and single revenue recognition. No claim of end-to-end finance reconciliation. |
| 5. Release | `contract-release-qualification.yml` and `finance-grand-fast-resume.yml` report blocked GO/NO-GO and artifacts. | All real-environment conditions PASS, operator approval, pinned artifact and tested rollback. |

## Hard stops
- GitHub-hosted runners cannot directly establish reachability or authorization to the private 192.168.1.32 host unless an explicitly approved secured connectivity mechanism is provisioned. Never expose PostgreSQL, private patient data or SSH keys via CI logs.
- Do not infer CI source manifest = production state.
- No automatic seed, demo, localStorage import, direct contract deletion, finance posting or production migration.
- `TAMANCARE_CONTRACT_DRAFT_WRITE_ENABLED`, `TAMANCARE_CONTRACT_SIGNOFF_ENABLED`, `TAMANCARE_FINANCE_WRITE_ENABLED` remain disabled by default.
- This source branch remains non-deployable until the required external operational evidence is obtained. 

Result: **CONTRACT_GRAND_5_STAGES_GITHUB_PROGRESS; PRODUCTION_GO=NO.**
