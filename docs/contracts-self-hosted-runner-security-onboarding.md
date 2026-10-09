# Tâm An Care — GitHub self-hosted runner onboarding (approval scope: READ-ONLY)
Status: **PREPARED, NOT INSTALLED, NOT CONNECTED, NOT EXECUTED**.

## Authorized now
- Design and commit audit workflow and separate future release-approval scaffold.
- Operators may manually authorize installing a dedicated self-hosted runner on a **separate, isolated Linux VM** or protected management host that has vetted connectivity to Production Test.
- The runner must not be mounted into Postgres data volumes or run with host Docker administrator privileges on the production server.
- Use outbound HTTPS to GitHub; do **not** open inbound SSH/Postgres to the public Internet.
- Allow only trusted admins to dispatch the workflow; configure repository actions policies and protected environment `contract-runtime-readonly` with required reviewers.
- Label `tamancare-contract-audit` dedicated only to approved audited jobs; do not run arbitrary pull request code or untrusted forks on this runner.
- Log only sanitized safety gates to GitHub. Keep detailed metadata report **local and access-restricted**, no user identities, contract bytes or secrets.

## Key blocker for actually running existing audit script
The initial `ops/ci/contract-runtime-metadata-readonly.sh` inspects Docker metadata using `docker exec` to read PostgreSQL catalog. On a production host this normally requires access to the Docker daemon, which confers effectively root-equivalent privileges. **Do not give the self-hosted GitHub runner unrestricted docker group or sudo access**. Before any live audit, replace the Docker method with an explicitly allowlisted, root-owned read-only probe exposed through narrowly scoped credentials/capability and verify its least-privilege properties in an isolated environment. Restrict output to sanitized metadata, never database business rows.

## Requires separate, explicit administrator operations
1. Register runner using a short-lived registration token through GitHub repository Settings > Actions > Runners; never commit or print the token.
2. Create protected environments `contract-runtime-readonly` and `contract-production-deploy-approval` with required reviewers; verify branch restrictions and GitHub Actions permissions.
3. Confirm the runner OS, network segmentation, egress, credentials, and non-root identity before assigning labels.
4. Approve a minimally privileged read-only probe to gather the live evidence. Verify no file modifications, no log disclosure, no data-row reads, no Docker restart, no database migration.
5. Conduct read-only test only after the above checks and record review/sign-off locally.
6. Deployment workflow, database migration/rollback and service restarts are **out of scope** for this approval. Release scaffold intentionally contains NO deployment commands.

## Fast resume state
- `GITHUB_PIPELINE_SOURCE_PREPARED` = source committed.
- `RUNNER_REGISTERED` = NOT VERIFIED.
- `LIVE_READONLY_AUDIT` = NOT PERFORMED.
- `BACKUP_RESTORE_EVIDENCE` = NOT VERIFIED.
- `CONTRACTS_PRODUCTION_GO` = NO.
