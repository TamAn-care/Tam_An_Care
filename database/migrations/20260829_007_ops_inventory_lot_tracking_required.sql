BEGIN;

ALTER TABLE inventory_items
    ADD COLUMN lot_tracking_required boolean NOT NULL DEFAULT false;

COMMIT;
