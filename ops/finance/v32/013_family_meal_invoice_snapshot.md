# Family meal invoice snapshot extension (v32.013)

This additive migration extends the existing invoice item source metadata for confirmed `FAMILY_EXTRA_MEAL` events and the immutable invoice snapshot created by v32.010. It records the resident meal policy marker (`includedInContractPackage=true`, `separatelyBillable=false`) and the complete family meal event evidence on the issued invoice snapshot.

Before an invoice can be issued, every confirmed family meal order for that resident, contract, and billing month must have exactly matching invoice line source, service date, quantity, unit price, price-list version, and line amount. Missing, mismatched, or extra source lines fail closed. It does not create or price resident meals.

The corresponding Finance draft API only imports confirmed family meal orders and requires a signed, approved contract. It creates a package line using the approved contract monthly fee and does not split out resident food. Approved discount or absence adjustments currently block draft generation until their calculation engine is connected.

## Verification

`ops/ci/finance-billing-schema-migration-test.sh` applies this migration after the canonical v32.012 chain on disposable PostgreSQL 16, issues a synthetic invoice with a confirmed family meal source, and asserts snapshot contents and immutability. Run it only in the isolated GitHub Actions PostgreSQL service (`GITHUB_ACTIONS=true`).

## Rollback

No destructive down migration is provided. Before production use, recover by restoring the approved pre-migration backup and the prior API/frontend images. Do not drop invoice columns, constraints, or triggers after business evidence could have been written.
