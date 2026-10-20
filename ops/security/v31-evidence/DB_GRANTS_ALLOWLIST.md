# Runtime PostgreSQL grants allowlist — V31

Evidence capture: 2026-10-20 ICT. SHA256 of this sanitized document is listed in sibling SHA256SUMS.

Status: **DRAFT / UNVERIFIED**. No grant change was applied to Production Test. The exact per-object list cannot be approved until SQL call paths and all consumer identities are reconciled by the DBA and Application Owner.

## Evidence and test results

- Candidate baseline: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`.
- Runtime-DDL correction: `3c1586049854c0473231ee725605822edfa1591a`; V30 evidence tip: `047e4e612de44d6b24a5a0da76b5612fa83ae0a9`.
- Production Test catalogs: PostgreSQL 16.15, read-only transaction on 2026-10-20 ICT; see `DB_ROLE_AND_CONSUMER_MANIFEST.md`.
- PostgreSQL 16 synthetic role-model rehearsal: runtime `CREATE TABLE`, `DROP`, `CREATE ROLE`, `CREATEDB`, `pg_read_file` and owner-role `SET ROLE` denied; allowed modeled read/write and backup `pg_dump`/synthetic restore succeeded. Supplemental model only; not validated against a complete live object manifest.
- Backup archive checkpoint checksum and TOC passed; restore of real-data archive remains unverified.

## Proposed role boundary

| Role | Intended purpose | Allowed rights | Denied rights | Status |
|---|---|---|---|---|
| `taman_app_runtime` | API runtime | `CONNECT`; `USAGE` on required schema; object-level DML exactly mapped below; `EXECUTE` only named required functions; sequence `USAGE`/`SELECT`/`UPDATE` only where SQL needs it | `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, ownership, schema `CREATE`, DDL, server-file, extension install, owner-role `SET ROLE`, unneeded `TRUNCATE/REFERENCES/TRIGGER` | Proposed only |
| `taman_migration` | Approved migrations | DDL only when executing approved migration; explicit ability to `SET ROLE taman_owner` if DBA approves; no superuser | Login use by API; replication/server-file; inherited runtime-wide rights | Proposed only |
| `taman_backup` | `pg_dump` and restore procedure | Read-only catalog/table access needed for selected dump scope, sequence state and large objects only if inventory requires; connect | Business writes, DDL, role/database creation, superuser, replication, server-file | Proposed only |
| `taman_owner` | Non-login ownership boundary | Own approved application schema objects | LOGIN; runtime membership; superuser | Proposed only |

## Per-object allowlist matrix

| Database/schema/object | Operation | Consumer + SQL call path | Required by evidence | Decision / signature |
|---|---|---|---|---|
| `taman_care` database | `CONNECT` | API / migrations / backup individually | Database connections observed; full consumer map incomplete | UNVERIFIED |
| `public` schema | `USAGE`; no runtime `CREATE` | API | Public objects observed; schema ownership/ACL summary requires protected DBA export | UNVERIFIED |
| Tables (all) | Per-table `SELECT`, `INSERT`, `UPDATE`, `DELETE` as proven by SQL path | API domains and jobs | `taman` currently owns 192 tables; role-superuser makes ACL-only rights inadequate evidence | UNVERIFIED — exact table names/verbs must be signed |
| Tables (resident/sensitive) | Minimum DML only; row-scope enforced at app | Staff/Guardian/Finance call paths | No RLS policies enabled/forced in current database | UNVERIFIED — app negative tests and owner acceptance required |
| Sequences (all) | `USAGE`/`SELECT`/`UPDATE` only per generated-key SQL | API/jobs | 3 sequences currently owned by `taman` | UNVERIFIED — exact sequence mapping required |
| Functions | `EXECUTE` only exact functions used | API/jobs | 37 public functions have PUBLIC EXECUTE and direct `taman` EXECUTE | UNVERIFIED — inventory each function and review PUBLIC ACL |
| Extensions | No runtime install/update | migration role only if approved | `pgcrypto 1.3`, `plpgsql 1.0` present | Runtime DENY proposed; DBA confirmation required |
| Default ACLs | No runtime defaults/DDL | migration owner | 0 rows observed | VERIFIED observed state; target policy approval pending |
| RLS | Runtime must not have `BYPASSRLS`; policies absent now | API resident-scope authorization | 0 enabled/forced policies | No database RLS protection exists; cross-resident HTTP tests required |
| Large objects | None observed | — | 0 large objects | VERIFIED observed count; recheck before approval |
| `SECURITY DEFINER` routines | None observed | — | Count 0 | VERIFIED observed count; recheck before approval |

## Acceptance tests before signing

- Positive database tests under `taman_app_runtime`: concrete Admin/Superior, Staff, Guardian and Finance API operations, assigned and unassigned resident access, notices, care, nutrition, contracts, Finance read and allowed writes as applicable.
- Negative SQL tests: `CREATE/DROP/ALTER`, `CREATE ROLE`, `CREATEDB`, `REPLICATION`, owner/`SET ROLE`, extension install, server-file functions, `BYPASSRLS`, unauthorized table/sequence/function access and cross-resident reads/writes must fail or return no data.
- Migration role executes only frozen migration set; runtime role cannot execute DDL. Backup role completes `pg_dump`, archive validation and synthetic restore without business writes.
- Record exact disposable PostgreSQL image digest, run ID, test commit SHA, test artifact SHA256, timestamp and cleanup verification.

DBA approval: ____________________ Date/time: __________
Application Owner approval: ____________________ Date/time: __________
