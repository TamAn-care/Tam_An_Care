-- Approved M6 contract closure. Apply only to isolated PostgreSQL until separately approved.
ALTER TABLE nutrition_tray_handover_events
  ADD COLUMN IF NOT EXISTS discrepancy_portions INTEGER NOT NULL DEFAULT 0 CHECK (discrepancy_portions >= 0),
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS nutrition_caregiver_floor_assignments (
  actor_id TEXT NOT NULL,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  floor TEXT NOT NULL CHECK (length(btrim(floor)) > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (actor_id, resident_id, floor)
);

CREATE TABLE IF NOT EXISTS nutrition_hygiene_inspections (
  inspection_id UUID PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES nutrition_hygiene_records(record_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  inspector_id TEXT NOT NULL,
  inspector_role TEXT NOT NULL CHECK (inspector_role IN ('CARE_MANAGER','SUPERVISOR')),
  finding TEXT NOT NULL CHECK (length(btrim(finding)) > 0),
  decision TEXT NOT NULL CHECK (decision IN ('CONFIRMED','NONCONFORMITY')),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutrition_sample_inspections (
  inspection_id UUID PRIMARY KEY,
  sample_id UUID NOT NULL REFERENCES nutrition_food_samples(sample_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  inspector_id TEXT NOT NULL,
  inspector_role TEXT NOT NULL CHECK (inspector_role IN ('CARE_MANAGER','SUPERVISOR')),
  finding TEXT NOT NULL CHECK (length(btrim(finding)) > 0),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_hygiene_inspections_record
  ON nutrition_hygiene_inspections(record_id, inspected_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_sample_inspections_sample
  ON nutrition_sample_inspections(sample_id, inspected_at DESC);
