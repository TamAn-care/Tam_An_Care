# Platform consumer and replica map — V33

Read-only Production Test capture at `2026-10-20T07:46:30Z`; BatchMode SSH succeeded. No service was restarted or changed; no environment values were read.

| Consumer | Instance/image | Secret or DB reference evidence | Status |
|---|---|---|---|
| API | `tamancare-production-test-server-api-1`, one observed replica, running, restart count 0; image `taman-care-rbac-rc-api:20261017.2`, ID/digest `sha256:4a6ae8f1547fab7be5a67e42d5839e45d37ccdb13da6dd0cd096660ea007dc93` | Env names include `DATABASE_URL`, `JWT_SECRET`; variable present only, DB username observed in prior filtered configuration as `taman`; no mounts | Instance snapshot verified; key record/version and injection origin unknown |
| Frontend | `tamancare-production-test-server-frontend-1`, running, restart count 0; image `taman-care-rbac-rc-frontend:20261017`, digest `sha256:7aca22ab818713f9afe7c15f41e080d97d933ba77c7dc756c6d3eed370ed292e` | No `JWT_SECRET` env observed; no mounts | Instance snapshot verified |
| PostgreSQL | `tamancare-production-test-server-postgres-1`, PostgreSQL 16.15 | Read-only catalog capture; no secret source inspection | Database observed |
| Hourly backup job | Host crontab `0 * * * * backup-production-test-server.sh` | Script contents and effective database identity not inspected | Consumer scope UNKNOWN |

No separate worker/migration container was observed in limited prior inventory; this does not prove no workers, scheduled jobs, external integrations, monitoring or maintenance consumers. Replica completeness, secret-record IDs/versions, secret injection source and provider audit remain UNVERIFIED. `PLATFORM_MAP=PARTIAL`.
