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

-- ===== V7.4.3 STEP 7M.B MEDICATION / MAR =====
CREATE TABLE medication_orders (
  medication_order_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  order_code TEXT NOT NULL UNIQUE,

  medication_name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT,

  dose NUMERIC,
  dose_unit TEXT,
  route TEXT NOT NULL,
  frequency TEXT NOT NULL,
  instructions TEXT,
  indication TEXT,

  prescriber_name TEXT NOT NULL,
  prescriber_reference TEXT,
  prescribed_at TIMESTAMPTZ NOT NULL,

  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,

  high_risk BOOLEAN NOT NULL DEFAULT FALSE,
  double_check_required BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'DRAFT',
        'VERIFIED',
        'ACTIVE',
        'SUSPENDED',
        'COMPLETED',
        'CANCELLED'
      )
    ),

  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  ),

  CHECK (
    (
      verified_by IS NULL
      AND verified_by_role IS NULL
      AND verified_at IS NULL
    )
    OR
    (
      verified_by IS NOT NULL
      AND verified_by_role IS NOT NULL
      AND verified_at IS NOT NULL
    )
  )
);


CREATE TABLE medication_schedules (
  medication_schedule_id TEXT PRIMARY KEY,

  medication_order_id TEXT NOT NULL
    REFERENCES medication_orders(medication_order_id),

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  schedule_code TEXT NOT NULL UNIQUE,

  scheduled_at TIMESTAMPTZ NOT NULL,
  administration_window_start TIMESTAMPTZ,
  administration_window_end TIMESTAMPTZ,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'PLANNED',
        'ACTIVE',
        'SUSPENDED',
        'COMPLETED',
        'CANCELLED'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    administration_window_end IS NULL
    OR administration_window_start IS NULL
    OR administration_window_end >= administration_window_start
  )
);


CREATE TABLE medication_administrations (
  medication_administration_id TEXT PRIMARY KEY,

  medication_schedule_id TEXT NOT NULL
    REFERENCES medication_schedules(medication_schedule_id),

  medication_order_id TEXT NOT NULL
    REFERENCES medication_orders(medication_order_id),

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  administration_code TEXT NOT NULL UNIQUE,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'SCHEDULED',
        'ASSIGNED',
        'ACCEPTED',
        'READY',
        'ADMINISTERED',
        'MISSED',
        'REFUSED',
        'HELD',
        'CANCELLED'
      )
    ),

  scheduled_at TIMESTAMPTZ NOT NULL,

  assigned_to TEXT,
  assigned_role TEXT,
  assigned_at TIMESTAMPTZ,

  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,

  administered_at TIMESTAMPTZ,
  missed_at TIMESTAMPTZ,
  refused_at TIMESTAMPTZ,
  held_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  administration_note TEXT,
  exception_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

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


CREATE TABLE medication_double_checks (
  double_check_id TEXT PRIMARY KEY,

  medication_administration_id TEXT NOT NULL
    REFERENCES medication_administrations(
      medication_administration_id
    ),

  medication_order_id TEXT NOT NULL
    REFERENCES medication_orders(medication_order_id),

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  checker_id TEXT NOT NULL,
  checker_role TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,

  result TEXT NOT NULL
    CHECK (result IN ('PASSED','FAILED')),

  check_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (
    medication_administration_id,
    checker_id
  )
);


CREATE TABLE medication_audit (
  audit_id TEXT PRIMARY KEY,
  event_sequence BIGINT NOT NULL,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  medication_order_id TEXT
    REFERENCES medication_orders(medication_order_id),

  medication_schedule_id TEXT
    REFERENCES medication_schedules(medication_schedule_id),

  medication_administration_id TEXT
    REFERENCES medication_administrations(
      medication_administration_id
    ),

  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'MED_ORDER_CREATED',
        'MED_ORDER_VERIFIED',
        'MED_ORDER_ACTIVATED',
        'MED_ORDER_SUSPENDED',
        'MED_ORDER_REACTIVATED',
        'MED_ORDER_COMPLETED',
        'MED_ORDER_CANCELLED',

        'MED_SCHEDULE_CREATED',
        'MED_SCHEDULE_ACTIVATED',
        'MED_SCHEDULE_SUSPENDED',
        'MED_SCHEDULE_COMPLETED',
        'MED_SCHEDULE_CANCELLED',

        'MED_ADMIN_CREATED',
        'MED_ADMIN_ASSIGNED',
        'MED_ADMIN_ACCEPTED',
        'MED_ADMIN_READY',
        'MED_ADMIN_DOUBLE_CHECKED',
        'MED_ADMINISTERED',
        'MED_ADMIN_MISSED',
        'MED_ADMIN_REFUSED',
        'MED_ADMIN_HELD',
        'MED_ADMIN_CANCELLED'
      )
    ),

  actor_id TEXT,
  actor_role TEXT,

  previous_state JSONB,
  new_state JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (
    medication_administration_id,
    event_sequence
  )
);


CREATE INDEX idx_med_orders_resident
  ON medication_orders(resident_id);

CREATE INDEX idx_med_orders_resident_status
  ON medication_orders(resident_id,status);

CREATE INDEX idx_med_schedules_order
  ON medication_schedules(medication_order_id);

CREATE INDEX idx_med_schedules_resident_time
  ON medication_schedules(resident_id,scheduled_at);

CREATE INDEX idx_med_admin_schedule
  ON medication_administrations(medication_schedule_id);

CREATE INDEX idx_med_admin_resident_status
  ON medication_administrations(resident_id,status);

CREATE INDEX idx_med_admin_assigned_status
  ON medication_administrations(assigned_to,status);

CREATE INDEX idx_med_admin_scheduled
  ON medication_administrations(scheduled_at);

CREATE INDEX idx_med_double_admin
  ON medication_double_checks(medication_administration_id);

CREATE INDEX idx_med_audit_admin_sequence
  ON medication_audit(
    medication_administration_id,
    event_sequence
  );

CREATE INDEX idx_med_audit_order
  ON medication_audit(medication_order_id);

CREATE INDEX idx_med_audit_resident
  ON medication_audit(resident_id);

-- ===== V7.4.3 STEP 7N.B CLINICAL OBSERVATION =====
CREATE TABLE clinical_observations (
  clinical_observation_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  observation_code TEXT NOT NULL UNIQUE,

  observation_type TEXT NOT NULL,

  numeric_value NUMERIC,
  text_value TEXT,
  unit TEXT,

  measured_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  measurement_source TEXT,
  device_reference TEXT,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'RECORDED',
        'VERIFIED',
        'AMENDED',
        'VOIDED'
      )
    ),

  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,

  threshold_profile_reference TEXT,

  abnormal_flag BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    numeric_value IS NOT NULL
    OR NULLIF(trim(text_value), '') IS NOT NULL
  ),

  CHECK (
    (
      verified_by IS NULL
      AND verified_by_role IS NULL
      AND verified_at IS NULL
    )
    OR
    (
      verified_by IS NOT NULL
      AND verified_by_role IS NOT NULL
      AND verified_at IS NOT NULL
    )
  )
);


CREATE TABLE clinical_observation_amendments (
  amendment_id TEXT PRIMARY KEY,

  clinical_observation_id TEXT NOT NULL
    REFERENCES clinical_observations(
      clinical_observation_id
    ),

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  amendment_reason TEXT NOT NULL,

  previous_value JSONB NOT NULL,
  corrected_value JSONB NOT NULL,

  amended_by TEXT NOT NULL,
  amended_by_role TEXT NOT NULL,
  amended_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE nursing_notes (
  nursing_note_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  note_code TEXT NOT NULL UNIQUE,

  note_type TEXT NOT NULL,
  note_text TEXT NOT NULL,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'DRAFT',
        'SIGNED',
        'AMENDED',
        'VOIDED'
      )
    ),

  authored_by TEXT NOT NULL,
  authored_by_role TEXT NOT NULL,
  authored_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  signed_by TEXT,
  signed_by_role TEXT,
  signed_at TIMESTAMPTZ,

  supersedes_note_id TEXT
    REFERENCES nursing_notes(nursing_note_id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    (
      signed_by IS NULL
      AND signed_by_role IS NULL
      AND signed_at IS NULL
    )
    OR
    (
      signed_by IS NOT NULL
      AND signed_by_role IS NOT NULL
      AND signed_at IS NOT NULL
    )
  )
);


CREATE TABLE abnormal_findings (
  abnormal_finding_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  clinical_observation_id TEXT NOT NULL
    REFERENCES clinical_observations(
      clinical_observation_id
    ),

  finding_code TEXT NOT NULL UNIQUE,
  finding_type TEXT NOT NULL,

  severity TEXT NOT NULL
    CHECK (
      severity IN (
        'LOW',
        'MODERATE',
        'HIGH'
      )
    ),

  status TEXT NOT NULL
    CHECK (
      status IN (
        'OPEN',
        'ACKNOWLEDGED',
        'UNDER_REVIEW',
        'ESCALATED',
        'CLOSED'
      )
    ),

  detected_source TEXT NOT NULL,
  threshold_profile_reference TEXT,

  finding_summary TEXT NOT NULL,

  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  acknowledged_by TEXT,
  acknowledged_by_role TEXT,
  acknowledged_at TIMESTAMPTZ,

  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,

  review_outcome TEXT,

  closed_by TEXT,
  closed_by_role TEXT,
  closed_at TIMESTAMPTZ,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE clinical_escalations (
  clinical_escalation_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  abnormal_finding_id TEXT NOT NULL
    REFERENCES abnormal_findings(
      abnormal_finding_id
    ),

  escalation_code TEXT NOT NULL UNIQUE,

  escalation_reason TEXT NOT NULL,

  status TEXT NOT NULL
    CHECK (
      status IN (
        'OPEN',
        'ASSIGNED',
        'ACCEPTED',
        'RESOLVED',
        'CANCELLED'
      )
    ),

  escalated_by TEXT NOT NULL,
  escalated_by_role TEXT NOT NULL,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  assigned_reviewer TEXT,
  assigned_reviewer_role TEXT,
  assigned_at TIMESTAMPTZ,

  accepted_at TIMESTAMPTZ,

  resolution_summary TEXT,

  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,

  linked_care_action_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    (
      assigned_reviewer IS NULL
      AND assigned_reviewer_role IS NULL
      AND assigned_at IS NULL
    )
    OR
    (
      assigned_reviewer IS NOT NULL
      AND assigned_reviewer_role IS NOT NULL
      AND assigned_at IS NOT NULL
    )
  )
);


CREATE TABLE clinical_audit (
  audit_id TEXT PRIMARY KEY,

  event_sequence BIGINT NOT NULL,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  clinical_observation_id TEXT
    REFERENCES clinical_observations(
      clinical_observation_id
    ),

  nursing_note_id TEXT
    REFERENCES nursing_notes(nursing_note_id),

  abnormal_finding_id TEXT
    REFERENCES abnormal_findings(
      abnormal_finding_id
    ),

  clinical_escalation_id TEXT
    REFERENCES clinical_escalations(
      clinical_escalation_id
    ),

  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'OBSERVATION_RECORDED',
        'OBSERVATION_VERIFIED',
        'OBSERVATION_AMENDED',
        'OBSERVATION_VOIDED',

        'NURSING_NOTE_CREATED',
        'NURSING_NOTE_SIGNED',
        'NURSING_NOTE_AMENDED',
        'NURSING_NOTE_VOIDED',

        'ABNORMAL_FINDING_OPENED',
        'ABNORMAL_FINDING_ACKNOWLEDGED',
        'ABNORMAL_FINDING_REVIEW_STARTED',
        'ABNORMAL_FINDING_ESCALATED',
        'ABNORMAL_FINDING_CLOSED',

        'CLINICAL_ESCALATION_CREATED',
        'CLINICAL_ESCALATION_ASSIGNED',
        'CLINICAL_ESCALATION_ACCEPTED',
        'CLINICAL_ESCALATION_RESOLVED',
        'CLINICAL_ESCALATION_CANCELLED',

        'CARE_ACTION_LINKED'
      )
    ),

  actor_id TEXT,
  actor_role TEXT,

  previous_state JSONB,
  new_state JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX idx_clinical_observation_resident
  ON clinical_observations(resident_id);

CREATE INDEX idx_clinical_observation_resident_type_time
  ON clinical_observations(
    resident_id,
    observation_type,
    measured_at
  );

CREATE INDEX idx_clinical_observation_status
  ON clinical_observations(status);

CREATE INDEX idx_clinical_observation_abnormal
  ON clinical_observations(
    resident_id,
    abnormal_flag
  );

CREATE INDEX idx_clinical_amendment_observation
  ON clinical_observation_amendments(
    clinical_observation_id
  );

CREATE INDEX idx_nursing_note_resident
  ON nursing_notes(resident_id);

CREATE INDEX idx_nursing_note_resident_status
  ON nursing_notes(
    resident_id,
    status
  );

CREATE INDEX idx_abnormal_finding_resident_status
  ON abnormal_findings(
    resident_id,
    status
  );

CREATE INDEX idx_abnormal_finding_observation
  ON abnormal_findings(
    clinical_observation_id
  );

CREATE INDEX idx_clinical_escalation_finding
  ON clinical_escalations(
    abnormal_finding_id
  );

CREATE INDEX idx_clinical_escalation_status
  ON clinical_escalations(status);

CREATE INDEX idx_clinical_audit_observation
  ON clinical_audit(
    clinical_observation_id,
    event_sequence
  );

CREATE INDEX idx_clinical_audit_finding
  ON clinical_audit(
    abnormal_finding_id,
    event_sequence
  );

CREATE INDEX idx_clinical_audit_escalation
  ON clinical_audit(
    clinical_escalation_id,
    event_sequence
  );

CREATE INDEX idx_clinical_audit_resident
  ON clinical_audit(resident_id);
