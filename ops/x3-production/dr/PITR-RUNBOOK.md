# TamAnCare PostgreSQL PITR Runbook

Production PITR prerequisites:

- wal_level=replica
- archive_mode=on
- tested archive_command
- durable WAL archive
- monitoring of archive failures
- base-backup/WAL retention coordination

Recovery:

1. Isolate failed production database.
2. Select verified base backup before target time.
3. Restore to a new isolated PostgreSQL instance.
4. Configure restore_command against WAL archive.
5. Configure recovery_target_time or another explicit target.
6. Start isolated recovery.
7. Validate TamAnCare database invariants.
8. Measure RPO and RTO.
9. Require separate authorization before production promotion.

Never test PITR by overwriting the active production database.

This configuration baseline is not proof that production WAL
archiving is currently active.
