# Tâm An — canonical resident paper file number / contract serial (release gate)

## Accepted rule
- Permanent, human-readable record: `XXXX/YYYY/TA`; short-stay without a signed contract: `XXXX/YYYY/TA/TN`.
- XXXX is **one globally allocated, non-reused serial**. Preserve exact issued serial text from the contract (001, 9999, 1000000), without truncation or zero-padding; it is not a four-digit ceiling.
- YYYY is the Vietnam-local **year of first issuance**, frozen permanently. Do not re-render old records with the current year after New Year.
- Trial -> contract keeps the **same identity (serial, issuance year)**; remove only `/TN` upon *confirmed, persisted contract linkage*. Never allocate a second serial.
- Contract suffix/identifier must embed the same serial and year, e.g. `001/2026/HĐDV-TA` and resident `001/2026/TA`. Existing serial formatting (including leading zeroes) must be preserved exactly from the signed contract.
- The globally unique serial is not released on deletion, canceled contracts, departed residents, or trial conversion. Printed physical-file indexes must map to the immutable internal resident ID.
- Never use `MAX(serial)+1`, JavaScript `Number`, or localStorage to **allocate** an ID: concurrent sessions, deleted rows and integer precision break uniqueness.

## Current GitHub audit (12 Oct 2026)
- `api/src/residents/resident.service.ts` requires caller-supplied `residentCode`.
- `frontend/src/api/service-contracts.ts` generates contract code using the max number from locally held contracts, not a server-backed allocator.
- The GitHub `main` source is not identical to deployed Production Test V14. Do not overwrite its resident, contract, paper record, admission, or clinical modules with main.

## Release design (not yet implemented)
1. Read-only provenance inventory in runtime DB/API: resident internal IDs and codes; service contract persistence and code shapes; short-stay/contract status, paper record references, inbound/outbound identifiers, and all code uniqueness/indexes. Summarize only counts and redacted collision groups; no sensitive personal data in GitHub.
2. Back up PostgreSQL + attachments + source + configuration; verify isolated restore; maintain rollback checkpoint.
3. Add durable database allocator (PostgreSQL sequence, BIGINT internally; decimal text at API boundary) and **issuance ledger that is never deleted**, unique serial and unique canonical code. Use a transaction and atomic allocation; idempotency key for retries; do not reuse on canceled operations. Avoid introducing resident identity changes to every dependent table.
4. Create resident (including trial) on server using issued identity. Reject client-provided code/serial overriding allocator. Enforce unique code and explicit trial state.
5. Link a signed contract to existing resident ID inside a transaction; ensure its serial/year matches the resident's immutable identity. Transition `/TN` -> ordinary code **only after contract persistence succeeds**, without changing resident ID or serial.
6. New issuance year uses `Asia/Ho_Chi_Minh` date captured on server; older records and later contract conversions retain frozen issuance year.
7. For legacy codes/contracts, generate a **read-only mapping proposal and collision report**; never rename existing actual records, reprint contracts, or rename physical file index without a reviewed mapping and formal approval. Preserve legacy signed contract codes exactly; the displayed resident record code must use the contract's exact serial/year text. No automatic reissuance of signed contract numbers.
8. Regression suite with disposable PostgreSQL: simultaneous allocations (>=100 requests), retry idempotency, trial->contract with failure rollback, deleted/canceled entities, year rollover, 999999->1000000;1000000, enormous decimal serial, wrong resident contract, forged serial, unauthorized create/update, existing file references and printed templates.
9. Deploy API/frontend only after exact source↔image↔commit reconciliation, backup/restore and tests; any migration must be separately approved, never run unconditionally from CI. Production Test has real business data: no demo seed/reset.

## Explicit release decision
`PRODUCTION_TEST_GO_NO_GO=NO_GO` until all steps above have concrete PASS evidence. Pure formatter utilities in this branch are not authorization to deploy. Staff RBAC, Guardian, Finance and Nutrition work must remain isolated.

## 12 Oct 2026 revised display decision
Use **exact contract number component** with its original leading zeroes: contract `001/2026/HĐDV-TA` -> record `001/2026/TA`; trial `001/2026/TA/TN`, when linked to that contract -> `001/2026/TA`. Serial can be `1000000` or longer. Never zero-pad, truncate, or regenerate a previously issued serial. Global uniqueness compares its canonical numeric value so `001` and `1` cannot both be issued to different people.
