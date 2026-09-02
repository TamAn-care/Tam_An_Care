BEGIN;

CREATE TABLE IF NOT EXISTS shift_swap_requests (
    swap_request_id TEXT PRIMARY KEY,
    requester_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
    original_shift_id TEXT NOT NULL REFERENCES shift_assignments(shift_id),
    target_actor_id TEXT REFERENCES staff_actors(actor_id),
    target_shift_id TEXT REFERENCES shift_assignments(shift_id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by TEXT REFERENCES staff_actors(actor_id),
    approved_by_role TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_swap_requester
    ON shift_swap_requests(requester_actor_id, status);

CREATE INDEX IF NOT EXISTS idx_shift_swap_original
    ON shift_swap_requests(original_shift_id);

CREATE TABLE IF NOT EXISTS staff_recognitions (
    recognition_id TEXT PRIMARY KEY,
    staff_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
    recognition_type TEXT NOT NULL CHECK (recognition_type IN ('COMMENDATION', 'SPECIAL_ACHIEVEMENT', 'EFFORT_RECOGNITION', 'DISCIPLINE_WARNING', 'SAFETY_AWARD')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    kpi_bonus_points INT NOT NULL DEFAULT 0,
    awarded_by TEXT NOT NULL REFERENCES staff_actors(actor_id),
    awarded_by_role TEXT NOT NULL,
    awarded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_recog_actor
    ON staff_recognitions(staff_actor_id, awarded_date DESC);

COMMIT;
