# Database credential rotation manifest (template)

Do not place passwords, connection URLs, tokens, or resident data in this document.

- Change/request ID:
- Approved owner:
- Database endpoint identity (non-secret):
- Application role identifier (name only):
- Current role status: `UNVERIFIED`
- New role approved and provisioned: `NO`
- Minimal grants reviewed by DBA: `NO`
- API consumers confirmed:
- Backup/restore/BI consumers confirmed:
- Protected secret-file destination and owner/group:
- Pre-change backup reference and checksum location:
- Last-good API/frontend image digests and provenance:
- Schema compatibility evidence:
- Health-check owner and criteria:
- Cutover window/change approval:
- Rollback credential strategy (must not re-enable an exposed credential):
- Old credential disabled and verified: `NO`
- Post-change connection verification:
- Incident/history remediation reference:

## Preconditions

1. Confirm the database owner and every consumer, including scheduled jobs and external reporting.
2. Confirm a protected current backup, attachment/config coverage, and a successful authorized isolated restore.
3. Approve a least-privilege application role that can coexist with the current role during cutover; keep migration and backup permissions separate where the deployed architecture supports it.
4. Provision the new secret file out of band with restrictive permissions. Never commit or print it.
5. Confirm last-good image provenance and a rollback path that does not depend on the previously exposed credential.
6. Schedule an operator-controlled change and define health checks before starting.

## Cutover outline — not executed

1. Install the new secret file and validate its ownership/mode without displaying its contents.
2. Switch the approved runtime configuration during the authorized window.
3. Verify API readiness, a synthetic/non-sensitive database connectivity check, scheduled backup readiness, and dependent services using approved operational telemetry.
4. Revoke the old role/credential only after all consumers use the new credential and the owner confirms recovery readiness.
5. Record non-secret evidence, disable the old credential, and confirm it cannot authenticate through the authorized control plane. Never test a suspected credential by attempting login.

## Rollback

If the new role fails, restore the last-good application configuration while retaining the new credential path and use an alternate newly provisioned credential or DBA recovery procedure. Do not re-enable a credential exposed in public history. If no safe alternate exists, stop the cutover and keep the service in its preapproved safe state; escalate to the database owner.
