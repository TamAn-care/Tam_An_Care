BEGIN;

-- Guardian principals are a separate identity domain. They are never staff_actors.
CREATE TABLE guardian_identities (
  guardian_id TEXT PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guardian_login_id_normalized_ck CHECK (login_id = lower(btrim(login_id))),
  CONSTRAINT guardian_display_name_ck CHECK (length(btrim(display_name)) > 0)
);

CREATE TABLE guardian_credentials (
  guardian_id TEXT PRIMARY KEY REFERENCES guardian_identities(guardian_id) ON DELETE RESTRICT,
  password_hash TEXT NOT NULL CHECK (password_hash ~ '^[0-9a-f]{64}$'),
  password_salt TEXT NOT NULL CHECK (password_salt ~ '^[0-9a-f]{48,128}$'),
  password_iterations INTEGER NOT NULL CHECK (password_iterations BETWEEN 100000 AND 1000000),
  password_digest TEXT NOT NULL CHECK (password_digest = 'sha256'),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 1000000),
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guardian_sessions (
  session_id TEXT PRIMARY KEY,
  guardian_id TEXT NOT NULL REFERENCES guardian_identities(guardian_id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guardian_sessions_expiry_ck CHECK (expires_at > issued_at),
  CONSTRAINT guardian_sessions_revocation_ck CHECK (
    (revoked_at IS NULL AND revoked_reason IS NULL) OR revoked_at IS NOT NULL
  )
);
CREATE INDEX guardian_sessions_active_idx
  ON guardian_sessions(guardian_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE guardian_resident_links (
  guardian_resident_link_id TEXT PRIMARY KEY,
  guardian_id TEXT NOT NULL REFERENCES guardian_identities(guardian_id) ON DELETE RESTRICT,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','REVOKED')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guardian_link_interval_ck CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT guardian_link_state_ck CHECK (
    (status='ACTIVE' AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (status='REVOKED' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);
CREATE UNIQUE INDEX guardian_resident_one_active_link_idx
  ON guardian_resident_links(guardian_id, resident_id) WHERE status='ACTIVE';
CREATE INDEX guardian_resident_scope_idx
  ON guardian_resident_links(guardian_id, status, effective_from, effective_to, resident_id);

CREATE TABLE guardian_auth_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id TEXT REFERENCES guardian_identities(guardian_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('LOGIN_SUCCEEDED','LOGIN_FAILED','SESSION_REVOKED')),
  session_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX guardian_auth_audit_guardian_time_idx
  ON guardian_auth_audit(guardian_id, occurred_at);

COMMIT;
