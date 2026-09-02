# TamAnCare X3 Production Deployment Foundation

## Authority

This directory defines the X3 production operations baseline.

The existing root docker-compose.yml remains a development-only topology.

Production deployment authority is:

deploy/production/docker-compose.production.yml

## Environment separation

Development credentials and development JWT values must never be promoted.

Production must provision secrets externally.

Production must fail before deployment if required environment variables,
secret files, TLS material, or web build path are missing.

## TLS

Production edge terminates TLS at Nginx.

HTTP port 80 redirects to HTTPS.

TLS 1.2 and TLS 1.3 are enabled.

HSTS is emitted on HTTPS responses.

Certificate and private-key lifecycle is an operations responsibility.

No private key belongs in source control.

## Network topology

Internet
  |
  v
Nginx :443
  |
  v
API :3000
  |
  v
PostgreSQL :5432

PostgreSQL is not published to the host.

API is not published directly to the host.

The backend Docker network is internal.

## Health

PostgreSQL:
pg_isready

API:
/api/health/ready

Web:
local HTTP probe

## Resource baseline

Resource controls are explicit and environment-overridable.

They are operational guardrails, not resident-capacity limits.

No hard resident-count limit is introduced.

## Deferred X3 controls

Not completed by X3-B1:

- central metrics/collector/alert integration
- distributed/multi-instance rate limiter
- session/token revocation lifecycle
- WAL archive/PITR
- off-site backup automation
- restore/RPO/RTO drill
- dependency risk disposition

Those require later X3 controlled gates.

## Safety

Do not run npm audit fix.

Do not blind-upgrade major framework versions.

Do not replace the accepted master runtime during this gate.
