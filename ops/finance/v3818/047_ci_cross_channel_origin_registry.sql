-- V3.8.18.47: CI-only cross-channel financial-origin exclusion.
BEGIN;
DO $$ BEGIN IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF; END $$;
CREATE TABLE finance_manual_v26_ci.origin_registry_v47(
 origin_key text PRIMARY KEY,
 channel text NOT NULL CHECK(channel IN ('MANUAL','SYSTEM')),
 source_domain text NOT NULL,
 source_entity_type text NOT NULL,
 source_entity_id text NOT NULL,
 canonical_entry_type text NOT NULL CHECK(canonical_entry_type IN ('REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX')),
 document_id text,
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((channel='MANUAL' AND document_id IS NOT NULL) OR (channel='SYSTEM' AND document_id IS NULL))
);
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.register_origin_v47(
 p_origin text,p_channel text,p_domain text,p_entity_type text,p_entity_id text,p_kind text,p_document_id text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_origin IS NULL OR length(btrim(p_origin))=0 OR p_domain IS NULL OR length(btrim(p_domain))=0
 OR p_entity_type IS NULL OR length(btrim(p_entity_type))=0
 OR p_entity_id IS NULL OR length(btrim(p_entity_id))=0
 OR p_channel NOT IN ('MANUAL','SYSTEM')
 OR p_kind NOT IN ('REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX')
 THEN RAISE EXCEPTION 'ORIGIN_IDENTITY_INVALID'; END IF;
 INSERT INTO finance_manual_v26_ci.origin_registry_v47(origin_key,channel,source_domain,source_entity_type,source_entity_id,canonical_entry_type,document_id)
 VALUES(p_origin,p_channel,p_domain,p_entity_type,p_entity_id,p_kind,p_document_id);
 RETURN p_origin;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'CROSS_CHANNEL_ORIGIN_ALREADY_REGISTERED';
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.register_origin_v47(text,text,text,text,text,text,text) FROM PUBLIC;
COMMIT;
