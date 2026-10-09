-- V3.8.6 isolated CI-only transaction rollback and audit cohesion.
-- Uses the V3.8.2 schema already created inside ephemeral finance_ci.
CREATE FUNCTION finance_v386_atomic_failure_probe(p_document text,p_revision bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM finance_v382_transition(p_document,p_revision,'REVIEW','CI_CHECKER','Controlled rollback audit test');
 RAISE EXCEPTION 'FINANCE_V386_INJECTED_FAILURE';
END $$;
REVOKE ALL ON FUNCTION finance_v386_atomic_failure_probe(text,bigint) FROM PUBLIC;
