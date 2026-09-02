BEGIN;

CREATE TABLE auth_sessions (
  session_id text PRIMARY KEY,
  actor_id text NOT NULL
    REFERENCES staff_actors(actor_id)
    ON DELETE CASCADE,

  actor_role text NOT NULL,

  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,

  revoked_at timestamptz NULL,
  revoked_reason text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT auth_sessions_role_check
    CHECK (
      actor_role IN (
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR'
      )
    ),

  CONSTRAINT auth_sessions_expiry_check
    CHECK (expires_at > issued_at),

  CONSTRAINT auth_sessions_revocation_check
    CHECK (
      (revoked_at IS NULL AND revoked_reason IS NULL)
      OR
      (revoked_at IS NOT NULL)
    )
);

CREATE INDEX idx_auth_sessions_actor_active
  ON auth_sessions(actor_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_sessions_expiry
  ON auth_sessions(expires_at);

COMMIT;
