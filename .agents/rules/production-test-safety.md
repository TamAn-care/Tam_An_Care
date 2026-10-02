---
name: production-test-safety
version: 1.0.0
priority: P0
trigger: always_on
---

# Tâm An Care — Production Test Safety Protocol

These rules are mandatory whenever working on Production Test.

## Allowed by default

- Read and analyze source code.
- Modify source code only in the current Git branch/worktree.
- Run git status, git diff, git log, static analysis, lint, unit tests, frontend build, API build, and non-destructive verification.
- Create commits only on the current non-main working branch.
- Report exact changed files and verification results.

## Git safety

- Never commit directly to `main`.
- Never force-push.
- Never run `git reset --hard`, `git clean -fd/-fdx`, or destructive history rewrites.
- Use branch `antigravity-production-test` (or a child feature branch) for Production Test work.
- Before implementation, verify current branch and working tree status.
- Before any deployment, show the diff against `main` and require verification to pass.

## Database safety

Unless the user explicitly requests a separate database operation and its impact is reviewed:

- Do NOT execute INSERT, UPDATE, DELETE, TRUNCATE, DROP, ALTER, CREATE, migration, seed, reset, restore, or schema-changing SQL.
- Do NOT modify Production Test database contents.
- Do NOT restart PostgreSQL.
- Do NOT delete, recreate, prune, or modify PostgreSQL Docker volumes.
- Do NOT alter backup files, backup schedules, or restore points.

Read-only database inspection is allowed only when explicitly requested for diagnosis.

## Docker and runtime safety

- Do NOT run `docker compose down -v`.
- Do NOT run `docker volume rm`, destructive prune commands, or remove persistent volumes.
- Do NOT restart/recreate PostgreSQL as part of an application code change.
- Build/test first.
- Restart/recreate only the minimum frontend/API service needed, and only after verification passes and deployment is explicitly requested.

## Infrastructure safety

Unless explicitly requested as a separate infrastructure task:

- Do NOT modify Cloudflare.
- Do NOT modify DNS.
- Do NOT create/delete tunnels.
- Do NOT change public domains, SSL/TLS, firewall, router, or port-forwarding configuration.

## Deployment gate

A Production Test deployment is permitted only when all applicable gates pass:

1. Correct repository confirmed: `TamAn-care/Tam_An_Care`.
2. Correct non-main branch confirmed.
3. Working tree/diff reviewed.
4. Build/tests pass.
5. No unintended database/volume/infrastructure changes.
6. Deployment target is confirmed to be the source/build context actually serving Production Test on `192.168.1.32`.
7. Only then may the minimum required application service be updated.

## Required completion report

After each task, report:

- Branch
- Files changed
- Tests/build commands run
- PASS/FAIL
- Database modified = YES/NO
- PostgreSQL restarted = YES/NO
- Docker volume modified = YES/NO
- Cloudflare/DNS modified = YES/NO
- Deployment performed = YES/NO
