# Finance V3.8.18.22 — server-trusted document read preflight

Checkpoint V3.8.18.21 CI SUCCESS. V3.8.18.22 adds a pure read-input validation contract and verifies that document metadata must be supplied by an authenticated server-side source. No browser fields beyond an opaque documentId may be used for authorization. Any missing, inconsistent, or non-persisted metadata is rejected.

**Important implementation boundary**: `persisted:true` is a trusted *type contract* only; it is not proof of a PostgreSQL read. A future service must load metadata from the authoritative persisted source, validate permissions against an unrevoked real session in the same access flow, prevent TOCTOU authorization bypass, and return only role-appropriate fields. V3.8.18.22 DOES NOT claim to connect or read actual approved payroll/source records.

- No Nest HTTP route registered; no API enabled for confidential payroll.
- No SQL migration, live DB writes, auto-seed, or demo data.
- No Finance ledger posting, production deploy, PostgreSQL restart or Docker volume changes.
- Next work: verified canonical source discovery and real read-only repository (fail-closed when source missing), strict row-scope and output-field redaction, isolated HTTP auth negative tests, approval/rollback gates.
- Production GO/NO_GO: NO_GO.
