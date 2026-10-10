# Finance V3.8.18.21 — confidential read acceptance

- Prior V3.8.18.20 CI runs completed SUCCESS.
- Added isolated API-service-level tests invoking FinanceDocumentReadBoundaryV381820 with mock read-only session query. Exercises anonymous, configured/not configured roles, payroll deny, authorized read, expired/revoked session reject shape, and non-payroll access.
- No document data rows or real payroll amount values are exposed by the boundary; it only permits the future read.
- The document metadata must be loaded by the server from verified durable storage. The caller must never provide trusted metadata fields or bypass row scope. Authorization must be repeated close to the actual read within an appropriate database snapshot.
- No HTTP route has been registered, no production DDL/DML, no fake/demo data in Production Test, and no live Finance Ledger posting.
- Next activation gates: real canonical manual document schema and source parity proof, role-grant audit, row-level visibility constraints, isolated restore with checksums, source-image reproduction, API authenticated HTTP negative tests, acceptance of UI record/approval flows. Keep NO_GO until all pass.
