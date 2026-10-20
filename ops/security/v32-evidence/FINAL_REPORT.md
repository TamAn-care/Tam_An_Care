# Security closure V32 — status report

DBA_MANIFEST=PARTIAL; raw protected run metadata and DBA attestation pending
DBA_ALLOWLIST=DRAFT; exact object/verb matrix not frozen or fully rehearsed
DBA_RESTORE_EVIDENCE=CHECKPOINT_SHA_AND_TOC_VERIFIED; REAL_RESTORE_UNVERIFIED
DBA_SIGNOFF=PENDING_EVIDENCE
APPLICATION_SQL_CALL_PATH=PARTIAL_STATIC_MAP; catalog/consumer reconciliation pending
APPLICATION_RBAC_REGRESSION=PARTIAL; exact-SHA CI PASS for its stated scope, not full target-role module matrix
APPLICATION_OWNER_SIGNOFF=PENDING_EVIDENCE
H01_H36_DISPOSITION=36/36 UNKNOWN; provider evidence required
JWT_PROVIDER_EVIDENCE=UNVERIFIED
SECURITY_OWNER_SIGNOFF=PENDING_EVIDENCE
PLATFORM_CONSUMER_MAP=PARTIAL
PLATFORM_REPLICA_VERSION_MAP=UNVERIFIED
PLATFORM_OWNER_SIGNOFF=PENDING_EVIDENCE
AUTH_CI_CONTRACT=PASS on prior exact SHA 9933cd076638b19053e02e10e68e3694b7e48d6f (run 39379888909); final V32 commit SHA must be verified separately
SECURITY_CANDIDATE_SHA=9933cd076638b19053e02e10e68e3694b7e48d6f (pre-V32 dossier commit)
SECURITY_CI_EXACT_SHA=PASS for 9933cd076638b19053e02e10e68e3694b7e48d6f only; final dossier SHA pending
SYNTHETIC_CLEANUP=PASS for V32-RBAC-20261020-1421; tmpfs/network-none run removed, container and volume filters empty; see SYNTHETIC_RUN_MANIFEST.md
SECURITY_APPROVAL_PACKAGE=ops/security/v32-evidence/SECURITY_APPROVAL_PACKAGE_V32.md; unsigned; evidence gaps itemized
DB_ROLE_CUTOVER=NOT_EXECUTED
JWT_ROTATION=NOT_EXECUTED
SECURITY_GATE=BLOCKED_UNTIL_VERIFIED
PRODUCTION_DEPLOY=NO
RELEASE_GATE=CLOSED
NEXT_REQUIRED_HUMAN_DECISION=Owners must return the specific protected evidence packet and separate scoped sign-offs described in SECURITY_APPROVAL_PACKAGE_V32.md
NEXT_ACTION=DBA: protected PG16 manifest plus exact grants/restore readiness; Application Owner: full target-role module regression; Security: provider audit + H01-H36 dispositions; Platform: exhaustive replica/consumer/version/session map. Then rerun exact-SHA CI and review each separate signature.
