BEGIN;

CREATE TABLE operational_work_event_audit (
    audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_type text NOT NULL,

    target_work_event_id text NOT NULL,

    performed_by text NOT NULL,

    performed_by_role text NOT NULL,

    previous_value jsonb,

    new_value jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT operational_work_event_audit_event_type_ck
      CHECK (
        event_type IN (
          'WORK_EVENT_CREATED',
          'WORK_EVENT_VERIFIED',
          'WORK_EVENT_AMENDED',
          'WORK_EVENT_VOIDED'
        )
      ),

    CONSTRAINT operational_work_event_audit_target_fkey
      FOREIGN KEY (target_work_event_id)
      REFERENCES operational_work_events(work_event_id)
      ON DELETE RESTRICT,

    CONSTRAINT operational_work_event_audit_actor_fkey
      FOREIGN KEY (performed_by)
      REFERENCES staff_actors(actor_id)
      ON DELETE RESTRICT,

    CONSTRAINT operational_work_event_audit_role_ck
      CHECK (
        performed_by_role IN (
          'CAREGIVER',
          'NURSE',
          'CARE_MANAGER',
          'SUPERVISOR'
        )
      )
);

CREATE INDEX idx_ops_work_event_audit_target_created
ON operational_work_event_audit (
    target_work_event_id,
    created_at
);

CREATE INDEX idx_ops_work_event_audit_actor_created
ON operational_work_event_audit (
    performed_by,
    created_at
);

COMMIT;
