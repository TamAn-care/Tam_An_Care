BEGIN;

CREATE TABLE IF NOT EXISTS resident_lifecycle_events (
    lifecycle_event_id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL
        REFERENCES residents(resident_id),

    event_type TEXT NOT NULL
        CHECK (event_type IN ('DISCHARGED')),

    effective_at TIMESTAMPTZ NOT NULL,

    reason TEXT NOT NULL,
    note TEXT,
    destination TEXT,

    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,

    previous_state JSONB NOT NULL,
    new_state JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_resident_lifecycle_one_discharge
ON resident_lifecycle_events(resident_id)
WHERE event_type = 'DISCHARGED';

CREATE INDEX IF NOT EXISTS
    idx_resident_lifecycle_history
ON resident_lifecycle_events(
    resident_id,
    created_at DESC
);

COMMIT;
