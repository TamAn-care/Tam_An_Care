# Proposed PostgreSQL runtime grants allowlist — V32

Source code checkpoint reviewed: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`. Evidence branch SHA at preparation: `9933cd076638b19053e02e10e68e3694b7e48d6f`. Status: **DRAFT / PENDING DBA + APPLICATION OWNER**. Nothing here was granted on Production Test.

## Least-privilege target

| Role | Allowed purpose | Allowlist boundary | Explicit deny |
|---|---|---|---|
| `taman_app_runtime` | API only | `CONNECT`; `USAGE` on required schema; only per-object `SELECT/INSERT/UPDATE/DELETE` and sequence `USAGE/SELECT/UPDATE` proved by the SQL matrix; `EXECUTE` only on named required routines | SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, ownership, schema CREATE, DDL, server-file, extension administration, TRUNCATE/REFERENCES/TRIGGER unless separately proven; no owner-role membership or `SET ROLE` |
| `taman_migration` | controlled migration process | Only approved migration DDL; ownership assumed through a separately approved non-login `taman_owner` design | API login, broad inherited runtime use, superuser, replication/server-file |
| `taman_backup` | logical backup | Read access required by selected dump scope, sequence state and catalog; use pg_dump only | DML writes, DDL, owner privileges, role/database creation, superuser, replication, server-file |
| `taman_owner` | object owner | Own application schema objects; NOLOGIN | Runtime membership, API login, superuser |

## Object-level disposition

| Object class | Proposed grant | Current evidence | Decision |
|---|---|---|---|
| Database `taman_care` | CONNECT for named API/migration/backup consumers separately | Runtime API observed; backup/migration identities incomplete | PENDING |
| Schema `public` | USAGE only for runtime; CREATE only for controlled migration/owner | 192 tables and 3 sequences observed; exact schema ACL not retained in protected form | PENDING |
| Tables | Per-table verbs derived from SQL call paths, not blanket `ALL` | Static call-path review started; dynamic SQL and all job consumers not proven | PENDING object/verb rows |
| Sequences | Only exact sequence operations used by API | 3 present; source-to-sequence mapping incomplete | PENDING |
| Functions | EXECUTE only on named functions; review/remove unnecessary PUBLIC grants by DBA decision | 37 functions reported PUBLIC EXECUTE; source dependency not enumerated completely | PENDING |
| RLS | Runtime must not BYPASSRLS; application must enforce resident scope; DB currently reports no policies | 0 policy rows reported | PENDING application acceptance; database RLS absent |
| Extensions, large objects, SECURITY DEFINER | No runtime administration; no objects/routines reported except listed extensions | `pgcrypto`, `plpgsql`; 0 large objects; 0 SECURITY DEFINER | Proposed deny; DBA recheck pending |

An exact `GRANT` statement set is intentionally not fabricated: candidate SQL access plus complete consumer map and catalog ACLs must be reconciled before object grants can be frozen. Rehearsal must use this frozen matrix and prove both positive and negative cases.

**ALLOWLIST_TESTED=NO** for full application object allowlist. A previous isolated role model is supplemental and does not establish complete application acceptance.

DBA approval: PENDING __________  Application Owner approval: PENDING __________
