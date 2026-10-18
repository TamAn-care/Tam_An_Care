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

If the API cannot connect, restore the previous protected URL file and return the API to the recorded last-good image/configuration using the approved service procedure. If the database-side password has already changed, use the database owner's recovery procedure to restore the old credential or complete the new credential repair. Do not roll back by editing Compose with inline credentials. Keep the previous credential only for the owner-approved rollback window, then revoke it.

## Git history

The currently committed source is being changed to remove inline database credentials. Git history contains an earlier source revision with credential-shaped values, so treat the credential as exposed and rotate it through the controlled process. Do not rewrite public history or force-push as part of this fix; coordinate any history-cleanup decision separately because rewriting shared history does not replace credential rotation.
