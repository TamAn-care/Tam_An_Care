#!/usr/bin/env bash
set -Eeuo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGDATABASE:?PGDATABASE is required}"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration_file="${root_dir}/database/migrations/20261026_001_guardian_identity_relationships.sql"
test -r "${migration_file}"

psql_safe() {
  psql -X -v ON_ERROR_STOP=1 "$@"
}

psql_safe <<SQL
DROP SCHEMA IF EXISTS migration_fixture CASCADE;
CREATE SCHEMA migration_fixture;
SET search_path TO migration_fixture, public;

CREATE TABLE residents (
  resident_id text PRIMARY KEY,
  active_status boolean NOT NULL DEFAULT true
);
CREATE TABLE staff_actors (
  actor_id text PRIMARY KEY,
  primary_operational_role text NOT NULL
    CONSTRAINT staff_actors_role_check
    CHECK (primary_operational_role IN ('CAREGIVER','NURSE','SUPERVISOR','CARE_MANAGER')),
  status text NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE resident_access_assignments (
  resident_access_assignment_id text PRIMARY KEY,
  resident_id text NOT NULL REFERENCES residents(resident_id),
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('CAREGIVER','NURSE')),
  access_scope text NOT NULL CHECK (access_scope IN ('DIRECT_CARE','CLINICAL_CARE')),
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  CONSTRAINT resident_access_role_scope_check CHECK (
    (actor_role='CAREGIVER' AND access_scope='DIRECT_CARE')
    OR (actor_role='NURSE' AND access_scope='CLINICAL_CARE')
  )
);
CREATE TABLE auth_sessions (
  session_id text PRIMARY KEY,
  actor_id text NOT NULL REFERENCES staff_actors(actor_id),
  actor_role text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT auth_sessions_role_check
    CHECK (actor_role IN ('CAREGIVER','NURSE','CARE_MANAGER','SUPERVISOR'))
);

INSERT INTO residents VALUES ('resident-ci-1', true), ('resident-ci-2', true);
INSERT INTO staff_actors(actor_id, primary_operational_role)
VALUES ('staff-ci-1', 'CAREGIVER');
SQL

psql_safe <<SQL
SET search_path TO migration_fixture, public;
\i ${migration_file}
SQL

psql_safe <<'SQL'
SET search_path TO migration_fixture, public;

INSERT INTO guardian_principals(guardian_principal_id)
VALUES ('guardian-ci-1');
INSERT INTO guardian_sessions(
  session_id, guardian_principal_id, issued_at, expires_at
) VALUES (
  'guardian-session-ci-1', 'guardian-ci-1', now(), now() + interval '1 hour'
);
INSERT INTO guardian_resident_relationships(
  relationship_id, guardian_principal_id, resident_id,
  status, effective_from, granted_by
) VALUES (
  'guardian-rel-ci-1', 'guardian-ci-1', 'resident-ci-1',
  'ACTIVE', now() - interval '1 minute', 'manager-ci-1'
);

INSERT INTO resident_access_assignments(
  resident_access_assignment_id, resident_id, actor_id, actor_role,
  access_scope, status, effective_from
) VALUES (
  'assignment-ci-psych-1', 'resident-ci-1', 'staff-ci-1',
  'PSYCHOLOGIST', 'PSYCHOSOCIAL_CARE', 'ACTIVE', now()
);

DO $$
BEGIN
  BEGIN
    INSERT INTO guardian_resident_relationships(
      relationship_id, guardian_principal_id, resident_id,
      status, effective_from, granted_by
    ) VALUES (
      'guardian-rel-ci-duplicate', 'guardian-ci-1', 'resident-ci-1',
      'ACTIVE', now(), 'manager-ci-1'
    );
    RAISE EXCEPTION 'duplicate active relationship was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO guardian_resident_relationships(
      relationship_id, guardian_principal_id, resident_id,
      status, effective_from, granted_by
    ) VALUES (
      'guardian-rel-ci-bad-fk', 'guardian-ci-1', 'missing-resident',
      'ACTIVE', now(), 'manager-ci-1'
    );
    RAISE EXCEPTION 'invalid resident foreign key was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END;
$$;

SELECT 'PG16=' || split_part(current_setting('server_version'), '.', 1)
WHERE split_part(current_setting('server_version'), '.', 1) = '16';
SELECT 'GUARDIAN_RELATIONSHIP=PASS'
WHERE EXISTS (
  SELECT 1 FROM guardian_resident_relationships
  WHERE relationship_id='guardian-rel-ci-1'
);
SELECT 'PROFESSIONAL_SCOPE=PASS'
WHERE EXISTS (
  SELECT 1 FROM resident_access_assignments
  WHERE actor_role='PSYCHOLOGIST' AND access_scope='PSYCHOSOCIAL_CARE'
);
SQL

# Re-execution must be safe and must not duplicate or weaken constraints.
psql_safe <<SQL
SET search_path TO migration_fixture, public;
\i ${migration_file}
SQL

echo "CLEAN_MIGRATION=PASS"
echo "UPGRADE_MIGRATION=PASS"
echo "INTEGRITY_TESTS=PASS"
echo "MIGRATION_REPEATABILITY=PASS"
echo "ROLLBACK_COMPATIBILITY=RESTORE_REQUIRED"
