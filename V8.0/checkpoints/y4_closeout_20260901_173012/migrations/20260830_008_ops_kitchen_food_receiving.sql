BEGIN;

CREATE TABLE IF NOT EXISTS food_receiving_events (
  food_receiving_event_id TEXT PRIMARY KEY,

  inventory_transaction_id TEXT NULL
    REFERENCES inventory_transactions(inventory_transaction_id),

  inventory_item_id TEXT NOT NULL
    REFERENCES inventory_items(inventory_item_id),

  inventory_lot_id TEXT NULL
    REFERENCES inventory_lots(inventory_lot_id),

  receiving_status TEXT NOT NULL
    CHECK (
      receiving_status IN (
        'ACCEPTED',
        'REJECTED',
        'QUARANTINED'
      )
    ),

  quantity NUMERIC(14,4) NOT NULL
    CHECK (quantity > 0),

  unit TEXT NOT NULL
    CHECK (length(btrim(unit)) > 0),

  received_at TIMESTAMPTZ NOT NULL,

  received_by TEXT NOT NULL
    REFERENCES staff_actors(actor_id),

  received_by_role TEXT NOT NULL
    CHECK (
      received_by_role IN (
        'CARE_MANAGER',
        'SUPERVISOR'
      )
    ),

  note TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT food_receiving_inventory_tx_status_ck
    CHECK (
      (
        receiving_status = 'ACCEPTED'
        AND inventory_transaction_id IS NOT NULL
      )
      OR
      (
        receiving_status IN ('REJECTED','QUARANTINED')
        AND inventory_transaction_id IS NULL
      )
    ),

  CONSTRAINT food_receiving_inventory_transaction_uq
    UNIQUE (inventory_transaction_id)
);

CREATE INDEX IF NOT EXISTS
  food_receiving_events_received_at_idx
ON food_receiving_events(received_at DESC);

CREATE INDEX IF NOT EXISTS
  food_receiving_events_item_received_idx
ON food_receiving_events(
  inventory_item_id,
  received_at DESC
);

CREATE INDEX IF NOT EXISTS
  food_receiving_events_lot_received_idx
ON food_receiving_events(
  inventory_lot_id,
  received_at DESC
)
WHERE inventory_lot_id IS NOT NULL;

COMMIT;
