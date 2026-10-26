-- M6 operational foundation. Apply only in isolated PostgreSQL until separately approved.
CREATE TABLE IF NOT EXISTS nutrition_tray_dispatches (
  dispatch_id UUID PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES resident_meal_registrations(registration_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  portions INTEGER NOT NULL CHECK (portions BETWEEN 1 AND 10),
  destination_floor TEXT NOT NULL CHECK (length(btrim(destination_floor)) > 0),
  dispatched_by TEXT NOT NULL,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'DISPATCHED' CHECK (status IN ('DISPATCHED','HANDED_OVER','RECEIVED')),
  UNIQUE (registration_id)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_tray_dispatches_date
  ON nutrition_tray_dispatches(meal_date, meal_type, status);

CREATE TABLE IF NOT EXISTS nutrition_tray_handover_events (
  event_id UUID PRIMARY KEY,
  dispatch_id UUID NOT NULL REFERENCES nutrition_tray_dispatches(dispatch_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('DISPATCHED','HANDOVER_ACKNOWLEDGED')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  destination_floor TEXT NOT NULL,
  portions INTEGER NOT NULL CHECK (portions BETWEEN 1 AND 10),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, event_type)
);

CREATE TABLE IF NOT EXISTS nutrition_hygiene_records (
  record_id UUID PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  task_reference TEXT NOT NULL CHECK (length(btrim(task_reference)) > 0),
  status TEXT NOT NULL CHECK (status IN ('RECORDED','COMPLETED')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_hygiene_records_resident
  ON nutrition_hygiene_records(resident_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS nutrition_food_samples (
  sample_id UUID PRIMARY KEY,
  registration_id UUID REFERENCES resident_meal_registrations(registration_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  retained_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_STORAGE' CHECK (status IN ('IN_STORAGE','DISPOSAL_RECORDED')),
  collected_by TEXT NOT NULL,
  collected_by_role TEXT NOT NULL,
  disposed_at TIMESTAMPTZ,
  disposed_by TEXT,
  notes TEXT NOT NULL DEFAULT '',
  CHECK (retained_until >= collected_at + INTERVAL '24 hours'),
  CHECK ((status = 'IN_STORAGE' AND disposed_at IS NULL AND disposed_by IS NULL)
      OR (status = 'DISPOSAL_RECORDED' AND disposed_at IS NOT NULL AND disposed_by IS NOT NULL
          AND disposed_at >= retained_until))
);

CREATE INDEX IF NOT EXISTS idx_nutrition_food_samples_retention
  ON nutrition_food_samples(retained_until, status);

CREATE TABLE IF NOT EXISTS nutrition_operational_audit (
  event_id UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  resident_id TEXT REFERENCES residents(resident_id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_operational_audit_aggregate
  ON nutrition_operational_audit(aggregate_type, aggregate_id, occurred_at);
