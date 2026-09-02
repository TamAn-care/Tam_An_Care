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
                'TASK_REASSIGNED',
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
