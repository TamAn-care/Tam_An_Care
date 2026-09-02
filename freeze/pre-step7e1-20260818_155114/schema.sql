CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS ai_analysis_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id text NOT NULL, engine_id text NOT NULL, subject_id text, risk_class text NOT NULL, result_status text NOT NULL, created_at timestamptz DEFAULT now());
-- ============================================================
-- TÂM AN CARE V7.4.2
-- PERSISTENT CARE ACTION WORKFLOW
-- ============================================================

CREATE TABLE IF NOT EXISTS care_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    resident_id text NOT NULL,
    pattern_id text NOT NULL,

    status text NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'IN_REVIEW',
                'RESOLVED'
            )
        ),

    assigned_to text,
    assigned_role text,
    assigned_at timestamptz,

    priority text
        CHECK (
            priority IS NULL
            OR priority IN (
                'HIGH',
                'MODERATE',
                'LOW'
            )
        ),

    due_at timestamptz,

    review_started_at timestamptz,

    resolved_at timestamptz,
    resolution_reason text,
    resolution_note text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT care_actions_resident_pattern_unique
        UNIQUE (resident_id, pattern_id),

    CONSTRAINT care_actions_assignment_consistency
        CHECK (
            (
                assigned_to IS NULL
                AND assigned_role IS NULL
                AND assigned_at IS NULL
            )
            OR
            (
                assigned_to IS NOT NULL
                AND assigned_role IS NOT NULL
                AND assigned_at IS NOT NULL
            )
        ),

    CONSTRAINT care_actions_resolution_consistency
        CHECK (
            status <> 'RESOLVED'
            OR resolved_at IS NOT NULL
        )
);


CREATE INDEX IF NOT EXISTS
    idx_care_actions_resident
ON care_actions (resident_id);


CREATE INDEX IF NOT EXISTS
    idx_care_actions_status
ON care_actions (status);


CREATE INDEX IF NOT EXISTS
    idx_care_actions_priority
ON care_actions (priority);


CREATE INDEX IF NOT EXISTS
    idx_care_actions_due_at
ON care_actions (due_at)
WHERE due_at IS NOT NULL;


-- ------------------------------------------------------------
-- Assignment / transfer history.
--
-- Append-only accountability record.
-- Initial assignment is recorded as ASSIGNMENT.
-- Subsequent reassignment is recorded as TRANSFER.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS care_action_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_sequence bigint
        GENERATED ALWAYS AS IDENTITY
        UNIQUE,

    care_action_id uuid NOT NULL
        REFERENCES care_actions(id)
        ON DELETE CASCADE,

    event_type text NOT NULL
        CHECK (
            event_type IN (
                'ASSIGNMENT',
                'TRANSFER'
            )
        ),

    from_assigned_to text,
    from_assigned_role text,

    to_assigned_to text NOT NULL,
    to_assigned_role text NOT NULL,

    priority text
        CHECK (
            priority IS NULL
            OR priority IN (
                'HIGH',
                'MODERATE',
                'LOW'
            )
        ),

    due_at timestamptz,

    transferred_at timestamptz
        NOT NULL DEFAULT now(),

    actor_id text,
    actor_role text,

    created_at timestamptz
        NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_care_action_transfers_action
ON care_action_transfers (
    care_action_id,
    transferred_at
);


-- ------------------------------------------------------------
-- Workflow audit trail.
--
-- This records human workflow events.
-- It does NOT represent autonomous clinical authorization.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS care_action_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_sequence bigint
        GENERATED ALWAYS AS IDENTITY
        UNIQUE,

    care_action_id uuid NOT NULL
        REFERENCES care_actions(id)
        ON DELETE CASCADE,

    resident_id text NOT NULL,
    pattern_id text NOT NULL,

    event_type text NOT NULL,

    actor_id text,
    actor_role text,

    previous_state jsonb,
    new_state jsonb,

    created_at timestamptz
        NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_care_action_audit_action
ON care_action_audit (
    care_action_id,
    created_at
);


CREATE INDEX IF NOT EXISTS
    idx_care_action_audit_resident
ON care_action_audit (
    resident_id,
    created_at
);


-- ============================================================
-- V7.4.3 Resident Context
-- Operational identity/context only.
-- This is NOT a full electronic medical record.
-- ============================================================

CREATE TABLE IF NOT EXISTS residents (
    resident_id text PRIMARY KEY,

    resident_code text
        NOT NULL
        UNIQUE,

    display_name text
        NOT NULL,

    date_of_birth date
        NOT NULL,

    gender text
        NOT NULL
        CHECK (
            gender IN (
                'MALE',
                'FEMALE',
                'OTHER',
                'UNSPECIFIED'
            )
        ),

    room text,
    bed text,

    care_level text
        NOT NULL
        CHECK (
            care_level IN (
                'INDEPENDENT',
                'ASSISTED',
                'HIGH_ASSISTANCE',
                'DEPENDENT'
            )
        ),

    active_status boolean
        NOT NULL DEFAULT true,

    created_at timestamptz
        NOT NULL DEFAULT now(),

    updated_at timestamptz
        NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
    idx_residents_active_status
ON residents (
    active_status
);

CREATE INDEX IF NOT EXISTS
    idx_residents_room_bed
ON residents (
    room,
    bed
);

