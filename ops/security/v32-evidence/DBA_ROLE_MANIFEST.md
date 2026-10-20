# PostgreSQL role and object manifest — V32

Evidence snapshot: 2026-10-20 ICT; reviewed against Production Test read-only catalog summary recorded in V31. Source checkpoint: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`. Security evidence branch revision at preparation: `9933cd076638b19053e02e10e68e3694b7e48d6f`. Result: **PARTIAL / DBA VERIFICATION PENDING**.

## Evidence source and limits

The sanitized prior capture states PostgreSQL 16.15, database `taman_care`, runtime login `taman`, API health ready and one `pg_stat_activity` row as `taman`. Capture time in record is 2026-10-20 ICT; exact catalog query timestamp, protected export ID/version, run ID and DBA signature were not retained. No password hashes, `pg_authid`, business rows, URLs, or full environment were collected into this dossier. This document is a secondary sanitized summary, not the protected DBA export.

## Observed manifest

| Object | Observed evidence | Status |
|---|---|---|
| `taman` | LOGIN; SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS; INHERIT; no listed role membership; owns 192 tables, 3 sequences and 777 indexes (545 public, 232 TOAST) | VERIFIED from V31 sanitized catalog summary; DBA re-attestation pending |
| `tamancare_catalog_auditor` | Role present; reported high-risk flags false; use/purpose not verified | PARTIAL |
| `public` schema | 192 tables, 3 sequences, 545 indexes; 37 public functions with PUBLIC EXECUTE and direct `taman` EXECUTE | PARTIAL |
| RLS | 0 enabled, 0 forced, 0 policies reported | VERIFIED observed summary; no DB resident-row isolation |
| Default ACL | 0 rows reported | VERIFIED observed summary |
| Large objects | 0 reported | VERIFIED observed summary |
| `SECURITY DEFINER` | 0 routines reported | VERIFIED observed summary |
| Extensions | `pgcrypto 1.3`, `plpgsql 1.0` | VERIFIED observed summary |
| Proposed roles | `taman_app_runtime`, `taman_migration`, `taman_backup`, `taman_owner` not created on live DB | Target design only |

No member role, ownership or grant change was applied. The current superuser role's ownership means a credential swap alone cannot least-privilege the existing objects.

## Consumer evidence

- API container observed as `taman-care-rbac-rc-api:20261017.2`, image digest `sha256:4a6ae8f1547fab7be5a67e42d5839e45d37ccdb13da6dd0cd096660ea007dc93`; filtered runtime configuration identified DB username `taman`.
- Frontend container observed; direct DB use not established.
- Host hourly backup script observed; effective `PG_USER`/secret-record version not established.
- No separate worker or migration container observed in the limited snapshot. This does not prove their absence.
- `pg_stat_activity` was a timestamped corroboration only, not a complete consumer inventory.

**CONSUMER_MAP=PARTIAL.** Platform owner must reconcile all API instances, workers, jobs, backup, migration, reporting, monitoring, scheduler and maintenance from deployment + secret audit sources.

## Approval-ready DBA confirmation

DBA must attach in the protected evidence system: run ID/time/cluster identity, PostgreSQL 16 read-only query transcript, protected object ID/version, SHA-256, access-control reference, role membership including ADMIN/INHERIT/SET, ownership, schema/table/sequence/function ACLs (including PUBLIC and inherited), default ACL, extensions, large objects, RLS, and effective privilege probes. Keep the full export in DBA-controlled encrypted storage; put only its metadata and redacted conclusions here.

**DBA_MANIFEST=PARTIAL; DBA_SIGNOFF=PENDING.**

DBA decision: PENDING — ____________________  Timestamp: __________  Evidence object/version: __________
