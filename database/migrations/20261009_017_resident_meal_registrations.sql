-- Apply ONLY after isolated restore, schema audit and approval. No seed.
CREATE TABLE IF NOT EXISTS resident_meal_registrations (
  registration_id UUID PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK','DINNER','EVENING_SNACK')),
  portions INTEGER NOT NULL CHECK (portions BETWEEN 1 AND 10),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED','CANCELLED')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  registered_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resident_id,meal_date,meal_type)
);
CREATE INDEX IF NOT EXISTS idx_resident_meal_registrations_date
  ON resident_meal_registrations(meal_date,meal_type,status);
CREATE TABLE IF NOT EXISTS resident_meal_registration_audit (
  event_id UUID PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES resident_meal_registrations(registration_id),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('REGISTER','UPDATE','CANCEL')),
  previous_record JSONB,
  new_record JSONB NOT NULL,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
