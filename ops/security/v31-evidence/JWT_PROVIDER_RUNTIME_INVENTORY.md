# JWT provider and runtime inventory — V31

Evidence capture: 2026-10-20 ICT. SHA256 of this sanitized document is listed in sibling SHA256SUMS.

Status date: 2026-10-20. No signing key value or key-derived fingerprint is recorded.

## Evidence provenance

| Item | Source | Candidate / timestamp | Result |
|---|---|---|---|
| JWT implementation | Source at integration checkpoint, auth service and production auth middleware | f79fe2b7e0919e7035838bae7ce5f46df01b7e36; reviewed in V30 code candidate 3c1586049854c0473231ee725605822edfa1591a | Reads process.env.JWT_SECRET in auth sign/verify path; single-key flow observed |
| GitHub synthetic HTTP run | guardian-http-browser, disposable PostgreSQL 16 and actual HTTP/browser | Run 39367575938, SHA 047e4e612de44d6b24a5a0da76b5612fa83ae0a9 | PASS for its Guardian/Finance acceptance scope; synthetic CI-only values, no provider evidence for Production Test |
| Provider audit | No provider console/secret manager API evidence available in this workspace | — | UNVERIFIED |
| Runtime distribution / replicas | Production Test filtered container inventory and app config | 2026-10-20 ICT | One API container observed; no full scale/replica history or secret record version proof |
| Revocation | Source tests exercise inactive/missing session denial; no live revoke audit | Candidate code SHA above | Source capability exists; runtime revoke state and evidence UNKNOWN |

## Inventory

| Consumer / component | Signing or validation path | Provider/account/key record/version | Replica / last-use evidence | Status |
|---|---|---|---|---|
| API auth service | Signs from one JWT_SECRET environment setting | Unknown; no provider console or secret-record ID received | Production Test API image observed; secret distribution/version and exact last-use evidence unknown | Runtime key identity UNKNOWN |
| Staff auth middleware | Validates bearer JWT using application key and checks session state | Same unknown key source | One live API container observed; not exhaustive | Partial source evidence; runtime UNKNOWN |
| Guardian auth / resident scope | Same application JWT boundary plus server-side scope checks in candidate tests | Unknown | Actual CI tests use synthetic key; live replica/key identity unknown | Runtime/provider UNKNOWN |
| Background workers | No distinct worker container found in observed snapshot | Unknown | Host jobs not fully inventoried | UNKNOWN |
| Deployment configuration / secret injection | Filtered inspection confirmed username only for DB; no full environment exported | Secret-manager record/version unavailable | Replica count/config history unavailable | UNKNOWN |
| Refresh/session | Source middleware consults server-side active-session state; test harness covers revoked/missing session denial | Live session store/revoke evidence unavailable | Runtime invalidation and all replicas not observed | PARTIAL source, runtime UNKNOWN |
| Token metadata | No multi-key/kid mechanism observed in source reviewed | Issuer/audience/key version not evidenced in owner/provider records | — | UNVERIFIED |

## Rotation position

- Treat no prior key as verified revoked.
- The source inspected supports a single-key environment variable; dual-key rotation is not assumed.
- No synthetic full-system rotation rehearsal was run in V30/V31. Existing signature/session tests are not a rotation rehearsal.
- Before any live rotation, Security/Platform must identify provider, account, secret-record ID/version, all deployment replicas/processes, issuer/audience, token TTL, server-side session invalidation/revoke control, exact restart/atomic update sequence and recovery behavior.
- If provider/runtime evidence confirms a potentially exposed key, prepare controlled atomic rotation with forced session invalidation as approved. Do not use the suspected key to authenticate test calls.

JWT_PROVIDER_EVIDENCE=UNVERIFIED
JWT_RUNTIME_REPLICA_VERIFIED=NO
JWT_REVOKE_EVIDENCE=UNVERIFIED

Security owner must attest provider/key lifecycle and disposition. Platform owner must attest the complete process/replica distribution and rollout/invalidation controls.
