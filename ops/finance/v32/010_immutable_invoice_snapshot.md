# Finance V32.010 — immutable invoice issue snapshot

This additive migration adds an immutable JSONB evidence snapshot, SHA-256 digest,
and issue timestamp to `billing_invoices`. A snapshot is generated in the same
database update that changes an approved invoice to `ISSUED`; contract signoff,
approval evidence, invoice lines, source references, and discount applications
are captured from the canonical tables. Existing issued records are not backfilled.

The migration is compatible with the previous application version because the
new columns are nullable and the existing read endpoint detects their presence.
Older application images can be restored while leaving the additive columns and
trigger installed. Do not drop the snapshot columns after invoices have been
issued: that would destroy financial evidence. Schema rollback therefore means
application rollback with the additive schema retained; any trigger correction
must be delivered as a forward migration.

The CI migration test applies the chain on an isolated PostgreSQL 16 service,
issues only a synthetic invoice, verifies the snapshot and digest, replays the
issue transition, and asserts that snapshot mutation is rejected. It performs no
Production Test connection, migration, or seed.
