# Finance V1.0 migration and rollback notes

`008_discount_and_absence_policy.sql` is an additive migration after Finance V3.1.7. It only creates policy, assignment, application, absence-evidence, audit tables, constraints and guards. It does not infer or backfill contracts, price, absence, service or discount data. Apply and rollback qualification is isolated PostgreSQL 16 only.

The migration has no destructive `down.sql`: after any business evidence is written, dropping these tables would erase approved policy and audit history. Before production approval, rollback means restore the pre-migration backup to an isolated environment and reconcile; once business writes are allowed, use a separately approved forward correction and retain the original records. This V1 release does not apply the migration to Production Test.

Every draft discount must have a distinct proposer and approver, immutable approval terms, an effective window and resident/contract assignment. The database rejects overlapping assignments per resident and contract and overlapping applications on a fee line. Every applied discount is represented by a negative `DISCOUNT` invoice item and an idempotent application record linked to the eligible positive item. Issued/approved invoice mutation remains blocked by the preceding invoice immutability trigger.

Meal deductions require evidence linked to a source absence record; timestamp interpretation is Asia/Ho_Chi_Minh in the calculation layer. This schema does not invent meal unit prices or make deductions without confirmed, approved evidence. Room and care fees are not reduced for absence.

Production source mapping and cross-module runtime parity remain unverified, and Finance writes remain disabled until authorized separately. This migration does not make billing or P&L release-ready by itself.
