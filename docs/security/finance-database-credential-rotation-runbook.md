# Production Test database credential rotation runbook

This procedure is a future controlled change. The source fix does not change the running Production Test services or rotate a credential. Do not run this procedure without the separately approved maintenance window and database owner authorization.

## Preconditions

1. Confirm the Production Test host and PostgreSQL owner through the approved operations channel. Verify the operator account has only the access needed to stage secret files and manage the affected services.
2. Confirm the latest completed database backup, its checksum, retention, and restore procedure. Confirm attachment and restore-critical configuration coverage separately; a database backup alone is not a complete recovery point.
3. Record current API and PostgreSQL image IDs, Compose project identity, service health, and the last known-good API image. Do not copy credentials or resident data into the change record.
4. Confirm the API can read a Compose file secret at `/run/secrets/database_url`, and PostgreSQL supports `POSTGRES_PASSWORD_FILE`. Validate the exact Compose version and secret-file permissions on a disposable host first.
5. Generate a new high-entropy password with the approved secret manager. Create a protected PostgreSQL password file and a matching database URL file. Keep both outside the repository with owner-only read access; do not paste either value into a terminal command, ticket, workflow, or log.

## Controlled rotation

1. Create a replacement least-privilege PostgreSQL login with the same required schema access as the API account. Do not grant superuser or database-owner rights to the application login. Verify grants using metadata queries only.
2. Put the replacement password into the protected password file and construct the matching URL file using the secret manager. Validate file ownership and permissions without displaying contents.
3. Stage the new URL secret for the API and, where the PostgreSQL initialization/administration workflow requires it, the corresponding password secret. Changing `POSTGRES_PASSWORD_FILE` does not rotate the password of an already initialized database; use an explicit database-side password change with the owner-approved procedure.
4. Apply the credential change to PostgreSQL using the approved administrative channel. Keep the old login available during the health-check window if policy permits.
5. Recreate only the API service with the staged URL secret, following the approved rollout plan. Do not restart PostgreSQL or alter its data volume as part of an API-only secret delivery change.
6. Check API health, database connectivity, authenticated health endpoints, and representative non-mutating Finance/RBAC reads. Check logs for connection errors without printing environment values or secret contents.
7. Confirm all dependent services and scheduled jobs that use the old login have moved to the new credential. Inventory dependencies before revoking the old login.
8. Once owner sign-off and health checks pass, revoke the old login or rotate its password. Remove superseded secret files according to the secret manager retention policy; never delete backups as part of credential rotation.

## Rollback

If the API cannot connect, do not restore or reactivate the credential identified in public history. Return to the last-good API image/configuration only with a newly provisioned alternate credential whose owner and validity are verified through the approved control plane. If the database-side password has changed, the database owner must provision or repair that alternate credential before API recovery. Do not restart PostgreSQL, edit Compose with inline credentials, or use the exposed credential as rollback. If no safe alternate is available, stop and escalate rather than re-enabling it.

## Git history

The current source has removed the known inline Production Test credential. Public Git history still contains the earlier credential-shaped value at commit `63f9248b2377784eb5865542af946c9367b6e0e1`, path `docker-compose.production-test.yml`; classify it as `SUSPECTED_REAL_SECRET` and rotate through the controlled process. Do not reproduce the value or test whether it still authenticates.

Historical credential-shaped examples also appeared in commit `0246064857fb733542ff804ed49f59ca0dc6d15e`, paths `ops/x3-production/backup/REMOTE-INSTANCE-GUIDE.md` and `ops/x3-production/dr/RESTORE-RUNBOOK.md`. They have been removed from current source. Their active status is unverified; do not attempt login. Have the database owner classify/revoke them as part of the rotation inventory.

Do not rewrite public history or force-push as part of this fix. Coordinate history cleanup separately because rewriting shared history does not replace credential rotation. Current runtime credential state remains `UNVERIFIED` until the owner performs an authorized, non-secret metadata verification.
