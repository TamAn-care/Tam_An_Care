# Security remediation and controlled rotation plan — V32

Status: **PREPARATION ONLY**. Candidate/source checkpoint remains `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`. No live credential or database changes were made.

## Finding disposition actions

- H01–H36 remain UNKNOWN until Security correlates each Gitleaks fingerprint internally with provider/account and protected secret records. The dossier records only rule/path/line/commit and does not reproduce values or secret-derived hashes.
- For any finding still plausibly active, Security should classify CONFIRMED_EXPOSED, then create provider-side rotation/revocation events and verify prior-version rejection. Do not attempt to validate a suspected key by logging in.
- If source confirms only one `JWT_SECRET`, use an atomic rotation window: freeze configuration change, identify all consumers/replicas and session TTL, distribute one new version consistently, restart/reload each consumer in a controlled order, verify new token acceptance and old token rejection, invalidate server sessions as approved, check every replica, then remove old provider version. If rollback is needed, use a new approved credential version; never restore a key confirmed exposed.
- Before approval, rehearse this sequence with synthetic key and synthetic users in disposable CI/lab. Record every process/replica, login/logout, token expiry, revocation, guardian resident scope, Admin/Superior application authority and negative authorization. No dual-key capability is assumed.

## Stop conditions

Stop before live rotation if provider/version or consumer scope is unknown; if any replica misses the new version; if old token acceptance persists beyond intended policy; if session invalidation cannot be proved; or if application owner cannot confirm care operations remain available. Live rotation needs a separate explicit approval package after Security, Platform and Application Owner sign.

JWT live rotation: NOT EXECUTED. Security owner disposition/signoff: PENDING.
