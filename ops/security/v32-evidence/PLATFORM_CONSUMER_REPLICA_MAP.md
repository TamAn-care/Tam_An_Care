# Platform consumer and replica map — V32

Capture/review date: 2026-10-20 ICT. Candidate baseline `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; evidence branch SHA at preparation `9933cd076638b19053e02e10e68e3694b7e48d6f`. This is a partial snapshot, not a complete consumer attestation.

| Consumer | Runtime/image evidence | Purpose / credential reference | Version and validation | Status |
|---|---|---|---|---|
| Production Test API | One container observed; image `taman-care-rbac-rc-api:20261017.2`, digest `sha256:4a6ae8f1547fab7be5a67e42d5839e45d37ccdb13da6dd0cd096660ea007dc93` | API auth and DB; DB username observed as `taman`; JWT secret-record ID omitted/unavailable | No JWT version ID or per-replica verification | PARTIAL |
| Frontend | Container observed | UI; direct DB/JWT signing use not established | No deployment/image digest/version map in retained evidence | PARTIAL |
| Background workers | No separate worker container in observed snapshot | Unknown; may consume DB/JWT depending deployment | Not exhaustively inventoried | UNKNOWN |
| Backup timer/script | Hourly host script observed | Database backup; effective DB user/secret version unknown | No runtime credential version evidence | PARTIAL |
| Migrations | No separate migration container observed | Unknown process; DDL consumer requires owner inventory | Not exhaustive | UNKNOWN |
| Scheduler/monitor/reporting/maintenance | No complete process inventory available | Unknown | Not exhaustive | UNKNOWN |

`pg_stat_activity` is a point-in-time cross-check, not a complete list of consumers or replicas. No full environment dump was collected. No secret plaintext or easy-to-guess hash is present.

Platform must reconcile deployment service records, image digests, every replica/process and secret manager audit into consumer → instance → secret reference/version → purpose → last-use evidence, including scheduled/host processes. Also attest session invalidation and rollout propagation.

**PLATFORM_CONSUMER_MAP=PARTIAL; PLATFORM_REPLICA_VERSION_MAP=UNVERIFIED.** Platform signoff: PENDING.
