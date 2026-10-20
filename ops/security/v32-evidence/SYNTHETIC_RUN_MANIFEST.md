# Synthetic PostgreSQL run ownership manifest — V32

Run ID: `V32-RBAC-20261020-1421`  Start/cleanup window: 2026-10-20 07:21–07:23 UTC  Owner: Codex task V32  Source candidate: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`  Evidence branch source SHA: `9933cd076638b19053e02e10e68e3694b7e48d6f`.

| Resource | Identity | Isolation/ownership |
|---|---|---|
| PostgreSQL | `postgres:16`, image ID `sha256:e17e86066e5ef83e0952a9347f5c792b7ece00972e2aa787a6986f471b3dd3d5`; repo digest `postgres@sha256:e17e86066e5ef83e0952a9347f5c792b7ece00972e2aa787a6986f471b3dd3d5` | `--network none`, tmpfs `/var/lib/postgresql/data`, no host port or bind mount |
| Container | `v32-secrole-20261020-1421`, container ID `66d0f502e227410df8a6b3862c07f11a5370f935339aa76d7284eeb7a5fcace1` | Created by this run only; no Production Test container touched |
| Database | `v32synthetic`; restore target `v32restore` | Both inside run container only |
| Synthetic data | One synthetic resident `SYN-R1`; one synthetic note | No real personal or credential data |
| Roles | `taman_owner`, `taman_app_runtime`, `taman_migration`, `taman_backup` | Created only in run databases/cluster |
| Artifacts | Dump `/tmp/v32-synthetic.dump` inside container | Ephemeral container filesystem; no host copy |

Cleanup: container stopped and removed. Post-cleanup `docker ps -a --filter name=v32-secrole-20261020-1421` and `docker volume ls --filter name=v32-secrole-20261020-1421` returned no rows. `SYNTHETIC_CLEANUP=PASS`.
