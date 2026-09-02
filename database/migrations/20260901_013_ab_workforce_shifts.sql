BEGIN;

CREATE TABLE IF NOT EXISTS shift_assignments (
    shift_id TEXT PRIMARY KEY,
    staff_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('MORNING', 'AFTERNOON', 'NIGHT', 'CUSTOM')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    actual_checkin_at TIMESTAMPTZ,
    actual_checkout_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT', 'CANCELLED')),
    assigned_by TEXT NOT NULL REFERENCES staff_actors(actor_id),
    assigned_by_role TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shift_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_shift_staff_date
  ON shift_assignments(staff_actor_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_shift_date_type
  ON shift_assignments(shift_date, shift_type);

CREATE INDEX IF NOT EXISTS idx_shift_status
  ON shift_assignments(status);

CREATE TABLE IF NOT EXISTS shift_handovers (
    handover_id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL REFERENCES shift_assignments(shift_id),
    from_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
    to_actor_id TEXT REFERENCES staff_actors(actor_id),
    summary_note TEXT NOT NULL,
    critical_alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED')),
    submitted_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handover_shift
  ON shift_handovers(shift_id);

CREATE TABLE IF NOT EXISTS shift_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id TEXT NOT NULL REFERENCES shift_assignments(shift_id),
    event_type TEXT NOT NULL CHECK (event_type IN ('SHIFT_SCHEDULED', 'SHIFT_CHECKIN', 'SHIFT_CHECKOUT', 'HANDOVER_SUBMITTED', 'HANDOVER_ACKNOWLEDGED', 'SHIFT_CANCELLED')),
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_audit_shift
  ON shift_audit(shift_id, created_at DESC);

COMMIT;
