BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM guardian_auth_audit)
     OR EXISTS (SELECT 1 FROM guardian_resident_links)
     OR EXISTS (SELECT 1 FROM guardian_sessions)
     OR EXISTS (SELECT 1 FROM guardian_credentials)
     OR EXISTS (SELECT 1 FROM guardian_identities) THEN
    RAISE EXCEPTION 'GUARDIAN_AUTH_ROLLBACK_REFUSED_WHILE_DATA_EXISTS';
  END IF;
END;
$guard$;
DROP TABLE guardian_auth_audit;
DROP TABLE guardian_resident_links;
DROP TABLE guardian_sessions;
DROP TABLE guardian_credentials;
DROP TABLE guardian_identities;
COMMIT;
