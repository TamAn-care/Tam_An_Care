# Contract source-of-truth audit — 2026-10-09

## Verified repository and Production Test findings
- Both `antigravity-production-test` and Finance branch frontend `service-contracts.ts` use `localStorage` and attempt `/api/service-contracts`.
- `getStoredServiceContracts()` falls back to hard-coded `MOCK_SERVICE_CONTRACTS`, containing fabricated contract and resident profiles, if no saved local contracts are found. **Do not use these for operational billing and do not seed them.**
- `saveServiceContract()` writes localStorage before calling API and swallows API failures. `deleteServiceContract()` also swallows backend failures. A successful UI action therefore DOES NOT prove server persistence.
- The GitHub Production Test source tree does not include a corresponding `api/src` service-contract controller/module; the READ-ONLY Production Test PostgreSQL metadata audit found no `service_contract_records` or other contract-named table. These findings do not prove the *running* frontend or any external backend lacks other integrations; those still require a separate runtime audit.
- `ServiceContract` frontend model has contractId/contractCode/residentId/status/signedDate/effectiveDate/updatedAt, and `appendix` roomType,bedCode,baseMonthlyFee,additionalServices,discount,totalMonthlyFee. No signed and immutable fee version or formally approved post-admission amendment trail is established from the inspected API model.

## Approved design direction (implementation gated)
1. `residents.resident_id` remains the sole resident identity; link `admission_cases.resident_id` and post-admission care-level decisions to that identity.
2. Only a server-verified, signed, effective, current-version contract with documented approval may authorize invoice generation. Explicitly forbid localStorage and MOCK source.
3. Derive billable basic fee, elected services, discounts, total, room/bed and effective dates from the *approved contract terms*, not from mutable front-end defaults.
4. A changed room, care level, unit price, service package or discount after admission requires a versioned approval/amendment with effective date. Previous issued months remain immutable unless separately adjusted with signed audit.
5. Finance must read the same canonical contract the Service Contracts module writes; do not silently mirror records into `service_contract_records`. Verify actual backend before applying foundation SQL, as that migration creates a second contract table.
6. Finance WRITE stays off by default, and no Finance invoice or posting based on browser contract records can be enabled.

## Next hard gates
- Identify authenticated backend implementation and durable persistence for `/api/service-contracts` in the actual runtime, or design and accept one shared canonical backend before migration.
- Confirm current production version and coexistence with localStorage; plan user-approved controlled cleanup of demo fallback, never auto-delete real browser records.
- Obtain signed version/approval and care-level mapping from admissions before charging; verify price arithmetic against contract-specific terms.
- CI isolated contract preflight gate is necessary but NOT sufficient for server authenticity, medical care-level authorization, or binding signed document.

CURRENT_STATUS=CONTRACT_CANONICAL_BACKEND_UNVERIFIED; FINANCE_WRITE=DISABLED; DEPLOY=NO.