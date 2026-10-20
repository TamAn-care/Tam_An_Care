# JWT provider and runtime evidence — V32

Capture/review date: 2026-10-20 ICT. Source baseline: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; evidence branch SHA at preparation: `9933cd076638b19053e02e10e68e3694b7e48d6f`. No secret value, reversible fingerprint, or secret-derived test artifact is included.

## Source/runtime facts

- `api/src/auth/auth.service.ts:482-489` reads `process.env.JWT_SECRET` and rejects missing/short values before issuing auth tokens.
- `api/src/security/production-auth.middleware.ts:266` reads the same environment variable to validate JWTs.
- No `kid`/multi-key/dual-key mechanism was established in reviewed source; treat implementation as a single-key flow unless Security/Platform demonstrates otherwise.
- Source and synthetic CI exercise Staff/Guardian authentication, server-side session checks and resident scope. This does not prove provider identity, runtime secret version, full replica propagation or live revoke state.
- Production Test snapshot observed one API container only. No complete replica inventory, secret manager record ID/version, issuer/audience metadata, provider audit, last-use audit, token TTL inventory or revoke event was available in the repository evidence.

## Provider evidence matrix

| Control | Evidence present | Status |
|---|---|---|
| Provider/account and secret record | Not available | UNKNOWN |
| Runtime secret version per process | Not available | UNKNOWN |
| Issuer/audience and key version (`kid`) | Not established in provider/deployment evidence | UNKNOWN |
| Token lifetime | Not fully confirmed from provider/deployment evidence | UNKNOWN |
| Session state and logout/revoke propagation | Source has server-side session checks; live state and all-replica propagation absent | PARTIAL / runtime UNKNOWN |
| Refresh token use | Complete provider/runtime evidence absent | UNKNOWN |
| Historical credential revoke | No provider event IDs/timestamps or prior-version rejection proof | UNKNOWN |
| Rotation decision | Security owner decision not supplied | PENDING |

No suspicious credential was used to authenticate or test. No live key was rotated. Do not claim a key revoked from its absence in the current source tree.

**JWT_PROVIDER_EVIDENCE=UNVERIFIED. JWT_REVOKE_EVIDENCE=UNVERIFIED.**

Security must provide a redacted provider audit record containing provider/account, secret-record ID/version, use/last-use, rotation/revoke event IDs and timestamps, and prior-version rejection evidence. Platform must map every runtime replica/process to secret reference/version and document session invalidation/restart behavior.
