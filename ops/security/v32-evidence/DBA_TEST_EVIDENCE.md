# DBA isolated role and backup evidence — V32

Prepared 2026-10-20 ICT. Source candidate: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; evidence branch at preparation: `9933cd076638b19053e02e10e68e3694b7e48d6f`. Results distinguish real Production Test evidence from isolated synthetic rehearsal.

## Production Test backup checkpoint

A prior read-only metadata capture recorded `/home/ag/tamancare-production-test-server/backups/automatic/15min/taman_care_20261020_100001.dump`, timestamp `2026-10-20 10:00:01 +07`, size 745346 bytes, SHA-256 `987b33b996052a10aa5be347d91d3e1a42b40144bc40487afd855b7dd07fa28f`. Sidecar matched. Read-only `pg_restore --list` returned 1,251 TOC entries: 192 table-data, 3 sequence-set, 0 large objects. This establishes checkpoint identity/integrity metadata and archive readability only.

**RESTORE_PASS=NO.** No restore of the real checkpoint was attempted. Synthetic restore is not proof of real restore readiness.

## V32 isolated PostgreSQL 16 role rehearsal

Run `V32-RBAC-20261020-1421` used image ID/digest `sha256:e17e86066e5ef83e0952a9347f5c792b7ece00972e2aa787a6986f471b3dd3d5`, `--network none`, tmpfs database storage and only synthetic identifiers. The full ownership/cleanup record is `SYNTHETIC_RUN_MANIFEST.md`.

| Test | Result |
|---|---|
| Runtime LOGIN with SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS all false | PASS |
| Runtime allowed SELECT and INSERT on explicitly granted synthetic objects | PASS |
| Runtime CREATE TABLE, SET ROLE owner, CREATE ROLE, CREATEDB and `pg_read_file` | DENIED as expected |
| Migration role with `NOINHERIT`, explicit non-admin membership and `SET ROLE taman_owner`; approved synthetic DDL | PASS |
| Backup SELECT, `pg_dump` custom archive and archive list | PASS after granting SELECT on a newly created synthetic migration object; first dump correctly failed until that object was included |
| Backup INSERT | DENIED as expected |
| Synthetic restore to separate `v32restore` database; one synthetic resident row read back | PASS — synthetic only; does not establish Production Test restore readiness |
| Cleanup | PASS; exact container and volume filters empty after removal |

This test validates the modeled grants only; it is not the frozen complete application object allowlist and does not establish complete application behavior. There were no RLS policies in the synthetic app schema. Resident isolation remains an application authorization responsibility and needs the exact HTTP regression under the target DB role.

| Acceptance | Result |
|---|---|
| Candidate runtime flags/membership verified in disposable PostgreSQL 16 | PASS for modeled roles; complete live manifest still pending |
| Runtime DDL/admin/server-file/owner escalation denied | PASS in V32 isolated run |
| Migration approved DDL succeeds; runtime DDL fails | PASS for modeled DDL; application migration set not frozen |
| Backup dump/archive list, synthetic restore and no writes | PASS in V32 isolated run |
| Real backup restore readiness | UNVERIFIED; no real-data restore |
| Full app queries under target runtime and frozen allowlist | NOT RUN / UNVERIFIED |
| Synthetic resource cleanup | PASS; see V32 run manifest and post-cleanup filters |

A fresh, attributable run must record run UUID, owner manifest, PostgreSQL 16 image digest, exact candidate SHA, allowed object matrix, positive/negative SQL and API cases, dump/archive/restore method, and post-cleanup verification. Do not write the real Production Test database or restore its business data under this task.

DBA acceptance: PENDING SIGNOFF. Synthetic evidence does not substitute for owner review.
