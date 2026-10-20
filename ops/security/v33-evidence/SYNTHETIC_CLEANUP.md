# Synthetic run and cleanup — V33

No new synthetic database/container/volume was created in this V33 evidence pass. Therefore V33-created resource counts are zero by construction; no Production Test demo rows were inserted.

Prior V32 isolated PostgreSQL 16 rehearsal `V32-RBAC-20261020-1421` used Docker `--network none`, owned disposable container/database and synthetic data; role/restore-synthetic checks passed. Its container and volumes were removed and verified absent after cleanup. This is not a real backup restore and does not prove current V33 resources outside that run.

`SYNTHETIC_DB_REMAINING=0 (V33-created)` · `SYNTHETIC_CONTAINERS_REMAINING=0 (V33-created)` · `SYNTHETIC_VOLUMES_REMAINING=0 (V33-created)` · `PRODUCTION_TEST_DEMO_INSERT=NO`.
