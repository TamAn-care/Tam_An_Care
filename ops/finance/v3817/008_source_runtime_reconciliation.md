# Tâm An Care Finance V3.8.17.8 — Source-to-runtime reconciliation

Status: READ-ONLY SOURCE AUDIT; PRODUCTION GO/NO-GO = NO_GO.
Repo branch: feature/finance-v22-github-build.
Source review is **not** proof that a feature is deployed in the running Docker images.

## Confirmed in GitHub source
- api/src/app.module.ts imports FinanceReadController, FinanceWriteController, FinanceBillingService, MonthlyOperatingResultService.
- api/src/finance-billing/finance-read.controller.ts exposes guarded GET /api/finance-read/operating-result/month/:month, guarded by server-issued identity, configured centerwide roles, and active session.
- api/src/finance-billing/monthly-operating-result.service.ts reads public.finance_entries, requires schema columns, checks posted status and separate month-close attestation. The attestation is supplied as null; it cannot certify READY merely from rows.
- frontend/src/features/finance/MonthlyOperatingResultPanel.tsx displays missing data rather than a monetary result unless READY and validated.
- api/src/finance-billing/finance-write.controller.ts includes a blocked-by-default server configuration gate for allocation writes, not a general income/expense posting endpoint.
- api/src/finance-billing/finance-billing.service.ts contains transactional allocation logic, explicitly does not create ledger revenue.
- frontend/src/api/billing.ts contains historical mockInvoices and sample receipt definitions in source. fetchMonthlyInvoices throws FINANCE_INVOICE_LIST_API_NOT_READY instead of returning mock invoices. Any operational path still referencing these mock arrays requires isolation audit; never seed or display synthetic billing data.
- api/src/finance-billing/canonical-service-contracts.controller.ts describes canonical PostgreSQL contract reads, but existence of its backing tables on Production Test has NOT been established.

## Ground truth from Production Test audit V3.8.17.4–7
- public.finance_entries: exact count 0.
- public.finance_entry_audit: exact count 0.
- public.kitchen_receiving_batches, public.kitchen_receiving_batch_items, public.inventory_transactions, public.resident_consumption_events, public.resident_leave_requests: exact count 0.
- public.admission_cases: exact count 1, not financial revenue.
- Public table discovery (190 tables) did not identify deployed billing_invoices, billing_payment_allocations or canonical contract tables by exact name; confirm schemas/alternate DB before any migration.
- Running API image ID sha256:2c0ba9dbcd0453e25e62c8348d136a3c1da79a34a9175045bab400c198d0618c. No reproducible match to reviewed GitHub commit has yet been shown.
- Hourly backup cron syntax confirmed; successful full isolated restore not yet proven.

## Required before any production implementation
1. Verify runtime image-to-source reproducibility and actual frontend/API route deployment, READ ONLY.
2. Inventory all relevant PostgreSQL schemas/databases, and identify authoritative real billing and expense sources without accessing personal business rows.
3. Audit mock-referenced Billing UI execution paths and prohibit fake/demo business data from reaching runtime.
4. Build real payment, contract, expense and payroll capture design with explicit approvals; no speculative costs or automatic inference from admission/receipts.
5. Obtain isolated backup restoration proof and explicit change approval before migrations or enabling writes.

No deploy, seed, migration, live database write, Docker restart, volume alteration, or backup change was performed in V3.8.17.8.
