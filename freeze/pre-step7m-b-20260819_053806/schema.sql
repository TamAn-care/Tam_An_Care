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


-- ============================================================
-- V7.4.3 Human Warning Review
--
-- Human decision layer between AI Early Warning
-- and operational Care Action.
--
-- CREATE_CARE_ACTION is a human decision only.
-- This table does NOT create Care Actions automatically.
-- ============================================================

CREATE TABLE IF NOT EXISTS warning_reviews (
    review_id uuid
        PRIMARY KEY DEFAULT gen_random_uuid(),

    warning_id text
        NOT NULL
        UNIQUE,

    resident_id text
        NOT NULL
        REFERENCES residents(resident_id)
        ON DELETE CASCADE,

    pattern_id text
        NOT NULL,

    decision text
        NOT NULL
        CHECK (
            decision IN (
                'NO_ACTION_REQUIRED',
                'MONITOR',
                'CREATE_CARE_ACTION',
                'ESCALATE'
            )
        ),

    reviewer_id text
        NOT NULL,

    reviewer_role text
        NOT NULL,

    care_note text,

    reviewed_at timestamptz
        NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
    idx_warning_reviews_resident
ON warning_reviews (
    resident_id,
    reviewed_at
);

CREATE INDEX IF NOT EXISTS
    idx_warning_reviews_decision
ON warning_reviews (
    decision,
    reviewed_at
);



-- ============================================================
-- V7.4.3 STEP 7L.2
-- CARE PLAN / CARE TASK DEVELOPMENT SCHEMA FOUNDATION
-- ============================================================
-- ============================================================
-- TAM AN CARE V7.4.3
-- STEP 7L.1
-- CARE PLAN / CARE TASK SCHEMA DESIGN
--
-- DESIGN ONLY
-- DO NOT EXECUTE
-- DO NOT APPLY TO DEVELOPMENT DATABASE YET
-- ============================================================

CREATE TABLE care_plans (
    care_plan_id TEXT PRIMARY KEY,

    resident_id TEXT NOT NULL
        REFERENCES residents(resident_id),

    plan_code TEXT NOT NULL UNIQUE,

    title TEXT NOT NULL,

    description TEXT,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'SUSPENDED',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    effective_from TIMESTAMPTZ,

    effective_to TIMESTAMPTZ,

    created_by TEXT NOT NULL,

    created_by_role TEXT NOT NULL,

    approved_by TEXT,

    approved_by_role TEXT,

    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    CHECK (
        effective_to IS NULL
        OR effective_from IS NULL
        OR effective_to >= effective_from
    )
);


CREATE TABLE care_tasks (
    care_task_id TEXT PRIMARY KEY,

    care_plan_id TEXT NOT NULL
        REFERENCES care_plans(care_plan_id),

    resident_id TEXT NOT NULL
        REFERENCES residents(resident_id),

    task_code TEXT NOT NULL UNIQUE,

    title TEXT NOT NULL,

    description TEXT,

    task_category TEXT NOT NULL,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'PLANNED',
                'ASSIGNED',
                'IN_PROGRESS',
                'COMPLETED',
                'MISSED',
                'SKIPPED',
                'CANCELLED'
            )
        ),

    priority TEXT NOT NULL
        CHECK (
            priority IN (
                'LOW',
                'MODERATE',
                'HIGH'
            )
        ),

    scheduled_at TIMESTAMPTZ,

    due_at TIMESTAMPTZ,

    recurrence_rule TEXT,

    assigned_to TEXT,

    assigned_role TEXT,

    assigned_at TIMESTAMPTZ,

    accepted_at TIMESTAMPTZ,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    missed_at TIMESTAMPTZ,

    skipped_at TIMESTAMPTZ,

    cancelled_at TIMESTAMPTZ,

    completion_note TEXT,

    exception_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    CHECK (
        due_at IS NULL
        OR scheduled_at IS NULL
        OR due_at >= scheduled_at
    ),

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
    )
);


CREATE TABLE care_plan_audit (
    audit_id TEXT PRIMARY KEY,

    event_sequence BIGINT NOT NULL,

    care_plan_id TEXT NOT NULL
        REFERENCES care_plans(care_plan_id),

    resident_id TEXT NOT NULL
        REFERENCES residents(resident_id),

    event_type TEXT NOT NULL
        CHECK (
            event_type IN (
                'PLAN_CREATED',
                'PLAN_ACTIVATED',
                'PLAN_SUSPENDED',
                'PLAN_REACTIVATED',
                'PLAN_COMPLETED',
                'PLAN_CANCELLED',
                'PLAN_UPDATED'
            )
        ),

    actor_id TEXT,

    actor_role TEXT,

    previous_state JSONB,

    new_state JSONB,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    UNIQUE (
        care_plan_id,
        event_sequence
    )
);


CREATE TABLE care_task_audit (
    audit_id TEXT PRIMARY KEY,

    event_sequence BIGINT NOT NULL,

    care_task_id TEXT NOT NULL
        REFERENCES care_tasks(care_task_id),

    care_plan_id TEXT NOT NULL
        REFERENCES care_plans(care_plan_id),

    resident_id TEXT NOT NULL
        REFERENCES residents(resident_id),

    event_type TEXT NOT NULL
        CHECK (
            event_type IN (
                'TASK_CREATED',
                'TASK_ASSIGNED',
                'TASK_ACCEPTED', 'TASK_REASSIGNED',
                'TASK_STARTED',
                'TASK_COMPLETED',
                'TASK_MISSED',
                'TASK_SKIPPED',
                'TASK_CANCELLED'
            )
        ),

    actor_id TEXT,

    actor_role TEXT,

    previous_state JSONB,

    new_state JSONB,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT now(),

    UNIQUE (
        care_task_id,
        event_sequence
    )
);


CREATE INDEX idx_care_plans_resident
    ON care_plans(resident_id);


CREATE INDEX idx_care_plans_resident_status
    ON care_plans(
        resident_id,
        status
    );


CREATE INDEX idx_care_tasks_plan
    ON care_tasks(care_plan_id);


CREATE INDEX idx_care_tasks_resident
    ON care_tasks(resident_id);


CREATE INDEX idx_care_tasks_status
    ON care_tasks(status);


CREATE INDEX idx_care_tasks_assigned_to_status
    ON care_tasks(
        assigned_to,
        status
    );


CREATE INDEX idx_care_tasks_due_at
    ON care_tasks(due_at);


CREATE INDEX idx_care_tasks_resident_status_due
    ON care_tasks(
        resident_id,
        status,
        due_at
    );


CREATE INDEX idx_care_plan_audit_plan_sequence
    ON care_plan_audit(
        care_plan_id,
        event_sequence
    );


CREATE INDEX idx_care_task_audit_task_sequence
    ON care_task_audit(
        care_task_id,
        event_sequence
    );


-- ============================================================
-- IMPORTANT
--
-- THIS FILE IS A DESIGN ARTIFACT.
--
-- STEP 7L.1 MUST NOT EXECUTE THIS SQL.
--
-- FUTURE STEP MUST:
--
-- 1. BACKUP DEVELOPMENT SCHEMA
-- 2. VALIDATE DDL IN ROLLBACK TRANSACTION
-- 3. VERIFY ZERO PRODUCTION CHANGE
-- 4. APPLY TO DEVELOPMENT ONLY
-- 5. VERIFY TABLES + CONSTRAINTS
-- ============================================================
