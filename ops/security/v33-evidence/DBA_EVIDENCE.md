# DBA evidence — V33

Capture: `2026-10-20T07:40:29.715101Z`; PostgreSQL 16.15; database `taman_care`; query role `taman`; `BEGIN TRANSACTION READ ONLY` and `ROLLBACK`, `transaction_read_only=on`. No `pg_authid`, credential values, connection strings or business rows were queried.

Protected full catalog export: `/private/tmp/v33-dba-protected/prodtest-catalog.json`, mode `0600`, directory mode `0700`; SHA-256 `df77951d946f70654e283448bb61be28c776e48a0d12b72acdb00a8c5db0394b`. It remains outside Git. This file is local protected evidence; access-control system/DBA object ID and owner attestation have not been supplied.

Observed: `taman` is LOGIN, INHERIT, SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, unlimited connections; no memberships. It owns the database and all 192 tables plus 3 sequences. The live catalog had 195 non-system relations, 37 functions, no SECURITY DEFINER functions, no enabled/forced RLS policies, no default ACL entries, no large objects; extensions `pgcrypto 1.3` and `plpgsql 1.0`. `public` grants USAGE to PUBLIC; observed function ACL behavior includes PUBLIC EXECUTE. Role/object facts establish the privilege blocker.

Activity snapshot saw only the capture `psql` session. It does not establish API consumers. A separate prior health/activity snapshot associated the API with `taman`; V33 read-only activity is not a complete consumer inventory. See `PLATFORM_CONSUMER_MAP.md`.

No live grants or role attributes were changed. Exact allowlist remains a draft pending full call-path review and least-privilege rehearsal under a dedicated role. `DBA_MANIFEST=OBSERVED_READ_ONLY; DBA_SIGNOFF=PENDING`.
