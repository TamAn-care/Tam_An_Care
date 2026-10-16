BEGIN;

CREATE TABLE IF NOT EXISTS public.resident_demographic_audit (
    audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL
      CHECK (event_type = 'RESIDENT_DEMOGRAPHICS_CORRECTED'),
    target_resident_id text NOT NULL,
    performed_by text NOT NULL,
    performed_by_role text NOT NULL,
    reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
    previous_value jsonb NOT NULL,
    new_value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  resident_demographic_audit_resident_time_idx
ON public.resident_demographic_audit
  (target_resident_id, created_at DESC);

COMMIT;
