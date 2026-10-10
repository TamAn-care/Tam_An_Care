# Tâm An Care Finance V3.8.18.5 — Canonical live-data synchronization architecture

**Status:** Design + pure planner + isolated CI. **Not a deployment or operational integration.**

## Authoritative sources and handoffs

| Module / event | Future authoritative source | Finance treatment | Critical gate |
|---|---|---|---|
| Signed service contract & approved version | Persisted contract version, resident and effective dates | Defines fee basis only; **never revenue by itself** | Approval/signature + amendment precedence |
| Approved invoice / monthly fee statement | Persisted approved billing document bound to active contract and service period | One REVENUE recognition candidate by financial origin and month | No duplicates; adjustment/void must reverse explicitly |
| Payment receipt | Verified cash/bank receipt | Settlement only; **not additional revenue** | One receipt, partial payment/deposit/refunds tracked distinctly |
| Receipt-to-invoice allocation | Approved linkage to receivable | Outstanding balance only | Atomic idempotency and amount ceilings |
| Kitchen receipt / stock intake | Receiving batches and items | Cost evidence only; **not automatically recognized expense** | Avoid double-counting batch header + line item + stock movement |
| Inventory movement and resident consumption | Stock movement and usage events | Operational quantity evidence, never direct unverified cost or revenue | Valuation policy and approved accounting document |
| Approved vendor / operating cost document | Approved amount, period and invoice evidence | DIRECT_COST or OPERATING_EXPENSE candidate | Explicit classification and service period |
| Approved payroll register | Approved payroll, period and allocated cost | PAYROLL candidate | RBAC and reconciliation; do not infer payroll from attendance alone |
| Depreciation, interest, tax | Approved schedules/documents | Dedicated ledger category candidate | Accounting policy and approval evidence |
| Resident leave and care level changes | Approved leave/amendment records | Adjustment input to billing only | 48-hour meal-fee rules, effective dates, signed contract amendments |

## Processing contract (future live server implementation)

1. Read source records from **verified PostgreSQL authoritative adapters** (no browser state, fixtures, mock arrays). Confirm exact schema/source provenance before implementing.
2. Validate identity and immutable version, active financial period, evidence, reviewer role, signature/approval and reconciliation.
3. Derive canonical financial **origin key**; enforce uniqueness across document versions and module pathways. The existing SYSTEM unique index by source entity is necessary but **not sufficient** to guarantee one recognition per financial event if upstream IDs differ.
4. Produce candidates via `planCanonicalFinanceSync`. If any validation fails, block the batch; no partial posting.
5. In a separate, future **explicitly approved** server-only write phase, apply optimistic version checks, transactional idempotency/unique constraints, append-only audit, a verified approval boundary and read-after-write reconciliation.
6. Separately settle receipts against receivables; never treat cash movement as another revenue event.
7. Derive monthly totals from POSTED canonical ledger by recognition date (integer VND decimal strings). Month-close attestation and independently verified source completeness are mandatory for a READY state.
8. With incomplete sources, show `CHƯA ĐỦ DỮ LIỆU`, never numeric zero as an asserted profit, and never synthesize records.

## Critical missing components before a live-data-ready deployment

- Verified persisted canonical contracts, billing invoices, receipts and allocations in Production Test.
- Approved vendor expenses, recurring operating expenses, payroll, depreciation/interest/tax inputs.
- Explicit adapter interface/version, source snapshot provenance and approved status mapping.
- Durable synchronization cursors/checkpoints, replay/retry and outbox or reliable reconciliation (no duplicated postings).
- Secure Finance API RBAC, append-only immutable audit protections, negative authorization tests.
- Tested integration build against the **actual** Production Test baseline, schema compatibility, source-image provenance.
- Verified backup **and isolated restore**, rollback rehearsals, mobile/desktop acceptance.
- No automatic seed, fixtures, fake/demo source events; no database reset or Docker volume deletion.

**Decision:** NO_GO for live Production Test deployment; isolated CI readiness does not grant release approval.
