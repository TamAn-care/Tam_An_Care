# Production Test read-only evidence (sanitized)

Target: `ag@192.168.1.32`; all database queries used explicit `BEGIN TRANSACTION READ ONLY` and `ROLLBACK`. No business rows, `pg_authid`, password hashes, connection URLs, full environment, or secret values were queried or recorded.

## Runtime role and API

- PostgreSQL `16.15`; database `taman_care`.
- Filtered API configuration identifies database username `taman`, host `postgres`, port `5432`, database `taman_care`; no credential material recorded.
- API health returned HTTP 200, `ready`, database `ok` at `2026-10-20T03:56:42.109Z`.
- Timestamped `pg_stat_activity` corroborated one idle API session as role `taman` from the API container network. This is a point-in-time cross-check, not a complete consumer inventory.
- `taman`: LOGIN, SUPERUSER, INHERIT, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, unlimited connection limit. No role memberships were listed.
- Ownership summary: 192 tables, 3 sequences, 777 indexes including TOAST indexes. Public schema: 192 tables, 545 indexes, 3 sequences.
- Enabled/forced RLS policies: 0/0/0. Default ACLs: 0. Large objects: 0. SECURITY DEFINER routines: 0. Extensions: `pgcrypto 1.3`, `plpgsql 1.0`.
- Public has EXECUTE on 37 public functions; `taman` also has EXECUTE on those functions. Catalog ACL facts require DBA interpretation; superuser makes current effective access broader than ACL-only listings.
- No separate worker/migration container was present in the container inventory. A host user crontab includes an hourly backup script. The live backup database username was not established. Do not infer consumer completeness from these observations.

## Containers / image metadata

- API container image `taman-care-rbac-rc-api:20261017.2`, digest `sha256:4a6ae8f1547fab7be5a67e42d5839e45d37ccdb13da6dd0cd096660ea007dc93`.
- PostgreSQL image `postgres:16`, digest `sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94`.
- Frontend image `taman-care-rbac-rc-frontend:20261017`, digest `sha256:7aca22ab818713f9afe7c15f41e080d97d933ba77c7dc756c6d3eed370ed292e`.
- A separate backup container was observed under project `production`; its relation to this Production Test database is not established.

## Backup checkpoint

- Path: `/home/ag/tamancare-production-test-server/backups/automatic/15min/taman_care_20261020_100001.dump`.
- Timestamp: `2026-10-20 10:00:01 +07`; size: `745346` bytes.
- SHA256: `987b33b996052a10aa5be347d91d3e1a42b40144bc40487afd855b7dd07fa28f`; sidecar matched.
- Archive inspected read-only using a network-disabled, read-only mount with PostgreSQL 16 `pg_restore --list`; 1,251 TOC entries, including 192 table-data entries, 3 sequence sets, 0 large objects.
- No full restore of this real-data archive was attempted. Checkpoint/restore readiness remains `UNVERIFIED`.

## Integrity and limitations

This file is a sanitized session record, not a DBA-signed manifest. The protected source-side query output and access audit remain in operator-managed records. Exact SQL grants by object, complete consumer list, backup role identity, and application data recovery acceptance require DBA/Platform verification.
