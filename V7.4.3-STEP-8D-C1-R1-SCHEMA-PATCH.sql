CREATE TABLE resident_access_assignments (
  resident_access_assignment_id TEXT PRIMARY KEY,

  resident_id TEXT NOT NULL
    REFERENCES residents(resident_id),

  actor_id TEXT NOT NULL,

  actor_role TEXT NOT NULL
    CHECK (
      actor_role IN ('CAREGIVER','NURSE')
    ),

  access_scope TEXT NOT NULL
    CHECK (
      access_scope IN ('DIRECT_CARE','CLINICAL_CARE')
    ),

  status TEXT NOT NULL
    CHECK (
      status IN ('ACTIVE','REVOKED')
    ),

  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,

  assigned_by TEXT NOT NULL,
  assigned_by_role TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL,

  revoked_by TEXT,
  revoked_by_role TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT resident_access_role_scope_check
    CHECK (
      (
        actor_role='CAREGIVER'
        AND access_scope='DIRECT_CARE'
      )
      OR
      (
        actor_role='NURSE'
        AND access_scope='CLINICAL_CARE'
      )
    ),

  CONSTRAINT resident_access_effective_interval_check
    CHECK (
      effective_to IS NULL
      OR effective_to > effective_from
    ),

  CONSTRAINT resident_access_revocation_check
    CHECK (
      (
        status='ACTIVE'
        AND revoked_at IS NULL
      )
      OR
      (
        status='REVOKED'
        AND revoked_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX uq_resident_access_active_grant
ON resident_access_assignments (
  resident_id,
  actor_id,
  actor_role,
  access_scope
)
WHERE status='ACTIVE';

CREATE INDEX idx_resident_access_authorization
ON resident_access_assignments (
  actor_id,
  actor_role,
  status,
  resident_id
);

CREATE INDEX idx_resident_access_resident_admin
ON resident_access_assignments (
  resident_id,
  status,
  actor_id
);
