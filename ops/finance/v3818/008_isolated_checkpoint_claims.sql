-- V3.8.18.8 ISOLATED CI DESIGN ONLY. NEVER APPLY TO PRODUCTION.
-- All records must originate from approved REAL source adapters; no seed.
BEGIN;
CREATE SCHEMA IF NOT EXISTS finance_sync_ci;
CREATE TABLE finance_sync_ci.checkpoints (
 adapter_id text PRIMARY KEY,
 cursor_value numeric(38,0) NOT NULL CHECK(cursor_value >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE finance_sync_ci.source_observations (
 source_key text PRIMARY KEY,
 source_version text NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 posted boolean NOT NULL DEFAULT false
);
CREATE TABLE finance_sync_ci.posting_claims (
 financial_origin text PRIMARY KEY,
 source_key text NOT NULL UNIQUE,
 ledger_entry_id text UNIQUE,
 claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE finance_sync_ci.audit_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 financial_origin text NOT NULL,
 action text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now()
);
-- CI-only function requires an explicit claim and advances the cursor in the
-- SAME transaction; real production authorization and DB integration NOT ready.
CREATE FUNCTION finance_sync_ci.claim_source(
 p_adapter text,p_cursor numeric,p_origin text,p_source_key text,
 p_source_version text,p_digest text
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_cursor numeric; prior finance_sync_ci.source_observations%ROWTYPE;
BEGIN
 IF p_adapter IS NULL OR p_origin IS NULL OR p_source_key IS NULL
    OR p_source_version IS NULL OR p_digest !~ '^[0-9a-f]{64}$'
    OR p_cursor IS NULL OR p_cursor < 0 THEN
   RAISE EXCEPTION 'INVALID_SOURCE';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_adapter,0));
 SELECT cursor_value INTO current_cursor FROM finance_sync_ci.checkpoints WHERE adapter_id=p_adapter FOR UPDATE;
 IF current_cursor IS NOT NULL AND p_cursor < current_cursor THEN RAISE EXCEPTION 'CURSOR_REGRESSION'; END IF;
 SELECT * INTO prior FROM finance_sync_ci.source_observations WHERE source_key=p_source_key FOR UPDATE;
 IF FOUND THEN
  IF prior.source_version<>p_source_version OR prior.source_digest<>p_digest THEN
   RAISE EXCEPTION 'SOURCE_CHANGED_REQUIRES_RECONCILIATION';
  END IF;
 END IF;
 INSERT INTO finance_sync_ci.posting_claims(financial_origin,source_key)
 VALUES (p_origin,p_source_key) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM finance_sync_ci.posting_claims
                WHERE financial_origin=p_origin AND source_key=p_source_key)
  THEN RAISE EXCEPTION 'FINANCIAL_ORIGIN_CONFLICT'; END IF;
 END IF;
 INSERT INTO finance_sync_ci.source_observations(source_key,source_version,source_digest)
 VALUES(p_source_key,p_source_version,p_digest) ON CONFLICT(source_key) DO NOTHING;
 INSERT INTO finance_sync_ci.checkpoints(adapter_id,cursor_value)
 VALUES(p_adapter,p_cursor)
 ON CONFLICT(adapter_id) DO UPDATE SET cursor_value=GREATEST(finance_sync_ci.checkpoints.cursor_value,EXCLUDED.cursor_value);
 INSERT INTO finance_sync_ci.audit_events(financial_origin,action) VALUES(p_origin,'CLAIM_ONLY');
 RETURN 'CLAIM_ONLY_NOT_POSTED';
END $$;
COMMIT;
