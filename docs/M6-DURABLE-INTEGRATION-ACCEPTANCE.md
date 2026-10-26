# M6 Durable Nutrition Integration

This checkpoint was exercised only against the run-owned PostgreSQL 16
container on `127.0.0.1:15432`. Production Test was not contacted or
mutated.

## Implemented foundation

- `20261027_018_nutrition_operational_records.sql` adds forward-only,
  additive tables for tray dispatches, handover events, hygiene records,
  food samples, and append-only operational audit events.
- `NutritionOperationsService` persists dispatch, hygiene, and sample
  collection/disposal actions through transactions.
- Food-sample disposal is rejected before the server-computed 24-hour
  retention deadline and records are never automatically deleted.
- Approved contract closure adds floor-assignment-checked caregiver receipt,
  duplicate-receipt protection, separate manager hygiene inspection, and
  manager sample inspection records.

## Isolated evidence

`api/test/nutrition-operations.integration.test.cjs` passed:

- dispatch persistence and duplicate protection;
- hygiene persistence and resident-scope denial;
- food-sample retention, premature-disposal denial, and finalization;
- append-only operational audit evidence.

The existing M6 meal-registration suite remains the baseline for durable
registration, scope, diet enforcement, concurrency, and signed-session
coverage. No production database, image, volume, or backup was changed.

## Remaining scope

The pre-existing inventory/dispatch mock model remains separate from the
resident-linked durable operations model. The new Nutrition operations panel
uses the durable API for approved dispatch, receipt, hygiene, inspection, and
sample actions. Production deployment remains out of scope for this branch.
