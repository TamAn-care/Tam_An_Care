# TamAnCare Observability Foundation

## Accepted topology

The current accepted production deployment has one API application instance.

The existing rate limiter is process-local and therefore valid only for the
accepted single-instance API topology.

API horizontal scale-out MUST NOT be enabled until a shared rate-limit
mechanism has been separately designed, tested and accepted.

Redis is not an implicit dependency and must not be installed solely because
future scale-out may occur.

## Structured HTTP telemetry

TamAnCare emits structured JSON HTTP telemetry containing request correlation
and HTTP execution evidence, including requestId, method, path, statusCode,
durationMs and actorId.

## Process-local metrics

The API provides `/api/metrics`.

The route remains behind the production JWT security boundary.

Metrics include:

- total HTTP requests;
- 2xx responses;
- 4xx responses;
- 5xx responses;
- 429 rate-limit responses;
- request duration count;
- request duration sum;
- request duration average;
- request duration maximum;
- process uptime.

These metrics are process-local. They are an enterprise observability
foundation, not a centralized monitoring platform.

## Initial operational alert thresholds

When centralized collection is later connected:

- readiness failure: alert after 3 consecutive failed probes;
- HTTP 5xx ratio above 2% for 5 minutes: warning;
- HTTP 5xx ratio above 5% for 5 minutes: critical;
- HTTP 429 ratio above 5% for 5 minutes: warning;
- average HTTP latency above 500 ms for 5 minutes: warning;
- database readiness failure: critical;
- repeated container restart: critical;
- backup verification failure: critical.

These thresholds are operational starting points, not clinical thresholds and
not guaranteed service-level agreements.

## Incident response

1. Check `/api/health/live`.
2. Check `/api/health/ready`.
3. Correlate failures using requestId.
4. Review structured HTTP logs.
5. Check API and PostgreSQL resources.
6. Review recent deployments and migrations.
7. If database integrity is uncertain, stop mutating operations and follow
   the disaster-recovery runbook.
8. Preserve evidence before remediation.
