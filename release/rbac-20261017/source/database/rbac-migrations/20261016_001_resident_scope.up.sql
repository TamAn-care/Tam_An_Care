-- Version 20261016_001_resident_scope. Transaction/version/checksum managed by the runner.
-- Test databases only; Production Test requires separate owner approval.
-- No accounts, assignments, credentials or resident data are created.
DO $guard$
BEGIN
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='resident_access_assignments'::regclass AND conname='resident_access_assignments_actor_role_check') IS DISTINCT FROM $expected$CHECK ((actor_role = ANY (ARRAY['CAREGIVER'::text, 'NURSE'::text])))$expected$ THEN
    RAISE EXCEPTION 'Schema drift: resident_access_assignments_actor_role_check';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='resident_access_assignments'::regclass AND conname='resident_access_assignments_access_scope_check') IS DISTINCT FROM $expected$CHECK ((access_scope = ANY (ARRAY['DIRECT_CARE'::text, 'CLINICAL_CARE'::text])))$expected$ THEN
    RAISE EXCEPTION 'Schema drift: resident_access_assignments_access_scope_check';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='resident_access_assignments'::regclass AND conname='resident_access_role_scope_check') IS DISTINCT FROM $expected$CHECK ((((actor_role = 'CAREGIVER'::text) AND (access_scope = 'DIRECT_CARE'::text)) OR ((actor_role = 'NURSE'::text) AND (access_scope = 'CLINICAL_CARE'::text))))$expected$ THEN
    RAISE EXCEPTION 'Schema drift: resident_access_role_scope_check';
  END IF;
END;
$guard$;
ALTER TABLE resident_access_assignments DROP CONSTRAINT resident_access_assignments_actor_role_check;
ALTER TABLE resident_access_assignments ADD CONSTRAINT resident_access_assignments_actor_role_check CHECK (actor_role IN ('CAREGIVER','NURSE','GUARDIAN','PSYCHOLOGIST','SOCIAL_WORKER'));
ALTER TABLE resident_access_assignments DROP CONSTRAINT resident_access_assignments_access_scope_check;
ALTER TABLE resident_access_assignments ADD CONSTRAINT resident_access_assignments_access_scope_check CHECK (access_scope IN ('DIRECT_CARE','CLINICAL_CARE','FAMILY_PORTAL','PSYCHOSOCIAL_CARE'));
ALTER TABLE resident_access_assignments DROP CONSTRAINT resident_access_role_scope_check;
ALTER TABLE resident_access_assignments ADD CONSTRAINT resident_access_role_scope_check CHECK ((actor_role='CAREGIVER' AND access_scope='DIRECT_CARE') OR (actor_role='NURSE' AND access_scope='CLINICAL_CARE') OR (actor_role='GUARDIAN' AND access_scope='FAMILY_PORTAL') OR (actor_role IN ('PSYCHOLOGIST','SOCIAL_WORKER') AND access_scope='PSYCHOSOCIAL_CARE'));
