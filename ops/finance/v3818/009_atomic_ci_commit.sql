-- V3.8.18.9 — ISOLATED CI ONLY. Never run against Production Test.
-- Executed after 008_isolated_checkpoint_claims.sql in ephemeral finance_ci.
BEGIN;
CREATE TABLE finance_sync_ci.ledger_ci (
 ledger_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 financial_origin text NOT NULL UNIQUE,
 source_key text NOT NULL UNIQUE,
 entry_type text NOT NULL CHECK (entry_type IN
 ('REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX')),
 recognition_date date NOT NULL,
 amount_vnd numeric(18,0) NOT NULL CHECK(amount_vnd >= 0),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION finance_sync_ci.commit_verified_ci(
 p_adapter text,p_cursor numeric,p_origin text,p_source_key text,
 p_source_version text,p_digest text,p_entry_type text,p_recognition_date date,
 p_amount numeric,p_approved boolean,p_evidence boolean,p_reconciled boolean,
 p_inject_failure boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE prior finance_sync_ci.source_observations%ROWTYPE;
 existing finance_sync_ci.ledger_ci%ROWTYPE;
 old_cursor numeric;
 new_ledger_id bigint;
BEGIN
 IF p_adapter IS NULL OR p_adapter !~ '^[A-Z][A-Z0-9_]{0,63}$'
 OR p_origin IS NULL OR p_origin !~ '^[A-Za-z0-9_-]{1,160}$'
 OR p_source_key IS NULL OR p_source_key !~ '^[A-Za-z0-9_:-]{1,200}$'
 OR p_source_version IS NULL OR p_source_version !~ '^[A-Za-z0-9_-]{1,160}$'
 OR p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$'
 OR p_cursor IS NULL OR p_cursor < 0 OR p_cursor<>trunc(p_cursor)
 OR p_entry_type IS NULL OR p_entry_type NOT IN
 ('REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX')
 OR p_recognition_date IS NULL
 OR p_amount IS NULL OR p_amount < 0 OR p_amount<>trunc(p_amount)
 OR p_amount > 9999999999999999
 OR p_approved IS DISTINCT FROM true OR p_evidence IS DISTINCT FROM true
 OR p_reconciled IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'FINANCE_CI_UNVERIFIED_OR_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('V38189:'||p_adapter,0));
 SELECT cursor_value INTO old_cursor FROM finance_sync_ci.checkpoints
 WHERE adapter_id=p_adapter FOR UPDATE;
 IF old_cursor IS NOT NULL AND p_cursor < old_cursor
 THEN RAISE EXCEPTION 'FINANCE_CI_CURSOR_REGRESSION'; END IF;
 SELECT * INTO prior FROM finance_sync_ci.source_observations
 WHERE source_key=p_source_key FOR UPDATE;
 IF FOUND AND (prior.source_version<>p_source_version OR prior.source_digest<>p_digest)
 THEN RAISE EXCEPTION 'FINANCE_CI_CHANGED_SOURCE'; END IF;
 SELECT * INTO existing FROM finance_sync_ci.ledger_ci
 WHERE financial_origin=p_origin OR source_key=p_source_key FOR UPDATE;
 IF FOUND THEN
  IF existing.financial_origin<>p_origin OR existing.source_key<>p_source_key
    OR existing.entry_type<>p_entry_type OR existing.recognition_date<>p_recognition_date
    OR existing.amount_vnd<>p_amount
  THEN RAISE EXCEPTION 'FINANCE_CI_FINANCIAL_ORIGIN_CONFLICT'; END IF;
  RETURN 'ALREADY_POSTED';
 END IF;
 INSERT INTO finance_sync_ci.posting_claims(financial_origin,source_key)
 VALUES(p_origin,p_source_key) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM finance_sync_ci.posting_claims
   WHERE financial_origin=p_origin AND source_key=p_source_key)
 THEN RAISE EXCEPTION 'FINANCE_CI_CLAIM_CONFLICT'; END IF;
 INSERT INTO finance_sync_ci.ledger_ci
 (financial_origin,source_key,entry_type,recognition_date,amount_vnd)
 VALUES(p_origin,p_source_key,p_entry_type,p_recognition_date,p_amount)
 RETURNING ledger_id INTO new_ledger_id;
 INSERT INTO finance_sync_ci.source_observations(source_key,source_version,source_digest,posted)
 VALUES(p_source_key,p_source_version,p_digest,true)
 ON CONFLICT(source_key) DO UPDATE SET posted=true;
 UPDATE finance_sync_ci.posting_claims SET ledger_entry_id=new_ledger_id::text
 WHERE financial_origin=p_origin AND source_key=p_source_key;
 INSERT INTO finance_sync_ci.audit_events(financial_origin,action)
 VALUES(p_origin,'CI_ATOMIC_POST');
 IF p_inject_failure THEN RAISE EXCEPTION 'FINANCE_CI_INJECTED_FAILURE'; END IF;
 INSERT INTO finance_sync_ci.checkpoints(adapter_id,cursor_value)
 VALUES(p_adapter,p_cursor)
 ON CONFLICT(adapter_id) DO UPDATE SET cursor_value=GREATEST(
 finance_sync_ci.checkpoints.cursor_value,EXCLUDED.cursor_value),
 updated_at=now();
 RETURN 'COMMITTED_CI_ONLY';
END $$;
COMMIT;
