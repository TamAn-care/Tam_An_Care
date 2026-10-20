# PostgreSQL role and consumer manifest — V31

Evidence capture: 2026-10-20 ICT. SHA256 of this sanitized document is listed in sibling SHA256SUMS.

Status date: 2026-10-20 (Asia/Ho_Chi_Minh). Evidence is sanitized. This is not a DBA-signed manifest.

## Evidence provenance

| Evidence | Source | SHA / timestamp | Result | Limit |
|---|---|---|---|---|
| Baseline source | Integration checkpoint | `f79fe2b7e0919e7035838bae7ce5f46df01b7e36` | PASS as source identity | Not Production Test deployment identity |
| Live runtime identity | Production Test `ag@192.168.1.32`, explicit read-only PostgreSQL catalog transaction; health check + `pg_stat_activity` | Captured 2026-10-20 ICT; API health `2026-10-20T03:56:42Z` | `taman` used by API; corroborated by one idle activity row | No protected DBA run ID or signed full manifest recorded |
| PostgreSQL version | Same read-only session | PostgreSQL `16.15`; exact query time not retained in sanitized record | PASS | Owner must verify against protected audit |
| Backup checkpoint | Production Test host backup metadata, SHA sidecar and read-only `pg_restore --list` | `2026-10-20 10:00:01 +07`; SHA256 `987b33b996052a10aa5be347d91d3e1a42b40144bc40487afd855b7dd07fa28f` | File/hash/list pass | Real-data restore not attempted |

## Observed role flags and ownership

| Role | Login | Superuser | Create DB | Create role | Replication | Bypass RLS | Membership | Evidence status |
|---|---:|---:|---:|---:|---:|---:|---|---|
| `taman` | yes | yes | yes | yes | yes | yes | None listed | VERIFIED from sanitized live catalog summary; DBA signoff pending |
| `tamancare_catalog_auditor` | role exists | no | no | no | no | no | None reported | VERIFIED flags only; consumer/purpose require Platform confirmation |
| Proposed `taman_app_runtime` | — | no | no | no | no | no | No owner/migration membership; `SET ROLE` not planned | UNVERIFIED; not created live |
| Proposed `taman_migration` | — | no | no | no | no | no | Controlled membership to owner only if approved | UNVERIFIED; not created live |
| Proposed `taman_backup` | — | no | no | no | no | no | No membership planned | UNVERIFIED; not created live |
| `taman_owner` | — | no login | no | no | no | no | Owner role; migration can `SET ROLE` only by explicit grant | Target design only, DBA approval required |

`taman` owns 192 tables, 3 sequences, and 777 indexes (545 public indexes plus 232 TOAST indexes). `public` has 192 tables, 545 indexes and 3 sequences. This confirms object-ownership coupling: replacing a login role alone does not transfer ownership.

## Current grants and security surfaces

- Enabled/forced RLS policies: 0 / 0 / 0. No RLS policy currently provides database resident isolation; application authorization remains critical.
- Default ACLs: 0. Large objects: 0. `SECURITY DEFINER` routines: 0.
- Extensions: `pgcrypto 1.3`, `plpgsql 1.0`.
- `PUBLIC` has `EXECUTE` on 37 public functions; direct `taman` EXECUTE is also present on 37 public functions.
- No `taman` role memberships were listed. The database-specific ACL summary showed `taman` grants on its owned tables and sequences; effective rights are broader because it is superuser.
- `pg_authid`, password hashes, business rows, URLs and environment dumps were not queried.

**DB_MANIFEST_VERIFIED=PARTIAL**. Role posture is verified from sanitized read-only query results; full protected manifest, consumer completeness and DBA signoff are not available in this repo.

## Consumer inventory

| Consumer | Evidence / image / purpose | DB username / secret record | Result |
|---|---|---|---|
| API | Production Test API container; image `taman-care-rbac-rc-api:20261017.2`, digest `sha256:4a6ae8f1547fab7be5a67e42d5839e45d37ccdb13da6dd0cd096660ea007dc93`; health reported ready | Filtered config: `taman`; secret record/version not exposed or identified | VERIFIED as live consumer |
| Frontend | Container present; no direct DB activity observed | N/A in collected evidence | Direct DB use not seen; Platform confirmation required |
| Background worker | No separate worker container in inventory | Unknown | UNVERIFIED |
| Backup timer/script | Host crontab includes hourly backup script; source reads `PG_USER` from container context | Effective DB username/secret version not established | PARTIAL; DBA/Platform action required |
| Migration process | No separate migration container observed | Unknown | UNVERIFIED |
| Monitoring/reporting/scheduler/maintenance scripts | Container snapshot and filtered process evidence do not establish completeness | Unknown | UNVERIFIED |
| Other host/container consumers | `pg_stat_activity` is a timestamped cross-check only | Unknown | UNVERIFIED; not exhaustive |

No consumer is declared absent solely from a `pg_stat_activity` snapshot. Consumer map completeness needs a Platform-signed inventory reconciled with provider/secret-manager audit and deployment records.

## Required DBA / Application Owner confirmation

1. Confirm live query source, capture timestamp, database/cluster identity and protected export object/version/checksum.
2. Confirm role flags, ownership, direct/PUBLIC/inherited grants, function ACL, schema usage/create, sequences, extensions, default ACL and RLS findings.
3. Identify all consumers above with service/container, image digest, purpose, DB username, secret record ID/version, source and last-use evidence.
4. Confirm the ownership transfer/owner-role design and reject any privilege path to superuser, role creation, database creation, replication, server-file access or `BYPASSRLS` for runtime.

DBA signature: ____________________ Date/time: __________ Scope: catalog/ownership/grants/backup.
Application Owner signature: ____________________ Date/time: __________ Scope: SQL call paths, role use and regression acceptance.
