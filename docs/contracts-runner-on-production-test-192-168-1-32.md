# Production Test 192.168.1.32 — GitHub runner bootstrap (approved server-local plan)
Status: **SOURCE PREPARED ONLY; NOT INSTALLED; LIVE SERVER NOT ACCESSED.**

## Security boundary
Install only a dedicated runner under a non-root Linux identity `tamancare-ghrunner`; avoid adding it to `docker`, `sudo`, `adm`, or runtime service groups. No bind mount of production secrets, data, backup repositories, or Docker socket. No production code deployment or automatic schema migration.

**Critical risk:** a GitHub Actions runner installed directly on the production server executes arbitrary shell instructions from workflows trusted by the repository. Its identity must be restricted, and branch, workflow, and environment approval policies must be set BEFORE registration or first job. Environment protection alone is not enough if untrusted workflows can target the runner label; apply runner group/workflow restrictions where available.

## One-time administrator bootstrap, only after OS and permissions review
1. Check OS, architecture, Linux distribution and available storage/memory; do not install or upgrade Docker, PostgreSQL, API or frontend.
2. Create a system user with no password login and no interactive remote shell or escalation, and a private working directory (e.g. `/opt/tamancare-ghrunner`) owned by this account; ensure sufficient disk quota and log/temporary file retention. The runner's working files must not sit on the PostgreSQL or backup volumes.
3. In GitHub Settings > Actions > Runners, generate a **short-lived registration token**. Follow GitHub's current Linux self-hosted runner download/checksum instructions and set label `tamancare-contract-audit`. Never paste token into GitHub repository source, job logs, or chat.
4. Use a dedicated GitHub runner group restricted to the intended repository/workflows if supported. Reject untrusted PR jobs and forks. Use `contract-runtime-readonly` environment with required reviewers, protected branches, and only the narrow secret/variable needed by the probe.
5. Set up a dedicated PostgreSQL login that is non-superuser and has **zero write privileges**, default transaction read-only, and catalog access. Configure TLS CA verification. **Do not expose database listener outside an approved interface.** Validate all pre-existing app connections and database listening constraints before changing any database network settings.
6. Runner's only permitted audit workflow is `.github/workflows/contract-runtime-readonly-self-hosted.yml`. Its read-only probe is `ops/ci/contract-least-privilege-probe.sh`. Do not enable deployment workflow.

## Acceptance
- GitHub shows runner **Online/Idle**.
- The runtime audit succeeds with a read-only transaction, strict TLS verification, no superuser, no CREATE privileges, no public-table write privileges.
- Production Test API/PostgreSQL/frontend remain healthy, and there is no scheduled backup disruption.
- Detailed production evidence stays local. Only fixed, whitelisted aggregate status is allowed in GitHub summaries.
- This verifies metadata only; signed document archive, personnel RBAC, actual legacy contracts, off-site backup/restore tests remain separately blocked.

## Fast-resume stop conditions
If no safe host role/runner isolation, no runner group restriction, no approved trust policy, or no viable TLS read-only connection: **STOP**. Do not grant Docker group or sudo rights just to make the probe pass.

Do not claim completed runner registration or live audit until verified on the actual server. Production deployment remains **NO_GO**.
