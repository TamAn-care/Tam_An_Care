CREATE TABLE public.staff_actors (
  actor_id text PRIMARY KEY,
  staff_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  primary_operational_role text NOT NULL,
  status text NOT NULL,
  employment_reference text,
  department text NOT NULL DEFAULT 'CI',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.auth_credentials (
  actor_id text PRIMARY KEY REFERENCES public.staff_actors(actor_id),
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  password_iterations integer NOT NULL CHECK (password_iterations >= 100000),
  password_digest text NOT NULL DEFAULT 'sha256',
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.auth_sessions (
  session_id text PRIMARY KEY,
  actor_id text NOT NULL REFERENCES public.staff_actors(actor_id),
  actor_role text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text,
  CHECK (expires_at > issued_at)
);
