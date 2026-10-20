# Session invalidation and rotation readiness — V33

Source review at code SHA `9933cd076638b19053e02e10e68e3694b7e48d6f`: each request validates signed JWT and reads active, unrevoked, unexpired session state from PostgreSQL. Logout revokes Staff or Guardian session. Normal JWT TTL is eight hours. No refresh-token path or dual-key rotation support was found in reviewed code. Production Test instance/replica propagation was not exercised.

Exact-SHA CI Guardian login/resident-scope and auth scenarios passed, but do not prove all-session invalidation across every live replica. A single-key atomic replacement invalidates old signed access tokens immediately; users must authenticate again. Session records should also be revoked/expired according to approved policy. Any staged rotation must use synthetic keys and disposable DB, test login/logout/expiry/revoke and resident scope, and account for every replica. `PLATFORM_SESSION_INVALIDATION=PARTIAL`.
