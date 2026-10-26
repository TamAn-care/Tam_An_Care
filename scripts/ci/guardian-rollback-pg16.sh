#!/usr/bin/env bash
set -Eeuo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGDATABASE:?PGDATABASE is required}"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration_file="${root_dir}/database/migrations/20261026_001_guardian_identity_relationships.sql"
test -r "${migration_file}"

work_dir="${RUNNER_TEMP:-/tmp}/guardian-rollback-pg16"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"

psql_safe() {
  psql -X -v ON_ERROR_STOP=1 "$@"
}

rollback_db="taman_care_rollback_ci"

cleanup() {
  dropdb --if-exists "${rollback_db}" >/dev/null 2>&1 || true
  psql -X -v ON_ERROR_STOP=0 -d "${PGDATABASE}" -c 'DROP SCHEMA IF EXISTS rollback_fixture CASCADE;' >/dev/null 2>&1 || true
  rm -rf "${work_dir}"
}
trap cleanup EXIT

psql_safe -d postgres -c "DROP DATABASE IF EXISTS \"${rollback_db}\";"

psql_safe <<'SQL'
DROP SCHEMA IF EXISTS rollback_fixture CASCADE;
CREATE SCHEMA rollback_fixture;
SET search_path TO rollback_fixture, public;

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
  effective_to timestamptz
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
INSERT INTO residents VALUES ('synthetic-resident-1', true), ('synthetic-resident-2', true);
INSERT INTO staff_actors(actor_id, primary_operational_role)
VALUES ('synthetic-staff-1', 'CAREGIVER');
SQL

baseline_dump="${work_dir}/baseline.dump"
globals_dump="${work_dir}/globals.sql"
corrupt_dump="${work_dir}/baseline-corrupt.dump"

pg_dump --format=custom --schema=rollback_fixture --file="${baseline_dump}"
pg_restore --list "${baseline_dump}" >/dev/null
pg_dumpall --globals-only --no-role-passwords > "${globals_dump}"
test -s "${globals_dump}"
grep -q '^-- PostgreSQL database cluster dump' "${globals_dump}"
! grep -Eiq '(^|[[:space:]])PASSWORD[[:space:]]' "${globals_dump}"

psql_safe <<SQL
SET search_path TO rollback_fixture, public;
\\i ${migration_file}
SQL

psql_safe <<'SQL'
SET search_path TO rollback_fixture, public;
INSERT INTO guardian_principals(guardian_principal_id)
VALUES ('synthetic-guardian-1');
INSERT INTO guardian_sessions(
  session_id, guardian_principal_id, issued_at, expires_at
) VALUES (
  'synthetic-guardian-session-1', 'synthetic-guardian-1', now(), now() + interval '1 hour'
);
INSERT INTO guardian_resident_relationships(
  relationship_id, guardian_principal_id, resident_id,
  status, effective_from, granted_by
) VALUES (
  'synthetic-relationship-1', 'synthetic-guardian-1', 'synthetic-resident-1',
  'ACTIVE', now() - interval '1 minute', 'synthetic-manager'
);
SELECT 1 FROM guardian_resident_relationships
WHERE relationship_id='synthetic-relationship-1';
SQL

createdb -T template0 "${rollback_db}"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="${rollback_db}" "${baseline_dump}"
pg_restore --list "${baseline_dump}" >/dev/null

test "$(psql_safe -d "${rollback_db}" -XAtqc "select count(*) from rollback_fixture.residents")" = 2
test "$(psql_safe -d "${rollback_db}" -XAtqc "select count(*) from rollback_fixture.staff_actors")" = 1
test "$(psql_safe -d "${rollback_db}" -XAtqc "select to_regclass('rollback_fixture.guardian_resident_relationships') is null")" = t

cp "${baseline_dump}" "${corrupt_dump}"
truncate -s -1 "${corrupt_dump}"
if pg_restore --list "${corrupt_dump}" >/dev/null 2>&1; then
  echo 'corrupt archive unexpectedly validated' >&2
  exit 1
fi

echo "PG16_VERSION=$(psql_safe -XAtqc 'show server_version_num')"
echo "SYNTHETIC_BACKUP=PASS"
echo "SYNTHETIC_GLOBALS_EXPORT=PASS"
echo "SYNTHETIC_POST_MIGRATION=PASS"
echo "SYNTHETIC_BASELINE_RESTORE=PASS"
echo "SYNTHETIC_ROLLBACK=PASS"
echo "SYNTHETIC_CORRUPT_ARCHIVE_REJECTION=PASS"
echo "REAL_DATA=NOT_USED"
