# Finance V3.8.18.23 — authoritative manual document source discovery

V3.8.18.22 CI PASS (run 38025270058). Prior V3.8.18.11 catalog inspection verified public.finance_entries as an existing finance ledger but did NOT establish public.finance_manual_documents or a canonical payroll/invoice/voucher source.

This change introduces a deliberately conservative table-name-and-column-contract gate. A present catalog match can yield only CANDIDATE_SCHEMA_ONLY, never direct authorization to read payroll, write documents, approve or post. A source must also have verified row provenance, server session/RBAC, audit linkage, schema version, source-to-runtime equivalence and resource-level confidentiality checks.

The isolated finance_manual_ci.documents table used by CI is NOT a live operational source and MUST NOT be copied or treated as existing production data. finance_entries is an existing ledger, NOT a canonical source. Missing sources imply CHƯA ĐỦ DỮ LIỆU.

Strict safety: no database query/write executed by this module, no migration, seed, demo creation, Docker/Postgres restart, deploy, or GitHub merge. Production GO_NO_GO=NO_GO. Before a real adapter, obtain a read-only `pg_catalog` inspection from the target runtime, confirm exact physical table and columns, owner/permissions, revision and approved evidence model, then implement read-only query and independent negative tests.
