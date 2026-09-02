CREATE TABLE auth_credentials (
  actor_id text PRIMARY KEY
    REFERENCES staff_actors(actor_id)
    ON DELETE CASCADE,

  password_hash text NOT NULL,
  password_salt text NOT NULL,

  password_iterations integer
    NOT NULL,

  password_digest text
    NOT NULL
    DEFAULT 'sha256',

  failed_attempts integer
    NOT NULL
    DEFAULT 0,

  locked_until timestamptz NULL,

  password_changed_at timestamptz
    NOT NULL
    DEFAULT now(),

  last_login_at timestamptz NULL,

  created_at timestamptz
    NOT NULL
    DEFAULT now(),

  updated_at timestamptz
    NOT NULL
    DEFAULT now(),

  CONSTRAINT auth_credentials_iterations_ck
    CHECK (
      password_iterations >= 100000
    )
);
