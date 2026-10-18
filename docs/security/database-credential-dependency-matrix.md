# Database credential dependency matrix

This is a source-level inventory. It does not establish the current Production Test credential value or runtime state.

| Consumer | Source/config | Credential input | Purpose | Current evidence |
| --- | --- | --- | --- | --- |
| API services and bootstrap | `api/src/database/database-connection.ts` and API services | `DATABASE_URL_FILE` in production; compatibility `DATABASE_URL` fallback | Application queries | Source and isolated PG16 CI pass at the Finance candidate SHA |
| PostgreSQL container initialization | `deploy/production/docker-compose.production.yml` | `POSTGRES_PASSWORD_FILE` | Initial database role setup | Compose source points to mounted secret; no live role was inspected |
| Scheduled backup container | `deploy/production/docker-compose.production.yml`, `ops/x3-production/backup/backup.sh` | `DATABASE_URL_FILE` mounted as a Compose secret | `pg_dump` and archive validation | Updated shell reader; synthetic reader tests required on candidate |
| Operator backup/restore scripts | `ops/x3-production/backup/*.sh`, `ops/x3-production/dr/verify-restore.sh` | `DATABASE_URL_FILE` preferred; `DATABASE_URL` remains compatible | Operator-controlled dump, restore, and verification | Source only; these scripts were not run against Production Test |
| Finance CI database | `.github/workflows/finance-github-first-qualification.yml` and `ops/ci/**` | Ephemeral synthetic PostgreSQL 16 credentials | Isolated build and regression tests | GitHub-hosted CI at the prior candidate SHA passed; rerun after source changes |
| Other schedulers, BI, and maintenance jobs | No additional production consumers found by targeted source search | Unverified outside the repository | Unknown | Must be confirmed from authorized runtime metadata before rotation |

## Secret handling boundary

Production secret files must be provisioned outside the repository and web roots by an authorized operator. They must be regular files, not symlinks, readable only by the intended owner/group, and not readable by other users. Do not put values in shell history, command output, CI variables, artifacts, or this repository. The shell helper rejects group/other permission bits when the platform exposes file mode metadata.
