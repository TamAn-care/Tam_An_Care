BEGIN;

CREATE TABLE IF NOT EXISTS resident_cost_events (
  resident_cost_event_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id) ON DELETE RESTRICT,
  resident_consumption_event_id TEXT NOT NULL UNIQUE
    REFERENCES resident_consumption_events(resident_consumption_event_id)
    ON DELETE RESTRICT,
  inventory_item_id TEXT NOT NULL
    REFERENCES inventory_items(inventory_item_id) ON DELETE RESTRICT,

  quantity NUMERIC(14,4) NOT NULL,
  unit TEXT NOT NULL,

  unit_cost_vnd NUMERIC(18,2) NOT NULL,
  total_cost_vnd NUMERIC(18,2) NOT NULL,

  cost_source TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,

  recorded_by TEXT NOT NULL
    REFERENCES staff_actors(actor_id) ON DELETE RESTRICT,
  recorded_by_role TEXT NOT NULL,

  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT resident_cost_event_quantity_ck
    CHECK (quantity > 0),

  CONSTRAINT resident_cost_event_unit_ck
    CHECK (length(btrim(unit)) > 0),

  CONSTRAINT resident_cost_event_unit_cost_ck
    CHECK (unit_cost_vnd >= 0),

  CONSTRAINT resident_cost_event_total_cost_ck
    CHECK (total_cost_vnd >= 0),

  CONSTRAINT resident_cost_event_total_math_ck
    CHECK (total_cost_vnd = round(quantity * unit_cost_vnd, 2)),

  CONSTRAINT resident_cost_event_role_ck
    CHECK (
      recorded_by_role IN (
        'CAREGIVER','NURSE','CARE_MANAGER','SUPERVISOR'
      )
    )
);

CREATE INDEX IF NOT EXISTS resident_cost_events_resident_time_idx
  ON resident_cost_events(resident_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS resident_cost_events_item_time_idx
  ON resident_cost_events(inventory_item_id, occurred_at DESC);


CREATE TABLE IF NOT EXISTS resident_cost_periods (
  resident_cost_period_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id) ON DELETE RESTRICT,

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'OPEN',

  calculated_total_vnd NUMERIC(18,2) NOT NULL DEFAULT 0,
  reconciled_total_vnd NUMERIC(18,2) NULL,

  reconciled_at TIMESTAMPTZ NULL,
  reconciled_by TEXT NULL
    REFERENCES staff_actors(actor_id) ON DELETE RESTRICT,
  reconciled_by_role TEXT NULL,

  locked_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL
    REFERENCES staff_actors(actor_id) ON DELETE RESTRICT,
  locked_by_role TEXT NULL,

  note TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT resident_cost_period_range_ck
    CHECK (period_end > period_start),

  CONSTRAINT resident_cost_period_status_ck
    CHECK (status IN ('OPEN','RECONCILED','LOCKED')),

  CONSTRAINT resident_cost_period_calculated_ck
    CHECK (calculated_total_vnd >= 0),

  CONSTRAINT resident_cost_period_reconciled_ck
    CHECK (
      reconciled_total_vnd IS NULL
      OR reconciled_total_vnd >= 0
    ),

  CONSTRAINT resident_cost_period_reconcile_actor_ck
    CHECK (
      (
        reconciled_at IS NULL AND
        reconciled_by IS NULL AND
        reconciled_by_role IS NULL
      )
      OR
      (
        reconciled_at IS NOT NULL AND
        reconciled_by IS NOT NULL AND
        reconciled_by_role IN ('CARE_MANAGER','SUPERVISOR')
      )
    ),

  CONSTRAINT resident_cost_period_lock_actor_ck
    CHECK (
      (
        locked_at IS NULL AND
        locked_by IS NULL AND
        locked_by_role IS NULL
      )
      OR
      (
        locked_at IS NOT NULL AND
        locked_by IS NOT NULL AND
        locked_by_role IN ('CARE_MANAGER','SUPERVISOR')
      )
    )
);

CREATE INDEX IF NOT EXISTS resident_cost_periods_resident_period_idx
  ON resident_cost_periods(
    resident_id,
    period_start DESC,
    period_end DESC
  );

COMMIT;
