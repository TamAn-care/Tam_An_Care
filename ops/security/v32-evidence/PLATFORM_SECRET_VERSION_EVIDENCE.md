# Platform secret-version and injection evidence — V32

Evidence date: 2026-10-20 ICT. Source candidate baseline `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; Security evidence revision at preparation `9933cd076638b19053e02e10e68e3694b7e48d6f`.

## Findings

- Source auth signing and verification access `JWT_SECRET`; no dual-key rotation mechanism was established.
- A single Production Test API container and image digest were observed in prior filtered metadata. Exact replica count, image digest for every instance, secret injection method, protected secret record ID/version and per-instance rollout confirmation are not available.
- Background/host jobs and worker inventory are incomplete. Provider-side access and rotation logs are not available.
- Source implements server-side session-state checks, but active-session store inventory, maximum token lifetime, refresh handling and invalidate/revoke propagation across replicas are not attested.

| Requirement | Status | Required protected evidence |
|---|---|---|
| All API/worker/scheduler/backup/migration replicas | UNKNOWN | deployment inventory with instance identity and image digest |
| Secret source and immutable version per instance | UNKNOWN | secret-manager record ID/version and injection source; no values |
| Key version/issuer/audience | UNKNOWN | provider config metadata |
| Token/session lifetime and invalidation | UNKNOWN | auth config, session store policy and cross-instance invalidation proof |
| Old version revoke/rejection | UNKNOWN | provider revoke event and isolated prior-version rejection evidence |

No dual-key support is presumed. Recommended plan if Security orders rotation: atomic single-key update and controlled restart/reload of all consumers with forced sign-in again if session revoke propagation cannot be proven.

Platform owner must attest the inventory and rollout controls. Status: **PENDING_EVIDENCE**.
