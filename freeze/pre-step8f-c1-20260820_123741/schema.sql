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

-- ===== V7.4.3 STEP 7O.B INCIDENT MANAGEMENT =====

CREATE TABLE incidents (
  incident_id text PRIMARY KEY,
  resident_id text NULL REFERENCES residents(resident_id),
  incident_code text NOT NULL UNIQUE,
  incident_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  occurred_at timestamptz NULL,
  discovered_at timestamptz NOT NULL,
  location text NULL,
  status text NOT NULL,
  reported_by text NOT NULL,
  reported_by_role text NOT NULL,
  reported_at timestamptz NOT NULL,
  current_severity text NULL,
  assigned_to text NULL,
  assigned_role text NULL,
  assigned_at timestamptz NULL,
  acknowledged_at timestamptz NULL,
  response_started_at timestamptz NULL,
  resolved_at timestamptz NULL,
  closed_at timestamptz NULL,
  resolution_summary text NULL,
  linked_care_action_id uuid NULL REFERENCES care_actions(id),
  linked_care_task_id text NULL REFERENCES care_tasks(care_task_id),
  linked_clinical_observation_id text NULL
    REFERENCES clinical_observations(clinical_observation_id),
  linked_medication_administration_id text NULL
    REFERENCES medication_administrations(medication_administration_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (
    incident_type IN (
      'FALL',
      'SUSPECTED_FALL',
      'MEDICAL_EMERGENCY',
      'INJURY',
      'NEAR_MISS',
      'BEHAVIORAL_SAFETY',
      'ENVIRONMENTAL_SAFETY',
      'FACILITY_SAFETY',
      'MEDICATION_RELATED_INCIDENT',
      'OTHER'
    )
  ),

  CHECK (
    status IN (
      'REPORTED',
      'TRIAGED',
      'ASSIGNED',
      'ACKNOWLEDGED',
      'RESPONDING',
      'ESCALATED',
      'RESOLVED',
      'CLOSED',
      'VOIDED'
    )
  ),

  CHECK (
    current_severity IS NULL
    OR current_severity IN (
      'LOW',
      'MODERATE',
      'HIGH',
      'CRITICAL'
    )
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

CREATE TABLE incident_triage (
  incident_triage_id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(incident_id),
  resident_id text NULL REFERENCES residents(resident_id),
  triage_sequence bigint NOT NULL,
  severity text NOT NULL,
  triage_summary text NOT NULL,
  triaged_by text NOT NULL,
  triaged_by_role text NOT NULL,
  triaged_at timestamptz NOT NULL,
  previous_triage_id text NULL REFERENCES incident_triage(incident_triage_id),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (incident_id, triage_sequence),

  CHECK (
    severity IN (
      'LOW',
      'MODERATE',
      'HIGH',
      'CRITICAL'
    )
  )
);

CREATE TABLE incident_assignments (
  incident_assignment_id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(incident_id),
  assignment_sequence bigint NOT NULL,
  assigned_to text NOT NULL,
  assigned_role text NOT NULL,
  assigned_by text NOT NULL,
  assigned_by_role text NOT NULL,
  assigned_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  end_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (incident_id, assignment_sequence)
);

CREATE TABLE incident_responses (
  incident_response_id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(incident_id),
  resident_id text NULL REFERENCES residents(resident_id),
  response_sequence bigint NOT NULL,
  response_type text NOT NULL,
  response_note text NOT NULL,
  performed_by text NOT NULL,
  performed_by_role text NOT NULL,
  performed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (incident_id, response_sequence)
);

CREATE TABLE incident_escalations (
  incident_escalation_id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(incident_id),
  escalation_sequence bigint NOT NULL,
  escalation_type text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  escalated_by text NOT NULL,
  escalated_by_role text NOT NULL,
  escalated_at timestamptz NOT NULL,
  assigned_reviewer text NULL,
  assigned_reviewer_role text NULL,
  assigned_at timestamptz NULL,
  accepted_at timestamptz NULL,
  resolved_by text NULL,
  resolved_by_role text NULL,
  resolved_at timestamptz NULL,
  resolution_summary text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (incident_id, escalation_sequence),

  CHECK (
    status IN (
      'OPEN',
      'ASSIGNED',
      'ACCEPTED',
      'RESOLVED',
      'CANCELLED'
    )
  ),

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

CREATE TABLE incident_post_reviews (
  incident_post_review_id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(incident_id),
  review_sequence bigint NOT NULL,
  review_summary text NOT NULL,
  contributing_factors text NULL,
  preventive_actions text NULL,
  follow_up_required boolean NOT NULL DEFAULT false,
  reviewed_by text NOT NULL,
  reviewed_by_role text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (incident_id, review_sequence)
);

CREATE TABLE incident_audit (
  audit_id text PRIMARY KEY,
  event_sequence bigint NOT NULL,
  incident_id text NOT NULL REFERENCES incidents(incident_id),
  resident_id text NULL REFERENCES residents(resident_id),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  actor_id text NULL,
  actor_role text NULL,
  previous_state jsonb NULL,
  new_state jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (
    incident_id,
    aggregate_type,
    aggregate_id,
    event_sequence
  )
);

CREATE INDEX idx_incidents_resident
  ON incidents(resident_id);

CREATE INDEX idx_incidents_status
  ON incidents(status);

CREATE INDEX idx_incidents_type
  ON incidents(incident_type);

CREATE INDEX idx_incidents_severity
  ON incidents(current_severity);

CREATE INDEX idx_incidents_owner_status
  ON incidents(assigned_to, status);

CREATE INDEX idx_incidents_occurred
  ON incidents(occurred_at);

CREATE INDEX idx_incidents_discovered
  ON incidents(discovered_at);

CREATE INDEX idx_incident_triage_incident_sequence
  ON incident_triage(incident_id, triage_sequence);

CREATE INDEX idx_incident_assignments_incident_sequence
  ON incident_assignments(incident_id, assignment_sequence);

CREATE INDEX idx_incident_assignments_owner
  ON incident_assignments(assigned_to);

CREATE INDEX idx_incident_responses_incident_sequence
  ON incident_responses(incident_id, response_sequence);

CREATE INDEX idx_incident_responses_performed
  ON incident_responses(performed_at);

CREATE INDEX idx_incident_escalations_incident
  ON incident_escalations(incident_id);

CREATE INDEX idx_incident_escalations_status
  ON incident_escalations(status);

CREATE INDEX idx_incident_escalations_reviewer_status
  ON incident_escalations(assigned_reviewer, status);

CREATE INDEX idx_incident_post_reviews_incident_sequence
  ON incident_post_reviews(incident_id, review_sequence);

CREATE INDEX idx_incident_audit_incident_created
  ON incident_audit(incident_id, created_at);

CREATE INDEX idx_incident_audit_aggregate_sequence
  ON incident_audit(aggregate_type, aggregate_id, event_sequence);

-- ===== END V7.4.3 STEP 7O.B INCIDENT MANAGEMENT =====

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7P CANONICAL SCHEMA
-- ============================================================
CREATE TABLE nutrition_plans (
  nutrition_plan_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  plan_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','ACTIVE','SUSPENDED','COMPLETED','CANCELLED'
    )),
  hydration_monitoring_required BOOLEAN NOT NULL DEFAULT FALSE,
  feeding_assistance_required BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  approved_by TEXT,
  approved_by_role TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    effective_to IS NULL OR
    effective_from IS NULL OR
    effective_to >= effective_from
  )
);

CREATE TABLE diet_orders (
  diet_order_id TEXT PRIMARY KEY,
  nutrition_plan_id TEXT NOT NULL REFERENCES nutrition_plans(nutrition_plan_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  diet_code TEXT NOT NULL UNIQUE,
  diet_type TEXT NOT NULL,
  texture_requirement TEXT,
  fluid_consistency TEXT,
  allergy_information TEXT,
  intolerance_information TEXT,
  restriction_information TEXT,
  fluid_restriction_active BOOLEAN NOT NULL DEFAULT FALSE,
  fluid_restriction_details TEXT,
  swallowing_restriction_present BOOLEAN NOT NULL DEFAULT FALSE,
  safety_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  safety_confirmed_by TEXT,
  safety_confirmed_by_role TEXT,
  safety_confirmed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','ACTIVE','SUSPENDED','DISCONTINUED'
    )),
  ordered_by TEXT NOT NULL,
  ordered_by_role TEXT NOT NULL,
  approved_by TEXT,
  approved_by_role TEXT,
  approved_at TIMESTAMPTZ,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    effective_to IS NULL OR
    effective_from IS NULL OR
    effective_to >= effective_from
  )
);

CREATE TABLE meal_schedules (
  meal_schedule_id TEXT PRIMARY KEY,
  nutrition_plan_id TEXT NOT NULL REFERENCES nutrition_plans(nutrition_plan_id),
  diet_order_id TEXT NOT NULL REFERENCES diet_orders(diet_order_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  schedule_code TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK',
      'DINNER','EVENING_SNACK','HYDRATION','OTHER'
    )),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN (
      'SCHEDULED','ASSIGNED','ACCEPTED','READY',
      'COMPLETED','MISSED','REFUSED','HELD','CANCELLED'
    )),
  assigned_to TEXT,
  assigned_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  missed_at TIMESTAMPTZ,
  refused_at TIMESTAMPTZ,
  held_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  exception_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (
      assigned_to IS NULL AND
      assigned_role IS NULL AND
      assigned_at IS NULL
    )
    OR
    (
      assigned_to IS NOT NULL AND
      assigned_role IS NOT NULL AND
      assigned_at IS NOT NULL
    )
  )
);

CREATE TABLE nutrition_intake_records (
  intake_record_id TEXT PRIMARY KEY,
  meal_schedule_id TEXT NOT NULL REFERENCES meal_schedules(meal_schedule_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  intake_type TEXT NOT NULL
    CHECK (intake_type IN ('MEAL','FLUID','SUPPLEMENT','OTHER')),
  food_intake_percent INTEGER,
  fluid_amount_ml INTEGER,
  intake_note TEXT,
  record_status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (record_status IN (
      'RECORDED','VERIFIED','AMENDED','VOIDED'
    )),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amends_record_id TEXT REFERENCES nutrition_intake_records(intake_record_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    food_intake_percent IS NULL OR
    (food_intake_percent >= 0 AND food_intake_percent <= 100)
  ),
  CHECK (
    fluid_amount_ml IS NULL OR fluid_amount_ml >= 0
  )
);

CREATE TABLE feeding_assistance (
  feeding_assistance_id TEXT PRIMARY KEY,
  meal_schedule_id TEXT NOT NULL REFERENCES meal_schedules(meal_schedule_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  assistance_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN (
      'PLANNED','ASSIGNED','ACCEPTED','IN_PROGRESS',
      'COMPLETED','SKIPPED','CANCELLED'
    )),
  assigned_to TEXT,
  assigned_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  assistance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nutrition_alerts (
  nutrition_alert_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  meal_schedule_id TEXT REFERENCES meal_schedules(meal_schedule_id),
  alert_type TEXT NOT NULL
    CHECK (alert_type IN (
      'LOW_INTAKE',
      'LOW_FLUID_INTAKE',
      'REPEATED_REFUSAL',
      'REPEATED_MISSED_INTAKE',
      'WEIGHT_TREND_CONCERN',
      'DIET_CONFLICT',
      'ALLERGY_CONFLICT',
      'OTHER'
    )),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('HUMAN','AI_ALERT')),
  severity TEXT NOT NULL
    CHECK (severity IN ('LOW','MODERATE','HIGH')),
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN','ACKNOWLEDGED','ESCALATED','RESOLVED','DISMISSED'
    )),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by TEXT,
  acknowledged_by_role TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE TABLE nutrition_escalations (
  nutrition_escalation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  nutrition_alert_id TEXT NOT NULL REFERENCES nutrition_alerts(nutrition_alert_id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN','ASSIGNED','ACCEPTED','RESOLVED','CANCELLED'
    )),
  escalated_by TEXT NOT NULL,
  escalated_by_role TEXT NOT NULL,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_reviewer TEXT,
  assigned_reviewer_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nutrition_audit (
  audit_id TEXT PRIMARY KEY,
  event_sequence BIGINT NOT NULL,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_role TEXT,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_type, aggregate_id, event_sequence)
);

CREATE INDEX idx_nutrition_plans_resident
  ON nutrition_plans(resident_id);

CREATE INDEX idx_nutrition_plans_status
  ON nutrition_plans(status);

CREATE INDEX idx_diet_orders_resident_status
  ON diet_orders(resident_id,status);

CREATE INDEX idx_meal_schedules_resident_status
  ON meal_schedules(resident_id,status);

CREATE INDEX idx_meal_schedules_assigned
  ON meal_schedules(assigned_to,status);

CREATE INDEX idx_nutrition_intake_meal
  ON nutrition_intake_records(meal_schedule_id);

CREATE INDEX idx_nutrition_intake_resident
  ON nutrition_intake_records(resident_id);

CREATE INDEX idx_feeding_assistance_meal
  ON feeding_assistance(meal_schedule_id);

CREATE INDEX idx_nutrition_alerts_resident_status
  ON nutrition_alerts(resident_id,status);

CREATE INDEX idx_nutrition_escalations_alert
  ON nutrition_escalations(nutrition_alert_id);

CREATE INDEX idx_nutrition_audit_aggregate
  ON nutrition_audit(aggregate_type,aggregate_id,event_sequence);


-- ============================================================
-- TAM AN CARE V7.4.3
-- STEP 7Q — ACTIVITIES / REHABILITATION / FUNCTIONAL SUPPORT
-- ============================================================

CREATE TABLE activity_programs (
    activity_program_id TEXT PRIMARY KEY,
    program_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    activity_category TEXT NOT NULL,
    default_support_level TEXT,
    default_location TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
      CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','COMPLETED','CANCELLED')),
    created_by TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    approved_by TEXT,
    approved_by_role TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rehabilitation_plans (
    rehabilitation_plan_id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    goal_summary TEXT,
    mobility_precautions TEXT,
    transfer_precautions TEXT,
    weight_bearing_restriction TEXT,
    assistive_device_requirement TEXT,
    other_safety_restrictions TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
      CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','COMPLETED','CANCELLED')),
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    approved_by TEXT,
    approved_by_role TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_sessions (
    activity_session_id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
    activity_program_id TEXT REFERENCES activity_programs(activity_program_id),
    rehabilitation_plan_id TEXT REFERENCES rehabilitation_plans(rehabilitation_plan_id),
    session_code TEXT NOT NULL UNIQUE,
    session_type TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    planned_duration_minutes INTEGER,
    support_level TEXT,
    status TEXT NOT NULL DEFAULT 'SCHEDULED'
      CHECK (
        status IN (
          'SCHEDULED',
          'ASSIGNED',
          'ACCEPTED',
          'READY',
          'IN_PROGRESS',
          'COMPLETED',
          'MISSED',
          'REFUSED',
          'HELD',
          'CANCELLED'
        )
      ),
    assigned_to TEXT,
    assigned_role TEXT,
    assigned_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    safety_checked_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    missed_at TIMESTAMPTZ,
    refused_at TIMESTAMPTZ,
    held_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completion_note TEXT,
    exception_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_participation (
    participation_id TEXT PRIMARY KEY,
    activity_session_id TEXT NOT NULL
      REFERENCES activity_sessions(activity_session_id) ON DELETE CASCADE,
    resident_id TEXT NOT NULL
      REFERENCES residents(resident_id) ON DELETE CASCADE,
    attendance_status TEXT NOT NULL,
    participation_level TEXT,
    assistance_level TEXT,
    duration_minutes INTEGER,
    resident_response TEXT,
    observation_note TEXT,
    record_status TEXT NOT NULL DEFAULT 'RECORDED'
      CHECK (record_status IN ('RECORDED','VERIFIED','AMENDED','VOIDED')),
    recorded_by TEXT NOT NULL,
    recorded_by_role TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_by TEXT,
    verified_by_role TEXT,
    verified_at TIMESTAMPTZ,
    amends_participation_id TEXT
      REFERENCES activity_participation(participation_id),
    amendment_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE functional_assessments (
    functional_assessment_id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL
      REFERENCES residents(resident_id) ON DELETE CASCADE,
    activity_session_id TEXT
      REFERENCES activity_sessions(activity_session_id) ON DELETE SET NULL,
    assessment_type TEXT NOT NULL,
    assessment_context TEXT,
    mobility_observation TEXT,
    transfer_observation TEXT,
    balance_observation TEXT,
    endurance_observation TEXT,
    functional_support_note TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
      CHECK (status IN ('DRAFT','VERIFIED','AMENDED','VOIDED')),
    created_by TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_by TEXT,
    verified_by_role TEXT,
    verified_at TIMESTAMPTZ,
    amends_assessment_id TEXT
      REFERENCES functional_assessments(functional_assessment_id),
    amendment_reason TEXT
);

CREATE TABLE functional_support_actions (
    functional_support_action_id TEXT PRIMARY KEY,
    activity_session_id TEXT NOT NULL
      REFERENCES activity_sessions(activity_session_id) ON DELETE CASCADE,
    resident_id TEXT NOT NULL
      REFERENCES residents(resident_id) ON DELETE CASCADE,
    support_type TEXT NOT NULL,
    support_description TEXT,
    status TEXT NOT NULL DEFAULT 'PLANNED'
      CHECK (
        status IN (
          'PLANNED',
          'ASSIGNED',
          'ACCEPTED',
          'IN_PROGRESS',
          'COMPLETED',
          'SKIPPED',
          'CANCELLED'
        )
      ),
    assigned_to TEXT,
    assigned_role TEXT,
    assigned_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rehabilitation_escalations (
    rehabilitation_escalation_id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL
      REFERENCES residents(resident_id) ON DELETE CASCADE,
    activity_session_id TEXT
      REFERENCES activity_sessions(activity_session_id) ON DELETE SET NULL,
    functional_assessment_id TEXT
      REFERENCES functional_assessments(functional_assessment_id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    severity TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN'
      CHECK (status IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED','CANCELLED')),
    escalated_by TEXT NOT NULL,
    escalated_by_role TEXT NOT NULL,
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_reviewer TEXT,
    assigned_reviewer_role TEXT,
    assigned_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolved_by_role TEXT,
    resolved_at TIMESTAMPTZ,
    resolution_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rehabilitation_audit (
    audit_id TEXT PRIMARY KEY,
    event_sequence BIGINT NOT NULL,
    resident_id TEXT,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (aggregate_type, aggregate_id, event_sequence)
);

CREATE INDEX idx_rehab_plan_resident
  ON rehabilitation_plans(resident_id);

CREATE INDEX idx_activity_session_resident
  ON activity_sessions(resident_id);

CREATE INDEX idx_activity_session_status
  ON activity_sessions(status);

CREATE INDEX idx_activity_session_schedule
  ON activity_sessions(scheduled_at);

CREATE INDEX idx_activity_participation_session
  ON activity_participation(activity_session_id);

CREATE INDEX idx_activity_participation_resident
  ON activity_participation(resident_id);

CREATE INDEX idx_functional_assessment_resident
  ON functional_assessments(resident_id);

CREATE INDEX idx_functional_support_session
  ON functional_support_actions(activity_session_id);

CREATE INDEX idx_rehab_escalation_resident
  ON rehabilitation_escalations(resident_id);

CREATE INDEX idx_rehab_escalation_status
  ON rehabilitation_escalations(status);

CREATE INDEX idx_rehab_audit_aggregate
  ON rehabilitation_audit(aggregate_type, aggregate_id, event_sequence);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7R
-- SKIN / WOUND / PRESSURE INJURY
-- ============================================================

CREATE TABLE skin_assessments (
  skin_assessment_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  assessment_type TEXT NOT NULL,
  assessment_context TEXT,
  skin_condition_summary TEXT,
  risk_factors JSONB,
  pressure_area_observation TEXT,
  mobility_related_risk TEXT,
  moisture_related_risk TEXT,
  nutrition_related_risk TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','VERIFIED','AMENDED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amends_assessment_id TEXT REFERENCES skin_assessments(skin_assessment_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wound_records (
  wound_record_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_skin_assessment_id TEXT REFERENCES skin_assessments(skin_assessment_id),
  wound_type TEXT NOT NULL,
  anatomical_location TEXT NOT NULL,
  human_classification TEXT,
  description TEXT,
  onset_or_discovery_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','VERIFIED','ACTIVE','RESOLVED','CLOSED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wound_care_plans (
  wound_care_plan_id TEXT PRIMARY KEY,
  wound_record_id TEXT NOT NULL REFERENCES wound_records(wound_record_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  plan_status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (plan_status IN ('DRAFT','ACTIVE','SUSPENDED','COMPLETED','CANCELLED')),
  care_goal TEXT,
  approved_treatment_instruction TEXT,
  approved_dressing_instruction TEXT,
  approved_prevention_instruction TEXT,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  approved_by TEXT,
  approved_by_role TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wound_treatment_records (
  wound_treatment_record_id TEXT PRIMARY KEY,
  wound_record_id TEXT NOT NULL REFERENCES wound_records(wound_record_id),
  wound_care_plan_id TEXT REFERENCES wound_care_plans(wound_care_plan_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  treatment_type TEXT NOT NULL,
  treatment_note TEXT,
  dressing_note TEXT,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_required BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (status IN ('RECORDED','VERIFIED','AMENDED')),
  amends_treatment_record_id TEXT
    REFERENCES wound_treatment_records(wound_treatment_record_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE repositioning_records (
  repositioning_record_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  wound_record_id TEXT REFERENCES wound_records(wound_record_id),
  scheduled_or_indicated_at TIMESTAMPTZ,
  performed_at TIMESTAMPTZ,
  position_or_action TEXT,
  support_device TEXT,
  performed_by TEXT,
  performed_by_role TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED','COMPLETED','MISSED','REFUSED','HELD','CANCELLED','AMENDED')),
  exception_reason TEXT,
  amends_repositioning_record_id TEXT
    REFERENCES repositioning_records(repositioning_record_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wound_progress_records (
  wound_progress_record_id TEXT PRIMARY KEY,
  wound_record_id TEXT NOT NULL REFERENCES wound_records(wound_record_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  observation_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  appearance_observation TEXT,
  size_observation TEXT,
  exudate_observation TEXT,
  surrounding_skin_observation TEXT,
  pain_observation TEXT,
  other_observation TEXT,
  status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (status IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amends_progress_record_id TEXT
    REFERENCES wound_progress_records(wound_progress_record_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wound_escalations (
  wound_escalation_id TEXT PRIMARY KEY,
  wound_record_id TEXT NOT NULL REFERENCES wound_records(wound_record_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  reason TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED','CANCELLED')),
  escalated_by TEXT NOT NULL,
  escalated_by_role TEXT NOT NULL,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_reviewer TEXT,
  assigned_reviewer_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wound_audit (
  audit_id TEXT PRIMARY KEY,
  event_sequence INTEGER NOT NULL,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_type, aggregate_id, event_sequence)
);

CREATE INDEX idx_skin_assessments_resident
  ON skin_assessments(resident_id);

CREATE INDEX idx_wound_records_resident
  ON wound_records(resident_id);

CREATE INDEX idx_wound_records_status
  ON wound_records(status);

CREATE INDEX idx_wound_care_plans_wound
  ON wound_care_plans(wound_record_id);

CREATE INDEX idx_wound_treatment_wound
  ON wound_treatment_records(wound_record_id);

CREATE INDEX idx_repositioning_resident
  ON repositioning_records(resident_id);

CREATE INDEX idx_wound_progress_wound
  ON wound_progress_records(wound_record_id);

CREATE INDEX idx_wound_escalations_wound
  ON wound_escalations(wound_record_id);

CREATE INDEX idx_wound_audit_aggregate
  ON wound_audit(aggregate_type,aggregate_id,event_sequence);

CREATE INDEX idx_wound_audit_resident
  ON wound_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7S
-- PERSONAL HYGIENE / BATHING / TOILETING / CONTINENCE
-- ============================================================

CREATE TABLE hygiene_care_plans (
  hygiene_care_plan_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  care_plan_type TEXT NOT NULL,
  bathing_support TEXT,
  oral_hygiene_support TEXT,
  grooming_support TEXT,
  toileting_support TEXT,
  continence_support TEXT,
  privacy_preferences TEXT,
  mobility_support_required BOOLEAN NOT NULL DEFAULT FALSE,
  transfer_support_required BOOLEAN NOT NULL DEFAULT FALSE,
  fall_precautions TEXT,
  skin_precautions TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','COMPLETED','CANCELLED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  approved_by TEXT,
  approved_by_role TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hygiene_schedules (
  hygiene_schedule_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  hygiene_care_plan_id TEXT NOT NULL
    REFERENCES hygiene_care_plans(hygiene_care_plan_id),
  care_type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (
      status IN (
        'SCHEDULED',
        'ASSIGNED',
        'ACCEPTED',
        'READY',
        'COMPLETED',
        'MISSED',
        'REFUSED',
        'HELD',
        'CANCELLED'
      )
    ),
  assigned_to TEXT,
  assigned_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  missed_at TIMESTAMPTZ,
  refused_at TIMESTAMPTZ,
  held_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  privacy_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  mobility_support_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  transfer_support_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  fall_precautions_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  exception_reason TEXT,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hygiene_care_records (
  hygiene_care_record_id TEXT PRIMARY KEY,
  hygiene_schedule_id TEXT NOT NULL
    REFERENCES hygiene_schedules(hygiene_schedule_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  care_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  care_note TEXT,
  resident_response TEXT,
  privacy_confirmed BOOLEAN NOT NULL,
  consent_confirmed BOOLEAN NOT NULL,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (status IN ('RECORDED','VERIFIED','AMENDED')),
  amends_care_record_id TEXT
    REFERENCES hygiene_care_records(hygiene_care_record_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE toileting_records (
  toileting_record_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  hygiene_schedule_id TEXT REFERENCES hygiene_schedules(hygiene_schedule_id),
  assistance_type TEXT,
  toileting_outcome TEXT,
  transfer_assistance TEXT,
  mobility_assistance TEXT,
  resident_response TEXT,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (status IN ('RECORDED','VERIFIED','AMENDED')),
  amends_toileting_record_id TEXT
    REFERENCES toileting_records(toileting_record_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE continence_observations (
  continence_observation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  observation_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observation_type TEXT NOT NULL,
  observation_note TEXT,
  continence_product_used TEXT,
  skin_observation TEXT,
  change_observed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (status IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amends_observation_id TEXT
    REFERENCES continence_observations(continence_observation_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personal_care_assistance (
  personal_care_assistance_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  hygiene_schedule_id TEXT REFERENCES hygiene_schedules(hygiene_schedule_id),
  assistance_type TEXT NOT NULL,
  assistance_level TEXT,
  mobility_support TEXT,
  transfer_support TEXT,
  equipment_used TEXT,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (status IN ('RECORDED','VERIFIED','AMENDED')),
  exception_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personal_care_escalations (
  personal_care_escalation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED','CANCELLED')),
  escalated_by TEXT NOT NULL,
  escalated_by_role TEXT NOT NULL,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_reviewer TEXT,
  assigned_reviewer_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personal_care_audit (
  audit_id TEXT PRIMARY KEY,
  event_sequence INTEGER NOT NULL,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_type, aggregate_id, event_sequence)
);

CREATE INDEX idx_hygiene_plans_resident
  ON hygiene_care_plans(resident_id);

CREATE INDEX idx_hygiene_schedules_resident
  ON hygiene_schedules(resident_id);

CREATE INDEX idx_hygiene_schedules_status
  ON hygiene_schedules(status);

CREATE INDEX idx_hygiene_records_schedule
  ON hygiene_care_records(hygiene_schedule_id);

CREATE INDEX idx_toileting_resident
  ON toileting_records(resident_id);

CREATE INDEX idx_continence_resident
  ON continence_observations(resident_id);

CREATE INDEX idx_assistance_resident
  ON personal_care_assistance(resident_id);

CREATE INDEX idx_personal_care_escalations_resident
  ON personal_care_escalations(resident_id);

CREATE INDEX idx_personal_care_audit_aggregate
  ON personal_care_audit(aggregate_type,aggregate_id,event_sequence);

CREATE INDEX idx_personal_care_audit_resident
  ON personal_care_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7T
-- BEHAVIORAL / COGNITIVE / DEMENTIA SAFETY
-- ============================================================

CREATE TABLE cognitive_observations (
  observation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  observation_type TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observable_facts TEXT NOT NULL,
  baseline_change BOOLEAN NOT NULL DEFAULT FALSE,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES cognitive_observations(observation_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE behavioral_support_plans (
  support_plan_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEWED','ACTIVE','RETIRED')),
  known_preferences TEXT,
  known_triggers TEXT,
  communication_approach TEXT,
  reassurance_strategy TEXT,
  environmental_support TEXT,
  mobility_or_activity_support TEXT,
  owner_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_role TEXT,
  reviewed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE behavioral_episodes (
  episode_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  episode_type TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  antecedent_observation TEXT,
  observable_behavior TEXT NOT NULL,
  immediate_safety_context TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (
      state IN (
        'OPEN','ASSIGNED','ACKNOWLEDGED',
        'RESPONDING','RESOLVED','REVIEWED','CLOSED'
      )
    ),
  owner_id TEXT,
  owner_role TEXT,
  assigned_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_by_role TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wandering_events (
  wandering_event_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  episode_id TEXT REFERENCES behavioral_episodes(episode_id),
  event_type TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_known_location TEXT,
  found_location TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ACKNOWLEDGED','RESPONDING','RESOLVED','CLOSED')),
  owner_id TEXT,
  owner_role TEXT,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE behavioral_responses (
  response_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  episode_id TEXT NOT NULL REFERENCES behavioral_episodes(episode_id),
  response_type TEXT NOT NULL,
  response_notes TEXT,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE behavioral_escalations (
  escalation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  episode_id TEXT REFERENCES behavioral_episodes(episode_id),
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED')),
  reviewer_id TEXT,
  reviewer_role TEXT,
  assigned_by TEXT,
  assigned_by_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE behavioral_post_reviews (
  post_review_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  episode_id TEXT NOT NULL REFERENCES behavioral_episodes(episode_id),
  review_notes TEXT NOT NULL,
  contributing_factors TEXT,
  follow_up_recommendation TEXT,
  reviewer_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK (state IN ('COMPLETED','VERIFIED','AMENDED')),
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE behavioral_audit (
  audit_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,sequence_no)
);

CREATE INDEX idx_cognitive_observations_resident
  ON cognitive_observations(resident_id);

CREATE INDEX idx_behavioral_support_plans_resident
  ON behavioral_support_plans(resident_id);

CREATE INDEX idx_behavioral_episodes_resident
  ON behavioral_episodes(resident_id);

CREATE INDEX idx_behavioral_episodes_state
  ON behavioral_episodes(state);

CREATE INDEX idx_wandering_events_resident
  ON wandering_events(resident_id);

CREATE INDEX idx_behavioral_responses_episode
  ON behavioral_responses(episode_id);

CREATE INDEX idx_behavioral_escalations_episode
  ON behavioral_escalations(episode_id);

CREATE INDEX idx_behavioral_post_reviews_episode
  ON behavioral_post_reviews(episode_id);

CREATE INDEX idx_behavioral_audit_entity
  ON behavioral_audit(entity_type,entity_id,sequence_no);

CREATE INDEX idx_behavioral_audit_resident
  ON behavioral_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7U
-- SLEEP / REST / NIGHT-TIME SAFETY MANAGEMENT
-- ============================================================

CREATE TABLE sleep_care_plans (
  sleep_care_plan_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  preferred_bedtime TEXT,
  preferred_wake_time TEXT,
  usual_sleep_pattern TEXT,
  night_light_preference TEXT,
  room_environment_preference TEXT,
  toileting_support_preference TEXT,
  mobility_support_requirement TEXT,
  night_check_requirement TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEWED','ACTIVE','RETIRED')),
  owner_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_role TEXT,
  reviewed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sleep_observations (
  sleep_observation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observation_type TEXT NOT NULL,
  observable_facts TEXT NOT NULL,
  baseline_change BOOLEAN NOT NULL DEFAULT FALSE,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES sleep_observations(sleep_observation_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE night_monitoring_checks (
  night_check_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  sleep_care_plan_id TEXT REFERENCES sleep_care_plans(sleep_care_plan_id),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_at TIMESTAMPTZ,
  observation TEXT,
  resident_state TEXT,
  mobility_observation TEXT,
  environmental_observation TEXT,
  state TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (state IN ('SCHEDULED','COMPLETED','MISSED','HELD')),
  assigned_to TEXT,
  assigned_role TEXT,
  performed_by TEXT,
  performed_by_role TEXT,
  exception_reason TEXT,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sleep_rest_events (
  sleep_rest_event_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  event_type TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observable_facts TEXT NOT NULL,
  location TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (
      state IN (
        'OPEN','ASSIGNED','ACKNOWLEDGED',
        'RESPONDING','RESOLVED','CLOSED'
      )
    ),
  owner_id TEXT,
  owner_role TEXT,
  assigned_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_by_role TEXT,
  closed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE night_support_responses (
  response_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  sleep_rest_event_id TEXT NOT NULL REFERENCES sleep_rest_events(sleep_rest_event_id),
  response_type TEXT NOT NULL,
  response_notes TEXT,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sleep_safety_alerts (
  alert_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  alert_type TEXT NOT NULL,
  alert_notes TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ACKNOWLEDGED','REVIEWED','RESOLVED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sleep_escalations (
  sleep_escalation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED')),
  reviewer_id TEXT,
  reviewer_role TEXT,
  assigned_by TEXT,
  assigned_by_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sleep_audit (
  audit_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,sequence_no)
);

CREATE INDEX idx_sleep_care_plans_resident
  ON sleep_care_plans(resident_id);

CREATE INDEX idx_sleep_observations_resident
  ON sleep_observations(resident_id);

CREATE INDEX idx_night_monitoring_resident
  ON night_monitoring_checks(resident_id);

CREATE INDEX idx_night_monitoring_state
  ON night_monitoring_checks(state);

CREATE INDEX idx_sleep_rest_events_resident
  ON sleep_rest_events(resident_id);

CREATE INDEX idx_sleep_rest_events_state
  ON sleep_rest_events(state);

CREATE INDEX idx_night_support_event
  ON night_support_responses(sleep_rest_event_id);

CREATE INDEX idx_sleep_alerts_resident
  ON sleep_safety_alerts(resident_id);

CREATE INDEX idx_sleep_escalations_resident
  ON sleep_escalations(resident_id);

CREATE INDEX idx_sleep_audit_entity
  ON sleep_audit(entity_type,entity_id,sequence_no);

CREATE INDEX idx_sleep_audit_resident
  ON sleep_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7V
-- PAIN / COMFORT / SYMPTOM MANAGEMENT
-- ============================================================

CREATE TABLE pain_care_plans (
  pain_care_plan_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  comfort_goals TEXT,
  communication_considerations TEXT,
  non_pharmacological_preferences TEXT,
  known_triggers TEXT,
  positioning_preferences TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEWED','ACTIVE','RETIRED')),
  owner_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_role TEXT,
  reviewed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pain_assessments (
  pain_assessment_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessment_method TEXT NOT NULL,
  self_report_available BOOLEAN NOT NULL DEFAULT TRUE,
  pain_location TEXT,
  pain_character TEXT,
  pain_score NUMERIC,
  observed_pain_behaviors TEXT,
  functional_impact TEXT,
  additional_context TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  assessed_by TEXT NOT NULL,
  assessed_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES pain_assessments(pain_assessment_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE symptom_observations (
  symptom_observation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  symptom_type TEXT NOT NULL,
  observable_facts TEXT NOT NULL,
  resident_report TEXT,
  baseline_change BOOLEAN NOT NULL DEFAULT FALSE,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES symptom_observations(symptom_observation_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comfort_interventions (
  comfort_intervention_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  pain_assessment_id TEXT REFERENCES pain_assessments(pain_assessment_id),
  symptom_observation_id TEXT REFERENCES symptom_observations(symptom_observation_id),
  intervention_type TEXT NOT NULL,
  intervention_notes TEXT,
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pain_reassessments (
  pain_reassessment_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  pain_assessment_id TEXT REFERENCES pain_assessments(pain_assessment_id),
  comfort_intervention_id TEXT REFERENCES comfort_interventions(comfort_intervention_id),
  reassessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resident_report TEXT,
  observable_change TEXT,
  pain_score NUMERIC,
  functional_change TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  reassessed_by TEXT NOT NULL,
  reassessed_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pain_safety_alerts (
  pain_safety_alert_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  alert_type TEXT NOT NULL,
  alert_notes TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ACKNOWLEDGED','REVIEWED','RESOLVED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_by_role TEXT,
  acknowledged_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pain_escalations (
  pain_escalation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED')),
  reviewer_id TEXT,
  reviewer_role TEXT,
  assigned_by TEXT,
  assigned_by_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pain_audit (
  audit_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,sequence_no)
);

CREATE INDEX idx_pain_plans_resident
  ON pain_care_plans(resident_id);

CREATE INDEX idx_pain_assessments_resident
  ON pain_assessments(resident_id);

CREATE INDEX idx_symptom_observations_resident
  ON symptom_observations(resident_id);

CREATE INDEX idx_comfort_interventions_resident
  ON comfort_interventions(resident_id);

CREATE INDEX idx_pain_reassessments_resident
  ON pain_reassessments(resident_id);

CREATE INDEX idx_pain_alerts_resident
  ON pain_safety_alerts(resident_id);

CREATE INDEX idx_pain_escalations_resident
  ON pain_escalations(resident_id);

CREATE INDEX idx_pain_audit_entity
  ON pain_audit(entity_type,entity_id,sequence_no);

CREATE INDEX idx_pain_audit_resident
  ON pain_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7W
-- INFECTION PREVENTION / SURVEILLANCE / COMMUNICABLE DISEASE
-- ============================================================

CREATE TABLE infection_control_plans (
  infection_control_plan_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  prevention_considerations TEXT,
  communication_considerations TEXT,
  approved_precaution_guidance TEXT,
  monitoring_guidance TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEWED','ACTIVE','RETIRED')),
  owner_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_role TEXT,
  reviewed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE infection_observations (
  infection_observation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observation_type TEXT NOT NULL,
  observable_facts TEXT NOT NULL,
  resident_report TEXT,
  baseline_change BOOLEAN NOT NULL DEFAULT FALSE,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES infection_observations(infection_observation_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exposure_events (
  exposure_event_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  exposure_type TEXT NOT NULL,
  exposure_context TEXT NOT NULL,
  exposure_at TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','REVIEWED','CLOSED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_by_role TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE infection_precautions (
  infection_precaution_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  precaution_type TEXT NOT NULL,
  precaution_notes TEXT,
  state TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (state IN ('PROPOSED','AUTHORIZED','ACTIVE','DISCONTINUED')),
  proposed_by TEXT NOT NULL,
  proposed_by_role TEXT NOT NULL,
  authorized_by TEXT,
  authorized_by_role TEXT,
  authorized_at TIMESTAMPTZ,
  activated_by TEXT,
  activated_by_role TEXT,
  activated_at TIMESTAMPTZ,
  discontinued_by TEXT,
  discontinued_by_role TEXT,
  discontinued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE infection_monitoring_records (
  infection_monitoring_record_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT,
  source_id TEXT,
  monitored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  monitoring_type TEXT NOT NULL,
  observed_facts TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES infection_monitoring_records(infection_monitoring_record_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE infection_alerts (
  infection_alert_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  alert_type TEXT NOT NULL,
  alert_notes TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ACKNOWLEDGED','REVIEWED','RESOLVED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_by_role TEXT,
  acknowledged_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE infection_escalations (
  infection_escalation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED')),
  reviewer_id TEXT,
  reviewer_role TEXT,
  assigned_by TEXT,
  assigned_by_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE infection_audit (
  audit_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,sequence_no)
);

CREATE INDEX idx_infection_control_plan_resident
  ON infection_control_plans(resident_id);

CREATE INDEX idx_infection_observation_resident
  ON infection_observations(resident_id);

CREATE INDEX idx_exposure_event_resident
  ON exposure_events(resident_id);

CREATE INDEX idx_infection_precaution_resident
  ON infection_precautions(resident_id);

CREATE INDEX idx_infection_monitoring_resident
  ON infection_monitoring_records(resident_id);

CREATE INDEX idx_infection_alert_resident
  ON infection_alerts(resident_id);

CREATE INDEX idx_infection_escalation_resident
  ON infection_escalations(resident_id);

CREATE INDEX idx_infection_audit_entity
  ON infection_audit(entity_type,entity_id,sequence_no);

CREATE INDEX idx_infection_audit_resident
  ON infection_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7X
-- MEDICATION SAFETY / RECONCILIATION / HIGH-RISK GOVERNANCE
-- ============================================================

CREATE TABLE medication_reconciliations (
  medication_reconciliation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  reconciliation_context TEXT NOT NULL,
  source_summary TEXT,
  state TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (state IN ('DRAFT','REVIEWED','COMPLETED')),
  owner_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_role TEXT,
  reviewed_at TIMESTAMPTZ,
  completed_by TEXT,
  completed_by_role TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_reconciliation_items (
  medication_reconciliation_item_id TEXT PRIMARY KEY,
  medication_reconciliation_id TEXT NOT NULL
    REFERENCES medication_reconciliations(medication_reconciliation_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  medication_name_text TEXT NOT NULL,
  dose_text TEXT,
  route_text TEXT,
  frequency_text TEXT,
  source_text TEXT,
  discrepancy_type TEXT,
  discrepancy_notes TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES medication_reconciliation_items(
    medication_reconciliation_item_id
  ),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_order_reviews (
  medication_order_review_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  medication_order_ref TEXT,
  review_context TEXT NOT NULL,
  review_notes TEXT,
  state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','REVIEWED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_safety_checks (
  medication_safety_check_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  medication_order_ref TEXT,
  medication_schedule_ref TEXT,
  administration_context_ref TEXT,
  identity_checked BOOLEAN NOT NULL DEFAULT FALSE,
  order_context_checked BOOLEAN NOT NULL DEFAULT FALSE,
  allergy_context_checked BOOLEAN NOT NULL DEFAULT FALSE,
  route_context_checked BOOLEAN NOT NULL DEFAULT FALSE,
  readiness_checked BOOLEAN NOT NULL DEFAULT FALSE,
  safety_notes TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED')),
  performed_by TEXT NOT NULL,
  performed_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE high_risk_medication_checks (
  high_risk_medication_check_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  medication_order_ref TEXT,
  policy_reference TEXT NOT NULL,
  check_context TEXT,
  state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (
      state IN (
        'PENDING',
        'FIRST_CHECKED',
        'SECOND_CHECKED',
        'COMPLETE'
      )
    ),
  first_checker_id TEXT,
  first_checker_role TEXT,
  first_checked_at TIMESTAMPTZ,
  second_checker_id TEXT,
  second_checker_role TEXT,
  second_checked_at TIMESTAMPTZ,
  completed_by TEXT,
  completed_by_role TEXT,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    second_checker_id IS NULL
    OR first_checker_id IS NULL
    OR second_checker_id <> first_checker_id
  )
);

CREATE TABLE medication_administration_exceptions (
  medication_administration_exception_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  medication_order_ref TEXT,
  medication_schedule_ref TEXT,
  medication_administration_ref TEXT,
  exception_type TEXT NOT NULL,
  exception_notes TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_adverse_reaction_observations (
  medication_adverse_reaction_observation_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  medication_order_ref TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observable_facts TEXT NOT NULL,
  resident_report TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES medication_adverse_reaction_observations(
    medication_adverse_reaction_observation_id
  ),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_safety_audit (
  audit_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,sequence_no)
);

CREATE INDEX idx_med_recon_resident
  ON medication_reconciliations(resident_id);

CREATE INDEX idx_med_recon_item_recon
  ON medication_reconciliation_items(medication_reconciliation_id);

CREATE INDEX idx_med_recon_item_resident
  ON medication_reconciliation_items(resident_id);

CREATE INDEX idx_med_order_review_resident
  ON medication_order_reviews(resident_id);

CREATE INDEX idx_med_safety_check_resident
  ON medication_safety_checks(resident_id);

CREATE INDEX idx_high_risk_check_resident
  ON high_risk_medication_checks(resident_id);

CREATE INDEX idx_med_admin_exception_resident
  ON medication_administration_exceptions(resident_id);

CREATE INDEX idx_med_adverse_obs_resident
  ON medication_adverse_reaction_observations(resident_id);

CREATE INDEX idx_med_safety_audit_entity
  ON medication_safety_audit(entity_type,entity_id,sequence_no);

CREATE INDEX idx_med_safety_audit_resident
  ON medication_safety_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7Y
-- SAFEGUARDING / ABUSE / NEGLECT / EXPLOITATION / RIGHTS
-- ============================================================

CREATE TABLE safeguarding_reports (
  safeguarding_report_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  concern_category TEXT NOT NULL,
  factual_description TEXT NOT NULL,
  resident_statement TEXT,
  immediate_safety_concern BOOLEAN NOT NULL DEFAULT FALSE,
  confidentiality_note TEXT,
  state TEXT NOT NULL DEFAULT 'REPORTED'
    CHECK (
      state IN (
        'REPORTED',
        'TRIAGED',
        'UNDER_REVIEW',
        'RESOLVED',
        'CLOSED'
      )
    ),
  reporter_id TEXT NOT NULL,
  reporter_role TEXT NOT NULL,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_summary TEXT,
  resolved_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_by_role TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE safeguarding_triage (
  safeguarding_triage_id TEXT PRIMARY KEY,
  safeguarding_report_id TEXT NOT NULL
    REFERENCES safeguarding_reports(safeguarding_report_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  urgency_classification TEXT NOT NULL,
  immediate_safety_concern BOOLEAN NOT NULL DEFAULT FALSE,
  protection_need TEXT,
  human_rationale TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','COMPLETED')),
  triaged_by TEXT,
  triaged_by_role TEXT,
  triaged_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE protective_actions (
  protective_action_id TEXT PRIMARY KEY,
  safeguarding_report_id TEXT NOT NULL
    REFERENCES safeguarding_reports(safeguarding_report_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  necessity_rationale TEXT NOT NULL,
  proportionality_rationale TEXT NOT NULL,
  rights_impact TEXT,
  review_requirements TEXT,
  state TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (
      state IN (
        'PROPOSED',
        'AUTHORIZED',
        'ACTIVE',
        'REVIEWED',
        'ENDED'
      )
    ),
  proposed_by TEXT NOT NULL,
  proposed_by_role TEXT NOT NULL,
  authorized_by TEXT,
  authorized_by_role TEXT,
  authorized_at TIMESTAMPTZ,
  activated_by TEXT,
  activated_by_role TEXT,
  activated_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  ended_by TEXT,
  ended_by_role TEXT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE safeguarding_assignments (
  safeguarding_assignment_id TEXT PRIMARY KEY,
  safeguarding_report_id TEXT NOT NULL
    REFERENCES safeguarding_reports(safeguarding_report_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  owner_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ASSIGNED'
    CHECK (state IN ('ASSIGNED','ACCEPTED','RELEASED')),
  assigned_by TEXT NOT NULL,
  assigned_by_role TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  released_by TEXT,
  released_by_role TEXT,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE safeguarding_reviews (
  safeguarding_review_id TEXT PRIMARY KEY,
  safeguarding_report_id TEXT NOT NULL
    REFERENCES safeguarding_reports(safeguarding_report_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  safeguarding_assignment_id TEXT
    REFERENCES safeguarding_assignments(safeguarding_assignment_id),
  review_type TEXT NOT NULL,
  factual_notes TEXT NOT NULL,
  resident_statement TEXT,
  evidence_references TEXT,
  uncertainty_notes TEXT,
  finding_summary TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','IN_PROGRESS','COMPLETED','AMENDED')),
  reviewer_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  amendment_of TEXT
    REFERENCES safeguarding_reviews(safeguarding_review_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE safeguarding_escalations (
  safeguarding_escalation_id TEXT PRIMARY KEY,
  safeguarding_report_id TEXT NOT NULL
    REFERENCES safeguarding_reports(safeguarding_report_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED')),
  reviewer_id TEXT,
  reviewer_role TEXT,
  assigned_by TEXT,
  assigned_by_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE safeguarding_post_reviews (
  safeguarding_post_review_id TEXT PRIMARY KEY,
  safeguarding_report_id TEXT NOT NULL
    REFERENCES safeguarding_reports(safeguarding_report_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  protection_followup TEXT,
  recurrence_prevention TEXT,
  policy_review_notes TEXT,
  training_need TEXT,
  process_issue TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','REVIEWED','CLOSED')),
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_by_role TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE safeguarding_audit (
  audit_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,sequence_no)
);

CREATE INDEX idx_safeguarding_report_resident
  ON safeguarding_reports(resident_id);

CREATE INDEX idx_safeguarding_triage_report
  ON safeguarding_triage(safeguarding_report_id);

CREATE INDEX idx_protective_action_report
  ON protective_actions(safeguarding_report_id);

CREATE INDEX idx_safeguarding_assignment_report
  ON safeguarding_assignments(safeguarding_report_id);

CREATE INDEX idx_safeguarding_review_report
  ON safeguarding_reviews(safeguarding_report_id);

CREATE INDEX idx_safeguarding_escalation_report
  ON safeguarding_escalations(safeguarding_report_id);

CREATE INDEX idx_safeguarding_post_review_report
  ON safeguarding_post_reviews(safeguarding_report_id);

CREATE INDEX idx_safeguarding_audit_entity
  ON safeguarding_audit(entity_type,entity_id,sequence_no);

CREATE INDEX idx_safeguarding_audit_resident
  ON safeguarding_audit(resident_id);

-- ============================================================
-- TAM AN CARE V7.4.3 — STEP 7Z
-- FALLS / MOBILITY / TRANSFER SAFETY
-- ============================================================

CREATE TABLE fall_risk_assessments (
  fall_risk_assessment_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  assessment_context TEXT NOT NULL,
  observable_risk_factors TEXT,
  mobility_observations TEXT,
  prior_fall_context TEXT,
  environmental_context TEXT,
  state TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (state IN ('DRAFT','VERIFIED','AMENDED')),
  assessor_id TEXT NOT NULL,
  assessor_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES fall_risk_assessments(fall_risk_assessment_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mobility_support_plans (
  mobility_support_plan_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  mobility_support_needs TEXT NOT NULL,
  transfer_assistance_level TEXT NOT NULL,
  assistive_device_context TEXT,
  environmental_support TEXT,
  safety_notes TEXT,
  state TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (state IN ('DRAFT','REVIEWED','ACTIVE','INACTIVE')),
  owner_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_role TEXT,
  reviewed_at TIMESTAMPTZ,
  activated_by TEXT,
  activated_by_role TEXT,
  activated_at TIMESTAMPTZ,
  inactivated_by TEXT,
  inactivated_by_role TEXT,
  inactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transfer_safety_checks (
  transfer_safety_check_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  mobility_support_plan_id TEXT REFERENCES mobility_support_plans(mobility_support_plan_id),
  transfer_context TEXT NOT NULL,
  assistance_available TEXT,
  assistive_device_context TEXT,
  environmental_readiness TEXT,
  observable_facts TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES transfer_safety_checks(transfer_safety_check_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fall_events (
  fall_event_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('FALL','NEAR_FALL')),
  occurred_at TIMESTAMPTZ NOT NULL,
  location_text TEXT,
  factual_description TEXT NOT NULL,
  witness_context TEXT,
  immediate_observable_condition TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (
      state IN (
        'OPEN',
        'ASSIGNED',
        'ACKNOWLEDGED',
        'RESOLVED',
        'CLOSED'
      )
    ),
  reporter_id TEXT NOT NULL,
  reporter_role TEXT NOT NULL,
  owner_id TEXT,
  owner_role TEXT,
  assigned_by TEXT,
  assigned_by_role TEXT,
  assigned_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_by_role TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE post_fall_observations (
  post_fall_observation_id TEXT PRIMARY KEY,
  fall_event_id TEXT NOT NULL REFERENCES fall_events(fall_event_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  observable_facts TEXT NOT NULL,
  resident_report TEXT,
  mobility_observation TEXT,
  pain_report TEXT,
  neurological_observation_text TEXT,
  state TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (state IN ('RECORDED','VERIFIED','AMENDED')),
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,
  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,
  amendment_of TEXT REFERENCES post_fall_observations(post_fall_observation_id),
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fall_prevention_actions (
  fall_prevention_action_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  fall_event_id TEXT REFERENCES fall_events(fall_event_id),
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  necessity_rationale TEXT NOT NULL,
  dignity_mobility_impact TEXT,
  state TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (
      state IN (
        'PROPOSED',
        'AUTHORIZED',
        'ACTIVE',
        'REVIEWED',
        'ENDED'
      )
    ),
  proposed_by TEXT NOT NULL,
  proposed_by_role TEXT NOT NULL,
  authorized_by TEXT,
  authorized_by_role TEXT,
  authorized_at TIMESTAMPTZ,
  activated_by TEXT,
  activated_by_role TEXT,
  activated_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  ended_by TEXT,
  ended_by_role TEXT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fall_escalations (
  fall_escalation_id TEXT PRIMARY KEY,
  fall_event_id TEXT NOT NULL REFERENCES fall_events(fall_event_id),
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (state IN ('OPEN','ASSIGNED','ACCEPTED','RESOLVED')),
  reviewer_id TEXT,
  reviewer_role TEXT,
  assigned_by TEXT,
  assigned_by_role TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_by_role TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fall_audit (
  audit_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id,sequence_no)
);

CREATE INDEX idx_fall_risk_resident
  ON fall_risk_assessments(resident_id);

CREATE INDEX idx_mobility_plan_resident
  ON mobility_support_plans(resident_id);

CREATE INDEX idx_transfer_check_resident
  ON transfer_safety_checks(resident_id);

CREATE INDEX idx_fall_event_resident
  ON fall_events(resident_id);

CREATE INDEX idx_post_fall_event
  ON post_fall_observations(fall_event_id);

CREATE INDEX idx_prevention_event
  ON fall_prevention_actions(fall_event_id);

CREATE INDEX idx_fall_escalation_event
  ON fall_escalations(fall_event_id);

CREATE INDEX idx_fall_audit_entity
  ON fall_audit(entity_type,entity_id,sequence_no);

CREATE INDEX idx_fall_audit_resident
  ON fall_audit(resident_id);

CREATE TABLE resident_access_assignments (
  resident_access_assignment_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  actor_id TEXT NOT NULL,

  actor_role TEXT NOT NULL
    CHECK (
      actor_role IN ('CAREGIVER','NURSE')
    ),

  access_scope TEXT NOT NULL
    CHECK (
      access_scope IN ('DIRECT_CARE','CLINICAL_CARE')
    ),

  status TEXT NOT NULL
    CHECK (
      status IN ('ACTIVE','REVOKED')
    ),

  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,

  assigned_by TEXT NOT NULL,
  assigned_by_role TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL,

  revoked_by TEXT,
  revoked_by_role TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT resident_access_role_scope_check
    CHECK (
      (
        actor_role='CAREGIVER'
        AND access_scope='DIRECT_CARE'
      )
      OR
      (
        actor_role='NURSE'
        AND access_scope='CLINICAL_CARE'
      )
    ),

  CONSTRAINT resident_access_effective_interval_check
    CHECK (
      effective_to IS NULL
      OR effective_to > effective_from
    ),

  CONSTRAINT resident_access_revocation_check
    CHECK (
      (
        status='ACTIVE'
        AND revoked_at IS NULL
      )
      OR
      (
        status='REVOKED'
        AND revoked_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX uq_resident_access_active_grant
ON resident_access_assignments (
  resident_id,
  actor_id,
  actor_role,
  access_scope
)
WHERE status='ACTIVE';

CREATE INDEX idx_resident_access_authorization
ON resident_access_assignments (
  actor_id,
  actor_role,
  status,
  resident_id
);

CREATE INDEX idx_resident_access_resident_admin
ON resident_access_assignments (
  resident_id,
  status,
  actor_id
);
