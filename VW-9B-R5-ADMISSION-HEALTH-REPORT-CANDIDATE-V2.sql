CREATE TABLE admission_cases (
  admission_case_id TEXT PRIMARY KEY,

  admission_code TEXT NOT NULL UNIQUE,

  resident_id TEXT
    REFERENCES residents(resident_id),

  prospective_resident_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,

  gender TEXT NOT NULL
    CHECK (
      gender IN (
        'MALE',
        'FEMALE',
        'OTHER',
        'UNSPECIFIED'
      )
    ),

  identity_number TEXT,

  requested_admission_date DATE,
  actual_admission_date DATE,

  admission_reason TEXT,
  care_expectations TEXT,
  referral_source TEXT,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'PRE_ASSESSMENT',
        'ASSESSMENT_IN_PROGRESS',
        'ASSESSMENT_COMPLETED',
        'REVIEW_REQUIRED',
        'APPROVED_FOR_ADMISSION',
        'CONDITIONAL_ADMISSION',
        'FURTHER_ASSESSMENT_REQUIRED',
        'NOT_SUITABLE',
        'ADMITTED',
        'CANCELLED',
        'ARCHIVED'
      )
    ),

  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_by TEXT NOT NULL,
  updated_by_role TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  assessment_started_at TIMESTAMPTZ,
  assessment_completed_at TIMESTAMPTZ,

  review_requested_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_by_role TEXT,

  admitted_at TIMESTAMPTZ,
  admitted_by TEXT,
  admitted_by_role TEXT,

  record_version BIGINT NOT NULL DEFAULT 1,

  CHECK (
    status <> 'ADMITTED'
    OR (
      resident_id IS NOT NULL
      AND admitted_at IS NOT NULL
      AND admitted_by IS NOT NULL
      AND admitted_by_role IS NOT NULL
    )
  )
);


CREATE TABLE admission_contacts (
  admission_contact_id TEXT PRIMARY KEY,

  admission_case_id TEXT NOT NULL
    REFERENCES admission_cases(admission_case_id)
    ON DELETE CASCADE,

  contact_type TEXT NOT NULL
    CHECK (
      contact_type IN (
        'GUARDIAN',
        'REPRESENTATIVE',
        'FAMILY',
        'EMERGENCY_CONTACT',
        'PRIMARY_CONTACT',
        'OTHER'
      )
    ),

  full_name TEXT NOT NULL,
  relationship TEXT,

  phone TEXT,
  email TEXT,
  address TEXT,

  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_legal_representative BOOLEAN NOT NULL DEFAULT FALSE,

  authorized_for_health_reports BOOLEAN NOT NULL DEFAULT FALSE,

  authorization_effective_from TIMESTAMPTZ,
  authorization_effective_to TIMESTAMPTZ,

  notes TEXT,

  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_measurements (
  admission_measurement_id TEXT PRIMARY KEY,

  admission_case_id TEXT NOT NULL
    REFERENCES admission_cases(admission_case_id)
    ON DELETE CASCADE,

  measurement_type TEXT NOT NULL,

  value_numeric NUMERIC,
  value_secondary NUMERIC,
  value_text TEXT,

  unit TEXT,

  measured_at TIMESTAMPTZ NOT NULL,

  classification TEXT,
  abnormal_flag BOOLEAN NOT NULL DEFAULT FALSE,

  measurement_context TEXT NOT NULL
    DEFAULT 'ADMISSION_BASELINE',

  measurement_source TEXT,
  device_reference TEXT,

  notes TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  verification_status TEXT NOT NULL DEFAULT 'RECORDED'
    CHECK (
      verification_status IN (
        'RECORDED',
        'VERIFIED',
        'AMENDED',
        'VOIDED'
      )
    ),

  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    value_numeric IS NOT NULL
    OR value_secondary IS NOT NULL
    OR NULLIF(trim(value_text), '') IS NOT NULL
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


CREATE TABLE admission_medical_history (
  admission_medical_history_id TEXT PRIMARY KEY,

  admission_case_id TEXT NOT NULL
    REFERENCES admission_cases(admission_case_id)
    ON DELETE CASCADE,

  condition_code TEXT,
  condition_name TEXT NOT NULL,

  condition_status TEXT,
  diagnosed_date DATE,
  diagnosis_source TEXT,

  details TEXT,
  notes TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_assessments (
  admission_assessment_id TEXT PRIMARY KEY,

  admission_case_id TEXT NOT NULL
    REFERENCES admission_cases(admission_case_id)
    ON DELETE CASCADE,

  assessment_type TEXT NOT NULL,
  assessment_version INTEGER NOT NULL DEFAULT 1,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'IN_PROGRESS',
        'COMPLETED',
        'VERIFIED',
        'AMENDED',
        'VOIDED'
      )
    ),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  assessed_by TEXT NOT NULL,
  assessed_by_role TEXT NOT NULL,

  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,

  summary TEXT,
  clinical_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_clinical_examinations (
  admission_clinical_examination_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  examination_area TEXT NOT NULL,

  observable_findings TEXT,
  abnormal_flag BOOLEAN NOT NULL DEFAULT FALSE,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_adl_items (
  admission_adl_item_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  activity_code TEXT NOT NULL
    CHECK (
      activity_code IN (
        'EATING',
        'BATHING',
        'DRESSING',
        'TOILETING',
        'MOBILITY',
        'TRANSFER'
      )
    ),

  assistance_level TEXT NOT NULL
    CHECK (
      assistance_level IN (
        'INDEPENDENT',
        'SUPERVISION',
        'PARTIAL_ASSISTANCE',
        'SUBSTANTIAL_ASSISTANCE',
        'FULL_ASSISTANCE'
      )
    ),

  score NUMERIC,
  notes TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_cognitive_assessments (
  admission_cognitive_assessment_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  alertness TEXT,
  orientation TEXT,
  memory TEXT,
  communication TEXT,
  behavior TEXT,
  mood TEXT,

  cognitive_impairment TEXT,

  notes TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_nutrition_assessments (
  admission_nutrition_assessment_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  diet_type TEXT,
  swallowing_status TEXT,
  oral_health TEXT,

  feeding_assistance_required BOOLEAN NOT NULL DEFAULT FALSE,

  nutrition_risk TEXT,
  hydration_observation TEXT,

  notes TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_risk_items (
  admission_risk_item_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  risk_type TEXT NOT NULL,

  risk_level TEXT NOT NULL
    CHECK (
      risk_level IN (
        'LOW',
        'MODERATE',
        'HIGH',
        'CRITICAL'
      )
    ),

  score NUMERIC,
  assessment_method TEXT,
  details TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_care_classifications (
  admission_care_classification_id TEXT PRIMARY KEY,

  admission_case_id TEXT NOT NULL
    REFERENCES admission_cases(admission_case_id)
    ON DELETE CASCADE,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id),

  rule_set_version TEXT NOT NULL,

  domain_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,

  suggested_care_level TEXT
    CHECK (
      suggested_care_level IS NULL
      OR suggested_care_level IN (
        'INDEPENDENT',
        'ASSISTED',
        'HIGH_ASSISTANCE',
        'DEPENDENT'
      )
    ),

  suggestion_generated_at TIMESTAMPTZ,

  review_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (
      review_status IN (
        'PENDING',
        'REVIEWED',
        'APPROVED',
        'OVERRIDDEN',
        'REASSESSMENT_REQUIRED'
      )
    ),

  approved_care_level TEXT
    CHECK (
      approved_care_level IS NULL
      OR approved_care_level IN (
        'INDEPENDENT',
        'ASSISTED',
        'HIGH_ASSISTANCE',
        'DEPENDENT'
      )
    ),

  approved_by TEXT,
  approved_by_role TEXT,
  approved_at TIMESTAMPTZ,

  override_applied BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,

  reassessment_required BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    override_applied = FALSE
    OR NULLIF(trim(override_reason), '') IS NOT NULL
  )
);


CREATE TABLE admission_decisions (
  admission_decision_id TEXT PRIMARY KEY,

  admission_case_id TEXT NOT NULL
    REFERENCES admission_cases(admission_case_id)
    ON DELETE CASCADE,

  decision TEXT NOT NULL
    CHECK (
      decision IN (
        'APPROVED',
        'CONDITIONAL',
        'FURTHER_ASSESSMENT',
        'NOT_SUITABLE'
      )
    ),

  conditions TEXT,
  reason TEXT,

  decided_by TEXT NOT NULL,
  decided_by_role TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE admission_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  admission_case_id TEXT NOT NULL
    REFERENCES admission_cases(admission_case_id),

  event_type TEXT NOT NULL,

  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,

  previous_status TEXT,
  new_status TEXT,

  entity_type TEXT,
  entity_id TEXT,

  reason TEXT,

  previous_state JSONB,
  new_state JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE health_reports (
  health_report_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  report_type TEXT NOT NULL
    CHECK (
      report_type IN (
        'WEEKLY',
        'MONTHLY',
        'QUARTERLY',
        'CUSTOM',
        'EVENT_BASED'
      )
    ),

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'GENERATED',
        'UNDER_REVIEW',
        'REVISION_REQUIRED',
        'APPROVED',
        'DELIVERED',
        'SUPERSEDED',
        'CANCELLED'
      )
    ),

  report_version INTEGER NOT NULL DEFAULT 1,

  summary TEXT,

  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,

  generated_at TIMESTAMPTZ,
  generated_by TEXT,
  generated_by_role TEXT,

  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_by_role TEXT,

  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_by_role TEXT,

  supersedes_report_id TEXT
    REFERENCES health_reports(health_report_id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (period_end >= period_start)
);


CREATE TABLE health_report_snapshots (
  health_report_snapshot_id TEXT PRIMARY KEY,

  health_report_id TEXT NOT NULL
    REFERENCES health_reports(health_report_id)
    ON DELETE CASCADE,

  snapshot_version INTEGER NOT NULL DEFAULT 1,

  baseline_reference TEXT,

  source_cutoff_at TIMESTAMPTZ NOT NULL,

  snapshot_data JSONB NOT NULL,
  source_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,

  source_hash TEXT NOT NULL,

  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE health_report_deliveries (
  health_report_delivery_id TEXT PRIMARY KEY,

  health_report_id TEXT NOT NULL
    REFERENCES health_reports(health_report_id),

  recipient_name TEXT NOT NULL,
  recipient_relationship TEXT,

  recipient_contact_reference TEXT,

  delivery_method TEXT NOT NULL,

  authorization_reference TEXT,

  delivery_status TEXT NOT NULL
    CHECK (
      delivery_status IN (
        'PENDING',
        'DELIVERED',
        'FAILED',
        'CANCELLED'
      )
    ),

  delivered_by TEXT,
  delivered_by_role TEXT,
  delivered_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE health_report_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  health_report_id TEXT NOT NULL
    REFERENCES health_reports(health_report_id),

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  event_type TEXT NOT NULL,

  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,

  previous_state JSONB,
  new_state JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX idx_admission_cases_status_created
  ON admission_cases(status, created_at DESC);

CREATE INDEX idx_admission_cases_resident
  ON admission_cases(resident_id);

CREATE INDEX idx_admission_cases_identity
  ON admission_cases(identity_number);

CREATE INDEX idx_admission_contacts_case
  ON admission_contacts(admission_case_id);

CREATE INDEX idx_admission_measurements_case_time
  ON admission_measurements(
    admission_case_id,
    measured_at DESC
  );

CREATE INDEX idx_admission_measurements_case_type_time
  ON admission_measurements(
    admission_case_id,
    measurement_type,
    measured_at DESC
  );

CREATE INDEX idx_admission_medical_history_case
  ON admission_medical_history(admission_case_id);

CREATE INDEX idx_admission_assessments_case_status
  ON admission_assessments(
    admission_case_id,
    status
  );

CREATE INDEX idx_admission_clinical_exam_assessment
  ON admission_clinical_examinations(
    admission_assessment_id
  );

CREATE INDEX idx_admission_adl_assessment
  ON admission_adl_items(admission_assessment_id);

CREATE INDEX idx_admission_cognitive_assessment
  ON admission_cognitive_assessments(
    admission_assessment_id
  );

CREATE INDEX idx_admission_nutrition_assessment
  ON admission_nutrition_assessments(
    admission_assessment_id
  );

CREATE INDEX idx_admission_risk_assessment
  ON admission_risk_items(admission_assessment_id);

CREATE INDEX idx_admission_classification_case
  ON admission_care_classifications(
    admission_case_id,
    created_at DESC
  );

CREATE INDEX idx_admission_decision_case
  ON admission_decisions(
    admission_case_id,
    decided_at DESC
  );

CREATE INDEX idx_admission_audit_case_created
  ON admission_audit(
    admission_case_id,
    created_at
  );

CREATE INDEX idx_health_report_resident_period
  ON health_reports(
    resident_id,
    period_end DESC
  );

CREATE INDEX idx_health_report_resident_status
  ON health_reports(
    resident_id,
    status
  );

CREATE INDEX idx_health_report_snapshot_report
  ON health_report_snapshots(
    health_report_id,
    snapshot_version
  );

CREATE INDEX idx_health_report_delivery_report
  ON health_report_deliveries(
    health_report_id,
    created_at
  );

CREATE INDEX idx_health_report_audit_report_created
  ON health_report_audit(
    health_report_id,
    created_at
  );

CREATE INDEX idx_health_report_audit_resident_created
  ON health_report_audit(
    resident_id,
    created_at
  );
