# TamAnCare Backup Policy

Production baseline:

- PostgreSQL custom-format logical backup
- pg_restore structural verification
- SHA-256 integrity manifest
- default local retention: 14 days
- execute at least daily
- copy verified backup and manifest to off-site encrypted storage
- monitor backup failures and backup age
- periodically execute isolated restore drills

Local backup is not off-site backup.

This contract does not claim that an external storage provider has
already been provisioned.
