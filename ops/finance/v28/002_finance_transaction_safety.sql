-- TamanCare Finance V2.8 — development-only.
-- Never auto-run against Production Test.
-- No seed, no demo, no changes to existing resident rows.
CREATE TABLE IF NOT EXISTS public.finance_operation_idempotency (
  operation_key TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  request_hash CHAR(64) NOT NULL,
  actor_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS','COMPLETED')),
  result_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK (
    (status='IN_PROGRESS' AND completed_at IS NULL)
    OR (status='COMPLETED' AND completed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.finance_operation_audit (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_key TEXT NOT NULL
    REFERENCES public.finance_operation_idempotency(operation_key),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS finance_operation_audit_key_idx
 ON public.finance_operation_audit(operation_key);