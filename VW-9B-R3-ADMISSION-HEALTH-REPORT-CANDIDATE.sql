CREATE TABLE admission_assessments (
  admission_assessment_id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id),

  admission_at TIMESTAMPTZ NOT NULL,
  assessment_context TEXT,
  presenting_context TEXT,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'VERIFIED',
        'AMENDED',
        'VOIDED'
      )
    ),

  created_by TEXT NOT NULL,
  created_by_role TEXT NOT NULL,

  verified_by TEXT,
  verified_by_role TEXT,
  verified_at TIMESTAMPTZ,

  amends_assessment_id TEXT
    REFERENCES admission_assessments(admission_assessment_id),

  amendment_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

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

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  history_type TEXT NOT NULL,
  history_summary TEXT NOT NULL,
  source_reference TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_clinical_examinations (
  admission_clinical_examination_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  examination_area TEXT NOT NULL,
  observable_findings TEXT NOT NULL,

  abnormal_flag BOOLEAN NOT NULL DEFAULT FALSE,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_adl_assessments (
  admission_adl_assessment_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  mobility TEXT,
  transfer_ability TEXT,
  bathing_support TEXT,
  dressing_support TEXT,
  toileting_support TEXT,
  feeding_support TEXT,

  functional_summary TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_cognitive_assessments (
  admission_cognitive_assessment_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  orientation_observation TEXT,
  memory_observation TEXT,
  communication_observation TEXT,
  behavioral_observation TEXT,
  mental_status_summary TEXT,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_nutrition_assessments (
  admission_nutrition_assessment_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  nutrition_summary TEXT,
  appetite_observation TEXT,
  hydration_observation TEXT,
  swallowing_observation TEXT,

  allergy_information TEXT,
  intolerance_information TEXT,

  feeding_assistance_required BOOLEAN NOT NULL DEFAULT FALSE,

  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_clinical_risks (
  admission_clinical_risk_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  risk_type TEXT NOT NULL,
  risk_summary TEXT,

  risk_level TEXT
    CHECK (
      risk_level IS NULL
      OR risk_level IN (
        'LOW',
        'MODERATE',
        'HIGH',
        'CRITICAL'
      )
    ),

  identified_by TEXT NOT NULL,
  identified_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_care_classifications (
  admission_care_classification_id TEXT PRIMARY KEY,

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id)
    ON DELETE CASCADE,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  care_level TEXT NOT NULL
    CHECK (
      care_level IN (
        'INDEPENDENT',
        'ASSISTED',
        'HIGH_ASSISTANCE',
        'DEPENDENT'
      )
    ),

  classification_reason TEXT NOT NULL,

  classified_by TEXT NOT NULL,
  classified_by_role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  admission_assessment_id TEXT NOT NULL
    REFERENCES admission_assessments(admission_assessment_id),

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'ADMISSION_CREATED',
        'ADMISSION_UPDATED',
        'ADMISSION_VERIFIED',
        'ADMISSION_AMENDED',
        'ADMISSION_VOIDED',
        'CARE_CLASSIFIED'
      )
    ),

  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,

  previous_state JSONB,
  new_state JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE health_reports (
  health_report_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  report_type TEXT NOT NULL,

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'GENERATED',
        'REVIEWED',
        'ISSUED',
        'SUPERSEDED',
        'VOIDED'
      )
    ),

  summary TEXT,

  generated_by TEXT NOT NULL,
  generated_by_role TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  reviewed_by TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,

  issued_by TEXT,
  issued_by_role TEXT,
  issued_at TIMESTAMPTZ,

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

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  snapshot_type TEXT NOT NULL,

  source_entity_type TEXT,
  source_entity_id TEXT,

  snapshot_data JSONB NOT NULL,

  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE health_report_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  health_report_id TEXT NOT NULL
    REFERENCES health_reports(health_report_id),

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'REPORT_CREATED',
        'REPORT_GENERATED',
        'REPORT_REVIEWED',
        'REPORT_ISSUED',
        'REPORT_SUPERSEDED',
        'REPORT_VOIDED'
      )
    ),

  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,

  previous_state JSONB,
  new_state JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admission_assessment_resident_time
  ON admission_assessments(
    resident_id,
    admission_at DESC
  );

CREATE INDEX idx_admission_assessment_status
  ON admission_assessments(status);

CREATE INDEX idx_admission_medical_history_assessment
  ON admission_medical_history(admission_assessment_id);

CREATE INDEX idx_admission_medical_history_resident
  ON admission_medical_history(resident_id);

CREATE INDEX idx_admission_clinical_exam_assessment
  ON admission_clinical_examinations(admission_assessment_id);

CREATE INDEX idx_admission_adl_assessment
  ON admission_adl_assessments(admission_assessment_id);

CREATE INDEX idx_admission_cognitive_assessment
  ON admission_cognitive_assessments(admission_assessment_id);

CREATE INDEX idx_admission_nutrition_assessment
  ON admission_nutrition_assessments(admission_assessment_id);

CREATE INDEX idx_admission_risk_assessment
  ON admission_clinical_risks(admission_assessment_id);

CREATE INDEX idx_admission_risk_resident
  ON admission_clinical_risks(
    resident_id,
    risk_type
  );

CREATE INDEX idx_admission_classification_assessment
  ON admission_care_classifications(admission_assessment_id);

CREATE INDEX idx_admission_audit_assessment_created
  ON admission_audit(
    admission_assessment_id,
    created_at
  );

CREATE INDEX idx_admission_audit_resident_created
  ON admission_audit(
    resident_id,
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
  ON health_report_snapshots(health_report_id);

CREATE INDEX idx_health_report_snapshot_source
  ON health_report_snapshots(
    source_entity_type,
    source_entity_id
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
