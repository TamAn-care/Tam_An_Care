TamAnCare production secrets directory.

DO NOT commit real secret values.

Required runtime secrets:
- postgres_password
- database_url
- jwt_secret

Production deployment must provision these files outside source control.

JWT secret must satisfy the application's production minimum-length policy.

DATABASE_URL must point to the production PostgreSQL service.

TLS private keys must never be committed to this repository.
