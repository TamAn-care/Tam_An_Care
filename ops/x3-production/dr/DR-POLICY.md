# TamAnCare Disaster Recovery Policy

Acceptance targets:

- logical-backup RPO target: <= 24 hours
- future PITR RPO target: <= 5 minutes after WAL archiving is
  operationally validated
- database restore RTO target: <= 60 minutes at the currently tested scale

These are recovery targets, not guaranteed SLA values.

Restore drills must record:

- backup SHA-256
- backup duration
- restore duration
- public table count
- resident count
- V/W table count
- auth credential residue
- migration ID
- migration checksum_sha256
- integrity result

Production disaster cutover requires separate authorization.
