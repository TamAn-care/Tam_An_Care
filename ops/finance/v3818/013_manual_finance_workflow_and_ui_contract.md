# Finance V3.8.18.13 — Manual payroll and flexible receipts/expenses workflow

## Functional design, **NOT YET LIVE**
The server-side creation/editing, authenticated RBAC, DB persistence, and frontend forms have not been connected. This revision implements the pure approval workflow to be used by the future server transaction. Test roles are supplied to the pure reducer and MUST NOT be trusted when received from a browser.

Draft → Submit (maker) → Review (independent reviewer) → Approve (director/authorized approver). Submitted vouchers may be Rejected with a mandatory reason. A rejected document requires a controlled new draft/revision flow before being submitted again. Historical audit may not be rewritten. Each action requires optimistic expectedRevision checks, explicit distinct maker/reviewer/approver and an origin uniqueness check. Financial posting stays disabled throughout this workflow.

## Proposed operator screens
1. **Bảng lương:** employee link, pay period, AGREED_AMOUNT or timesheet/manual basis, fixed salary, bonus, allowances, deductions, total payable, cost center, supporting agreement, approver, payment settlement date. Shift assignments are reference evidence, not a mandatory determinant of salary. Future payroll line validator must verify totals using integer VND arithmetic.
2. **Phiếu thu/chi linh hoạt:** income or expense, month/date, category, resident/vendor/other counterparty if relevant, business rationale, source ID and financial origin, invoice or internal voucher, evidence and approval. No invoice is permitted for internal management reporting if justified; tax treatment and VAT deductions must not be automatically assumed.
3. **Duyệt chứng từ:** explicit independent reviewer and director decision, revision, audit history, conflict handling. Receipts/payment flows remain separate from period accruals; cash receipt cannot post a second revenue event.
4. **Đối soát & Báo cáo:** approved does not mean posted; require source completeness, claim uniqueness, verified server rights, period status and atomic append-only ledger/audit/checkpoint. Report `CHƯA ĐỦ DỮ LIỆU` when missing source coverage.

## Release blockers
- No actual manual document storage schema or real API routes/forms in this version
- No server-side authenticated role verification or audit persistence
- No integration with real ledger or live PostgreSQL
- No source-image parity, isolated restore proof or permission to deploy
- **No seeding, fake business records or Production Test writes**

NO_GO for Production Test deployment.
