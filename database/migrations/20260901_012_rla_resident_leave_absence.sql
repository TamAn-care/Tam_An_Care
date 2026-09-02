BEGIN;

CREATE TABLE IF NOT EXISTS resident_leave_requests (
    leave_request_id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL REFERENCES residents(resident_id),
    leave_type TEXT NOT NULL CHECK (leave_type IN ('FAMILY_VISIT', 'MEDICAL_OUTING', 'TEMPORARY_HOSPITALIZATION', 'VACATION', 'OTHER')),
    start_date TIMESTAMPTZ NOT NULL,
    expected_end_date TIMESTAMPTZ NOT NULL,
    actual_end_date TIMESTAMPTZ,
    notice_submitted_at TIMESTAMPTZ NOT NULL,
    notice_hours NUMERIC(8,2) NOT NULL,
    is_advance_notice_48h BOOLEAN NOT NULL,
    first_day_chargeable BOOLEAN NOT NULL,
    subsequent_days_confirmed BOOLEAN NOT NULL DEFAULT false,
    meal_deduction_eligible BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL CHECK (status IN ('REGISTERED', 'ACTIVE_LEAVE', 'RETURNED', 'CANCELLED')),
    reported_by TEXT NOT NULL,
    reporter_relationship TEXT NOT NULL,
    recorded_by TEXT NOT NULL REFERENCES staff_actors(actor_id),
    recorded_by_role TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resident_leave_date_order CHECK (expected_end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_resident_leave_resident_start
  ON resident_leave_requests(resident_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_resident_leave_status
  ON resident_leave_requests(status);

CREATE INDEX IF NOT EXISTS idx_resident_leave_notice
  ON resident_leave_requests(notice_submitted_at DESC);

CREATE TABLE IF NOT EXISTS resident_leave_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id TEXT NOT NULL REFERENCES resident_leave_requests(leave_request_id),
    resident_id TEXT NOT NULL REFERENCES residents(resident_id),
    event_type TEXT NOT NULL CHECK (event_type IN ('LEAVE_REGISTERED', 'LEAVE_STARTED', 'LEAVE_CONFIRMED', 'LEAVE_RETURNED', 'LEAVE_CANCELLED')),
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resident_leave_audit_req
  ON resident_leave_audit(leave_request_id, created_at DESC);

COMMIT;
