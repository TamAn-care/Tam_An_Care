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
- Tray acknowledgement is deliberately disabled until the receiving role,
  state transition, duplicate acknowledgement, and quantity rules are
  approved.

## Isolated evidence

`api/test/nutrition-operations.integration.test.cjs` passed:

- dispatch persistence and duplicate protection;
- hygiene persistence and resident-scope denial;
- food-sample retention, premature-disposal denial, and finalization;
- append-only operational audit evidence.

The existing M6 meal-registration suite remains the baseline for durable
registration, scope, diet enforcement, concurrency, and signed-session
coverage. No production database, image, volume, or backup was changed.

## Remaining decisions

The exact receiving role/state machine for tray handover, the canonical
hygiene checklist vocabulary, and the food-sample evidence/disposal policy
remain recorded in `docs/M6-BUSINESS-DECISIONS-REQUIRED.md`. Until approved,
the unresolved acknowledgement action stays deny-by-default. The existing
Nutrition UI still contains mock operational paths and therefore is not
release-complete for these new records.
