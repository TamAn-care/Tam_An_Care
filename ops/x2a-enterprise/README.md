# TamAnCare X2 Enterprise Operations Baseline

Application-side production foundation.

Backup baseline:
- daily PostgreSQL logical backup;
- SHA-256 integrity verification;
- isolated restore verification.

Provisional engineering targets:
- RPO: 24 hours;
- RTO: 4 hours.

These are not yet final production SLAs.

X3 must certify or replace them and add:
- central log aggregation;
- metrics and alerts;
- shared multi-instance rate limiting;
- off-site backup retention;
- WAL/PITR where required;
- TLS/reverse proxy;
- environment separation;
- deployment topology;
- DR runbooks;
- session and token-revocation lifecycle.
