BEGIN;

CREATE TABLE IF NOT EXISTS guardian_principals (
  guardian_principal_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REVOKED', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guardian_sessions (
  session_id TEXT PRIMARY KEY,
  guardian_principal_id TEXT NOT NULL
    REFERENCES guardian_principals(guardian_principal_id)
    ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guardian_sessions_expiry_check
    CHECK (expires_at > issued_at),
  CONSTRAINT guardian_sessions_revocation_check
    CHECK (
      (revoked_at IS NULL AND revoked_reason IS NULL)
      OR revoked_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_guardian_sessions_active
  ON guardian_sessions(guardian_principal_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS guardian_resident_relationships (
  relationship_id TEXT PRIMARY KEY,
  guardian_principal_id TEXT NOT NULL
    REFERENCES guardian_principals(guardian_principal_id),
  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),
  status TEXT NOT NULL
    CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  permissions TEXT[] NOT NULL
    DEFAULT ARRAY['health_report:view']::TEXT[],
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guardian_relationship_interval_check
    CHECK (
      effective_until IS NULL
      OR effective_until > effective_from
    ),
  CONSTRAINT guardian_relationship_status_check
    CHECK (
      (status = 'ACTIVE' AND revoked_at IS NULL)
      OR (status IN ('REVOKED', 'EXPIRED'))
    ),
  CONSTRAINT guardian_relationship_permission_check
    CHECK (cardinality(permissions) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_guardian_active_relationship
  ON guardian_resident_relationships(
    guardian_principal_id,
    resident_id
  )
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_guardian_relationship_lookup
  ON guardian_resident_relationships(
    guardian_principal_id,
    resident_id,
    status,
    effective_from,
    effective_until
  );

-- Extend the canonical staff/assignment contracts for approved
-- professional roles without granting access by role alone.
ALTER TABLE staff_actors
  DROP CONSTRAINT IF EXISTS staff_actors_role_check;

ALTER TABLE staff_actors
  ADD CONSTRAINT staff_actors_role_check
  CHECK (
    primary_operational_role IN (
      'CAREGIVER', 'NURSE', 'SUPERVISOR', 'CARE_MANAGER',
      'MEDICAL_HEAD', 'PSYCHOLOGIST', 'SOCIAL_WORKER'
    )
  );

ALTER TABLE auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_role_check;

ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_role_check
  CHECK (
    actor_role IN (
      'CAREGIVER', 'NURSE', 'SUPERVISOR', 'CARE_MANAGER',
      'MEDICAL_HEAD', 'PSYCHOLOGIST', 'SOCIAL_WORKER'
    )
  );

ALTER TABLE resident_access_assignments
  DROP CONSTRAINT IF EXISTS resident_access_assignments_actor_role_check;

ALTER TABLE resident_access_assignments
  ADD CONSTRAINT resident_access_assignments_actor_role_check
  CHECK (
    actor_role IN ('CAREGIVER', 'NURSE', 'PSYCHOLOGIST', 'SOCIAL_WORKER')
  );

ALTER TABLE resident_access_assignments
  DROP CONSTRAINT IF EXISTS resident_access_assignments_access_scope_check;

ALTER TABLE resident_access_assignments
  ADD CONSTRAINT resident_access_assignments_access_scope_check
  CHECK (
    access_scope IN ('DIRECT_CARE', 'CLINICAL_CARE', 'PSYCHOSOCIAL_CARE')
  );

ALTER TABLE resident_access_assignments
  DROP CONSTRAINT IF EXISTS resident_access_role_scope_check;

ALTER TABLE resident_access_assignments
  ADD CONSTRAINT resident_access_role_scope_check
  CHECK (
    (
      actor_role = 'CAREGIVER'
      AND access_scope = 'DIRECT_CARE'
    )
    OR (
      actor_role = 'NURSE'
      AND access_scope = 'CLINICAL_CARE'
    )
    OR (
      actor_role IN ('PSYCHOLOGIST', 'SOCIAL_WORKER')
      AND access_scope = 'PSYCHOSOCIAL_CARE'
    )
  );

COMMIT;
