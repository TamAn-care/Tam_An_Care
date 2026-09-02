BEGIN;

CREATE TABLE operational_work_event_type_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type text NOT NULL
    CHECK (
      event_type IN (
        'WORK_EVENT_TYPE_CREATED',
        'WORK_EVENT_TYPE_UPDATED'
      )
    ),

  target_work_event_type_id text NOT NULL
    REFERENCES operational_work_event_types(work_event_type_id),

  performed_by text NOT NULL,
  performed_by_role text NOT NULL,

  previous_value jsonb,
  new_value jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operational_work_event_type_audit_target_created
  ON operational_work_event_type_audit (
    target_work_event_type_id,
    created_at
  );

COMMIT;
