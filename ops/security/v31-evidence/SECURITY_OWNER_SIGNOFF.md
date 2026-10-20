# Security owner sign-off and approval matrix — V31

Prepared: 2026-10-20 ICT. SHA256 of this unsigned approval form is listed in sibling SHA256SUMS.

This is a prepared approval record. Blank signature fields are intentionally unsigned. The operational approver's business principle is recorded: Admin/Superior is the highest Tâm An Care application permission and is not PostgreSQL SUPERUSER. This statement does not attest to DB, provider or runtime evidence.

## Overall evidence state

- DB role posture on Production Test is verified from a sanitized read-only catalog summary: role taman has SUPERUSER, CREATEDB, CREATEROLE, REPLICATION and BYPASSRLS.
- Full DB consumer manifest and exact per-object target grants are incomplete.
- Current backup archive checksum and TOC pass; real restore is not proven.
- JWT source shows a single environment-key path. Provider, secret-record version, replicas, last-use and live revoke state are unknown.
- 36 Gitleaks baseline detections are individually listed in HISTORICAL_SECRET_DISPOSITION.md; all remain UNKNOWN.
- V31 fixes the auth evidence contract. API build, 22-case policy evidence gate, frontend build and PostgreSQL 16 HTTP/Chromium passed on exact code commit 1f0ca57f7974a64bf36c71f378c5bc3525b12e0f. The final evidence revision 7ac469236b6a62c2466173020a4bbd75aebce5aa passed both workflows on the exact SHA (Auth run 39378856687; PostgreSQL 16 HTTP/Chromium run 39378856649).
- No live DB role/credential, JWT key, Production Test dataset or deployment was changed.

## Signature table

| Role | Required scope acknowledged | Evidence status | Decision | Signer / signature | Timestamp |
|---|---|---|---|---|---|
| DBA | Verify protected role/grant/ownership manifest, complete DB consumer list, object allowlist, backup/restore identity and negative/positive DB tests | UNVERIFIED; see DB_ROLE_AND_CONSUMER_MANIFEST.md and DB_GRANTS_ALLOWLIST.md | PENDING | ____________________ | __________ |
| Application Owner | Verify code SQL call paths, migration separation and Admin/Superior, Staff, Guardian, Finance regression under target runtime role | UNVERIFIED; candidate unit/HTTP evidence does not establish target-role complete regression | PENDING | ____________________ | __________ |
| Security | Verify provider audit, secret records/version, all 36 finding dispositions, revoke status, rotation decision and acceptance | UNVERIFIED; see JWT_PROVIDER_RUNTIME_INVENTORY.md and HISTORICAL_SECRET_DISPOSITION.md | PENDING | ____________________ | __________ |
| Platform | Verify API/worker/replica/config/secret distribution, consumer completeness, version rollout, session invalidation and revoke propagation | UNVERIFIED | PENDING | ____________________ | __________ |

## If one person holds multiple roles

The same person may enter their name on multiple rows only after independently reviewing the evidence for each row's stated scope. Each role needs its own decision, signature and timestamp. A signature for operational approval does not substitute for the DBA, Application Owner, Security or Platform technical attestation. Do not copy or infer a signature.

## Exact owner evidence still required

1. **DBA:** provide protected object/version and checksum for the READ ONLY PostgreSQL 16 manifest; attest role flags, ownership, direct/PUBLIC/inherited ACLs, schema/table/sequence/function privileges, extension/large-object/SECURITY DEFINER/RLS inventory; identify backup DB role; approve exact object/verb allowlist; attach checkpoint restore evidence or mark it unverified.
2. **Application Owner:** provide source SHA and complete SQL/call-path to object matrix; identify DDL moved to approved migrations; verify Admin/Superior, Staff, Guardian, Finance and resident cross-scope positive/negative tests run under the proposed runtime role; sign only those results.
3. **Security:** obtain provider/account and secret-record ID/version in protected systems; confirm runtime/consumer/last-use evidence without exporting secrets; classify each H01–H36; provide revoke/rotation evidence for affected versions and state whether rotation is required.
4. **Platform:** inventory every API instance, worker, scheduler, backup, migration, monitoring/reporting and maintenance process with image digest, DB username, secret record/version, source and timestamp; attest all replicas and session/revoke propagation.

The operator should return these four completed sections as one sanitized approval packet. Missing evidence must remain UNVERIFIED.
