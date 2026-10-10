# Finance V3.8.18.42 → V3.8.18.43 verified findings

The V42 operator executed read-only catalog constraint/index inspection on Production Test taman_care; 62 constraints and 24 indexes returned, COMMIT and PASS. No data writes/migrations.

**Observed live finance_entries contract**
- entry_type CHECK allows REVENUE, DIRECT_COST, PAYROLL, OPERATING_EXPENSE, DEPRECIATION, INTEREST, TAX.
- status CHECK: DRAFT, POSTED, VOID.
- source_mode CHECK: MANUAL, SYSTEM.
- unique partial index uq_finance_entries_system_source on (source_domain, source_entity_type, source_entity_id, entry_type) when source_mode=SYSTEM and source fields non-null.
- No matching MANUAL source unique constraint in returned indexes; it does NOT prove there are duplicate rows.
- finance_entry_audit event_type CHECK: CREATED, UPDATED, VOIDED. It is NOT a voucher approval log.

**Material gap** The V36 CI-only ledger prototype collapses everything other than REVENUE into generic EXPENSE, which is NOT a valid public.finance_entries entry_type. V43 adds pure canonical classification; no posting operation is enabled. Preserve the detailed entry type in ledger, aggregate classes only for reporting.

**Blocking concerns before live integration**
- Real manually approved finance voucher table NOT_FOUND in V41. Source reference and separate approval/audit must exist before posting. Existing ledger manual rows are not proof of approvals.
- Index only guards SYSTEM source with non-null origin fields, not MANUAL idempotency. Require an approved idempotency design with uniqueness and concurrency tests BEFORE any live write.
- Kitchen receiving stock cost is NOT automatically consumed expense. Resident consumption has quantity but not direct value; verify lot valuation and accounting policy.
- Leave deduction flags do not prove an approved monetary discount.
- Payroll basis not verified in current live schema.
- Never use the unverified V36 prototype SQL against Production Test.
- Month result remains CHUA_DU_DU_LIEU.
