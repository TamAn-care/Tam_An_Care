# TamAnCare — GitHub READ-ONLY runner installation: operator checklist

**State:** Probe source is ready. Runner registration and live Production Test connectivity are not evidenced. **No Production Test changes have been performed.**

## Separation of duties and infrastructure prerequisites
- Use an approved, dedicated Linux VM or locked-down management host, NOT the PostgreSQL container host or a runner with Docker socket, `docker` group, passwordless `sudo`, host mounts or deployment credentials.
- Restrict outbound network to GitHub Actions over HTTPS and database endpoint through vetted private connectivity. No inbound Internet exposure of PostgreSQL/SSH. Install runner service as a dedicated non-root OS user.
- An administrator must register it under GitHub repository **Settings → Actions → Runners → New self-hosted runner** with temporary one-use registration token shown only in GitHub. Never copy token to chat, source, workflow, or logs.
- Set dedicated runner label `tamancare-contract-audit`. Apply environment `contract-runtime-readonly` with required human reviewers and branch restrictions. Use trusted branch only, prevent untrusted PR code executing on runner.
- On the environment configure **secret** `CONTRACT_AUDIT_DATABASE_URL` containing TLS `sslmode=verify-full` and validated CA; configure **variable** `CONTRACT_AUDIT_APPROVED=READ_ONLY` only after restricted database role review.
- DB role must be non-superuser, cannot CREATE database/schema, has no INSERT/UPDATE/DELETE/TRUNCATE on **any** public table. Grant only the minimum catalog visibility required. Set server-side `default_transaction_read_only=on` for the role as defense in depth. Never use the application DB owner's credentials.
- `ops/ci/contract-least-privilege-probe.sh` uses only SQL metadata and reports small aggregate counts, not patient or contract record rows, document bytes, filenames or private business identifiers.

## Registration and connection acceptance
1. Administrator approves host OS, patch level, physical placement, network route, branch protection, workflow review rules and restricted PG role.
2. Administrator registers a dedicated self-hosted runner using GitHub's current interactive instructions, with required label. This step cannot be accomplished by a GitHub source commit.
3. Verify runner appears **Online/Idle** in repository runner settings. Confirm no docker/sudo or write privileges.
4. Environment reviewer permits a manually dispatched `contract-runtime-readonly-self-hosted.yml`. Successful execution proves only SQL metadata connectivity and restricted role; it **does not** prove backups, actual signed documents, staff permissions, or full contract workflow.
5. Preserve evidence locally under approved access controls. If any privilege/read-only/TLS gate fails: stop, do not weaken audit or change Production Test business data.
6. Retain release workflow separate and default-denied. No deployment, migrations, service restart, cleanup, or seed under this authorization.

## Release decision
Even if the query probe passes, `PRODUCTION_DEPLOY=NO_GO` until contracts archive evidence, immutable signed files, backup/restore rehearsal, actual JWT/RBAC and Finance reconciliation are separately confirmed and approved.
