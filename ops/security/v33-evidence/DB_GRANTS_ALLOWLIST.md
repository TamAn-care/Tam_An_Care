# Database grants allowlist — V33 draft

Source: read-only PostgreSQL 16.15 catalog capture above and application source at code candidate `9933cd076638b19053e02e10e68e3694b7e48d6f` (unchanged in evidence-only branch updates). Prepared 2026-10-20 ICT. This is a proposed boundary, not DBA-approved or validated against every SQL call.

| Role | Intended scope | Allowlist status |
|---|---|---|
| `taman_app_runtime` | Connect to `taman_care`; schema USAGE; only required SELECT/INSERT/UPDATE/DELETE on mapped application tables; sequence USAGE/SELECT where insert paths need generated IDs; EXECUTE only on explicitly required routines | UNVERIFIED exact object list; no live role exists |
| `taman_migration` | DDL and migration execution only in controlled migration job; not distributed to API | UNVERIFIED |
| `taman_backup` | Read-only dump access to required schemas and sequence state; no writes/DDL | UNVERIFIED |
| `taman_owner` | Non-login ownership boundary for objects; no application login | UNVERIFIED |

Explicitly deny runtime SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, membership/SET paths, ownership, schema CREATE, unreviewed function EXECUTE, server-file/program privileges, extension management and DDL. Remove PUBLIC function EXECUTE only after function-by-function impact review. Current database has no RLS policy, so resident isolation is enforced in application/session code; database-level resident scope is not established.

An exact grant script is intentionally not labeled tested: no candidate runtime role rehearsal covering the full API operation matrix was completed in this V33 run. Do not apply this draft to Production Test.
