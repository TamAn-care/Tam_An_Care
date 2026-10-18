Production secret delivery

Provision these files outside the Git repository and outside web roots:
- PostgreSQL bootstrap password
- API database URL
- JWT signing key

Pass their absolute paths to Docker Compose as TAMANCARE_POSTGRES_PASSWORD_FILE,
TAMANCARE_DATABASE_URL_FILE, and TAMANCARE_JWT_SECRET_FILE. Keep the path-only
Compose environment file outside the repository and supply it explicitly with
`docker compose --env-file /etc/tamancare/production-secret-paths.env ...` or via
the protected operator environment. This file contains paths only, never secret
values.

Secret files must be regular files, not symlinks, owned by the designated
operator/service identity, and mode 0400 or 0600 (no group/other access). Parent
directories must be restricted to the operator/service group. The API and
operational PostgreSQL scripts fail closed when the database URL secret is
missing, empty, a symlink, or has group/other permission bits.

Separate application, migration, and backup roles where the deployed privilege
model permits. Do not rotate or change live roles as part of source deployment.
TLS private keys must also remain outside source control.
