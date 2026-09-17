BEGIN;

CREATE TABLE IF NOT EXISTS staff_leave_requests (
    leave_id TEXT PRIMARY KEY,
    staff_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
    staff_role TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('ANNUAL', 'PERSONAL', 'SICK', 'UNPAID', 'OTHER')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    is_special_case BOOLEAN NOT NULL DEFAULT false,
    special_reason TEXT,
    notice_hours NUMERIC(8,2) NOT NULL,
    is_advance_notice_48h BOOLEAN NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by TEXT REFERENCES staff_actors(actor_id),
    reviewed_by_role TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_leave_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_actor
    ON staff_leave_requests(staff_actor_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_leave_status
    ON staff_leave_requests(status);

CREATE INDEX IF NOT EXISTS idx_staff_leave_created
    ON staff_leave_requests(created_at DESC);

COMMIT;
