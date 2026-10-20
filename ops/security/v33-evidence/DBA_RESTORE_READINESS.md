# Backup and restore readiness — V33

Read-only archive inspection, 2026-10-20 ICT. No restore was performed.

| Checkpoint | Archive SHA-256 | Contents/coverage | Result |
|---|---|---|---|
| Production Test hourly `/home/ag/tamancare-production-test-server/backups/automatic/15min/taman_care_20261020_140001.dump`, 07:00:01.975 UTC, 745,346 bytes | `5ebb3137eb3c124a9b94a450040c5a31e3cb469ecff94b65b545dc7101411b58` | Sidecar matches archive. PG16 `pg_restore --list`: 1,251 numeric records; 192 TABLE and 192 TABLE DATA, 3 SEQUENCE and 3 SEQUENCE SET, 1 FUNCTION, 1 EXTENSION, 0 BLOB. All 192 live table names matched. Header says 1,257 entries (six-record discrepancy noted). | Archive readable and schema-name coverage observed; restore unverified |
| Separate daily archive `/backups/tamancare-20261020T020000Z.dump`, 02:00:06 UTC, 464,721 bytes | `bce8c5f0c8cbffe2c0548ee9388f216f386be77e180fbb7f2203eaa85cd809af` | Sidecar file SHA `9756cef830f7e1dbc1ff9b98d0faabb5adbead0e3fa1ef20131b3d13e1c4cd5a`; `pg_restore --list`: 904 records, 139 tables, 139 table data, 2 sequence sets, 0 blobs; 53 current live tables absent. | Not a complete current schema checkpoint |

Both inspections used PostgreSQL 16 client in disposable network-isolated `--rm` container, read-only archive mount, and `pg_restore --list`; no database was restored. `RESTORE_READINESS=PARTIAL; FULL_RESTORE=UNVERIFIED; DBA_SIGNOFF=PENDING`.
