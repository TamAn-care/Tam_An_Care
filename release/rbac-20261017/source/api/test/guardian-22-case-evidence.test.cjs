'use strict';
/**
 * Guardian RBAC 22-case executable evidence suite.
 *
 * Maps every acceptance case in staff-guardian-regression-matrix.md to actual
 * compiled service behavior. Results are written to
 * api/test-results/guardian-isolated-results.json so evidence_release_gate.py
 * can verify them against GITHUB_SHA.
 *
 * Isolation contract:
 *   - No NestJS bootstrap, no PostgreSQL, no network, no production data.
 *   - All dependencies are replaced with in-memory mocks.
 *   - NODE_ENV=production is set so middleware enforcement is active.
 *   - JWT_SECRET is a non-production CI-only value.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Import compiled artifacts (built by `npm run build` before this runs)
// ---------------------------------------------------------------------------
const { ProductionAuthMiddleware } = require('../dist/security/production-auth.middleware.js');
const { ResidentAccessScopeService } = require('../dist/resident-access-scope/resident-access-scope.service.js');
const { ResidentController } = require('../dist/residents/resident.controller.js');

// ---------------------------------------------------------------------------
// Environment — isolated CI only, never production values
// ---------------------------------------------------------------------------
const CI_JWT_SECRET = 'guardian-ci-22case-evidence-nonprod-key-00001';
const now = () => Math.floor(Date.now() / 1000);

const savedEnv = {
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
};
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = CI_JWT_SECRET;

process.on('exit', () => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

// ---------------------------------------------------------------------------
// Evidence collector
// ---------------------------------------------------------------------------
const evidence = [];

async function runCase(id, fn) {
  let status = 'failed';
  let error = null;
  try {
    await fn();
    status = 'passed';
  } catch (e) {
    error = e && e.message ? e.message : String(e);
  }
  evidence.push({
    name: id,
    status,
    error,
    head_sha: process.env.GITHUB_SHA || '',
    run_at: new Date().toISOString(),
    environment: 'isolated-in-memory-no-db',
  });
  // Re-throw so node:test records the failure
  if (status === 'failed') {
    const err = new Error(`${id}: ${error}`);
    err.stack = '';
    throw err;
  }
}

// ---------------------------------------------------------------------------
// JWT helpers — CI use only
// ---------------------------------------------------------------------------
function makeToken(payload, secret = CI_JWT_SECRET) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

function staffClaims(overrides = {}) {
  return {
    sub: 'ci-staff-001',
    role: 'CAREGIVER',
    jti: 'ci-session-001',
    exp: now() + 3600,
    nbf: now() - 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Auth middleware harness
// ---------------------------------------------------------------------------
function makeMiddleware({ rows = [{ actor_id: 'ci-staff-001', actor_role: 'CAREGIVER' }] } = {}) {
  const db = {
    query: async (_sql, _params) => ({ rows }),
  };
  return new ProductionAuthMiddleware(db);
}

async function invokeMiddleware(middleware, { authorization, path = '/api/residents', spoof = {} } = {}) {
  const req = {
    originalUrl: path,
    headers: { ...spoof },
    header(name) {
      return name.toLowerCase() === 'authorization' ? authorization : undefined;
    },
  };
  let nextCount = 0;
  let error;
  try {
    await middleware.use(req, undefined, () => { nextCount++; });
  } catch (e) {
    error = e;
  }
  return { req, error, nextCount };
}

// ---------------------------------------------------------------------------
// Scope service harness
// ---------------------------------------------------------------------------
function makeScope({ staffActive = true, rowCount = 1 } = {}) {
  const db = { query: async () => ({ rowCount, rows: [] }) };
  const staff = {
    resolveActiveActorWithRole: async () =>
      staffActive
        ? { actor_id: 'ci-staff-001', status: 'ACTIVE', primary_operational_role: 'SUPERVISOR' }
        : null,
  };
  return new ResidentAccessScopeService(db, staff);
}

// ---------------------------------------------------------------------------
// Controller harness
// ---------------------------------------------------------------------------
function makeController({ scopeAllowed = false, supervisorValid = false } = {}) {
  const service = {
    authorizeSupervisor: async () => {
      if (!supervisorValid) throw new Error('DENIED_SUPERVISOR');
    },
    list: async () => [],
    listPage: async () => ({ items: [] }),
    getById: async (id) => ({ resident: { resident_id: id } }),
  };
  const scope = {
    canAccessResident: async () => scopeAllowed,
  };
  return new ResidentController(service, scope);
}

// ===========================================================================
// STAFF01–STAFF10 — Staff identity authentication
// ===========================================================================

test('STAFF01', async () => runCase('STAFF01', async () => {
  // Existing staff with valid token and sufficient privileges → ALLOW
  const mw = makeMiddleware();
  const tok = makeToken(staffClaims());
  const r = await invokeMiddleware(mw, { authorization: `Bearer ${tok}` });
  assert.equal(r.error, undefined, 'STAFF01: valid staff must be allowed');
  assert.equal(r.nextCount, 1, 'STAFF01: next() must be called once');
  assert.equal(r.req.headers['x-actor-id'], 'ci-staff-001');
  assert.equal(r.req.headers['x-actor-role'], 'CAREGIVER');
}));

test('STAFF02', async () => runCase('STAFF02', async () => {
  // Missing authentication token → DENY
  const mw = makeMiddleware();
  const r = await invokeMiddleware(mw, { authorization: undefined });
  assert.ok(r.error, 'STAFF02: missing token must be denied');
  assert.equal(r.nextCount, 0, 'STAFF02: route must not be reached');
}));

test('STAFF03', async () => runCase('STAFF03', async () => {
  // Malformed token → DENY
  const mw = makeMiddleware();
  const r = await invokeMiddleware(mw, { authorization: 'Bearer not.a.valid.jwt.at.all' });
  assert.ok(r.error, 'STAFF03: malformed token must be denied');
  assert.equal(r.nextCount, 0);
}));

test('STAFF04', async () => runCase('STAFF04', async () => {
  // Expired token → DENY
  const mw = makeMiddleware();
  const tok = makeToken(staffClaims({ exp: now() - 100 }));
  const r = await invokeMiddleware(mw, { authorization: `Bearer ${tok}` });
  assert.ok(r.error, 'STAFF04: expired token must be denied');
  assert.equal(r.nextCount, 0);
}));

test('STAFF05', async () => runCase('STAFF05', async () => {
  // Invalid token signature → DENY
  const mw = makeMiddleware();
  const tok = makeToken(staffClaims(), 'wrong-signing-key-ci-nonprod-000000');
  const r = await invokeMiddleware(mw, { authorization: `Bearer ${tok}` });
  assert.ok(r.error, 'STAFF05: invalid signature must be denied');
  assert.equal(r.nextCount, 0);
}));

test('STAFF06', async () => runCase('STAFF06', async () => {
  // Disabled staff account: valid JWT but session row missing → DENY
  const mw = makeMiddleware({ rows: [] }); // empty rows = revoked/disabled session
  const tok = makeToken(staffClaims());
  const r = await invokeMiddleware(mw, { authorization: `Bearer ${tok}` });
  assert.ok(r.error, 'STAFF06: disabled account session must be denied');
  assert.equal(r.nextCount, 0);
}));

test('STAFF07', async () => runCase('STAFF07', async () => {
  // Authenticated staff lacking required role → DENY
  // Controller-level: caregiver cannot list all residents (needs supervisor)
  const ctrl = makeController({ supervisorValid: false });
  await assert.rejects(
    () => ctrl.listResidents('ci-staff-001', 'CAREGIVER'),
    'STAFF07: insufficient role must be denied at controller',
  );
}));

test('STAFF08', async () => runCase('STAFF08', async () => {
  // Cross-role privilege escalation: scope check blocks caregiver from unauthorized resident
  const scope = makeScope({ staffActive: true, rowCount: 0 }); // no assignment row
  const allowed = await scope.canAccessResident('ci-staff-001', 'CAREGIVER', 'resident-other-A');
  assert.equal(allowed, false, 'STAFF08: caregiver without assignment must be denied cross-resident access');
}));

test('STAFF09', async () => runCase('STAFF09', async () => {
  // Guardian role token submitted to staff-only middleware → DENY
  const mw = makeMiddleware();
  const tok = makeToken(staffClaims({ role: 'GUARDIAN' }));
  const r = await invokeMiddleware(mw, { authorization: `Bearer ${tok}` });
  assert.ok(r.error, 'STAFF09: GUARDIAN role must be rejected by staff middleware');
  assert.equal(r.nextCount, 0);
}));

test('STAFF10', async () => runCase('STAFF10', async () => {
  // Guardian identity used to infer staff identity via header spoofing → DENY
  const mw = makeMiddleware({ rows: [] }); // guardian session not in auth_sessions
  const tok = makeToken(staffClaims({ sub: 'ci-guardian-001', role: 'CAREGIVER' }));
  const r = await invokeMiddleware(mw, {
    authorization: `Bearer ${tok}`,
    spoof: { 'x-actor-id': 'ci-staff-001', 'x-actor-role': 'SUPERVISOR' },
  });
  // Must be denied: session DB lookup returns empty (guardian not registered as staff)
  assert.ok(r.error, 'STAFF10: guardian identity must not gain staff access via header spoofing');
  assert.equal(r.nextCount, 0);
}));

// ===========================================================================
// GUARD01–GUARD12 — Guardian resident-scope cases
// ===========================================================================

const { GuardianResidentService } = require('../dist/resident-access-scope/guardian-resident.service.js');

function guardianHarness({ active = true, linked = true, expired = false, revoked = false } = {}) {
  let queries = 0;
  const db = { query: async (sql, params) => {
    queries++;
    assert.match(sql, /sa.status = 'ACTIVE'/);
    assert.match(sql, /sa.primary_operational_role/);
    assert.match(sql, /raa.status = 'ACTIVE'/);
    assert.match(sql, /raa.effective_from <= NOW\(\)/);
    assert.match(sql, /raa.effective_to > NOW\(\)/);
    assert.match(sql, /r.active_status = true/);
    assert.deepEqual(params.slice(0, 3), ['guardian-A', 'GUARDIAN', 'FAMILY_PORTAL']);
    const permitted = active && linked && !expired && !revoked && (!params[3] || params[3] === 'resident-A');
    return { rows: permitted ? [{ residentId: 'resident-A', residentCode: 'CI-A', displayName: 'CI resident' }] : [] };
  }};
  const scope = new ResidentAccessScopeService(db, {});
  return { service: new GuardianResidentService(db, scope), queries: () => queries };
}

test('GUARD01', async () => runCase('GUARD01', async () => {
  const h = guardianHarness();
  assert.equal((await h.service.detail('guardian-A', 'GUARDIAN', 'resident-A')).residentId, 'resident-A');
}));
test('GUARD02', async () => runCase('GUARD02', async () => {
  await assert.rejects(guardianHarness().service.detail('guardian-A', 'GUARDIAN', 'resident-B'), e => e.getStatus() === 404);
}));
test('GUARD03', async () => runCase('GUARD03', async () => {
  assert.deepEqual(await guardianHarness({ linked: false }).service.list('guardian-A', 'GUARDIAN'), []);
}));
test('GUARD04', async () => runCase('GUARD04', async () => {
  await assert.rejects(guardianHarness({ revoked: true }).service.detail('guardian-A', 'GUARDIAN', 'resident-A'), e => e.getStatus() === 404);
}));
test('GUARD05', async () => runCase('GUARD05', async () => {
  await assert.rejects(guardianHarness({ expired: true }).service.detail('guardian-A', 'GUARDIAN', 'resident-A'), e => e.getStatus() === 404);
}));
test('GUARD06', async () => runCase('GUARD06', async () => {
  assert.deepEqual(await guardianHarness({ active: false }).service.list('guardian-A', 'GUARDIAN'), []);
}));
test('GUARD07', async () => runCase('GUARD07', async () => {
  const r = await invokeMiddleware(makeMiddleware(), { authorization: 'Bearer ' + makeToken(staffClaims({ role: 'GUARDIAN' })) });
  assert.equal(r.error.getStatus(), 403);
  assert.equal(r.nextCount, 0);
}));
test('GUARD08', async () => runCase('GUARD08', async () => {
  const mw = makeMiddleware();
  const req = { method: 'POST', originalUrl: '/api/family-portal/residents/resident-A', headers: {},
    header: () => 'Bearer ' + makeToken(staffClaims({ role: 'GUARDIAN' })) };
  await assert.rejects(mw.use(req, undefined, () => assert.fail('must deny mutation')), e => e.getStatus() === 403);
}));
test('GUARD09', async () => runCase('GUARD09', async () => {
  await assert.rejects(guardianHarness().service.detail('guardian-A', 'GUARDIAN', "resident-A' OR TRUE --"), e => e.getStatus() === 404);
}));
test('GUARD10', async () => runCase('GUARD10', async () => {
  const result = await guardianHarness().service.list('guardian-A', 'GUARDIAN');
  assert.deepEqual(result.map(r => r.residentId), ['resident-A']);
}));
test('GUARD11', async () => runCase('GUARD11', async () => {
  const state = { revoked: false };
  assert.equal((await guardianHarness(state).service.list('guardian-A', 'GUARDIAN')).length, 1);
  state.revoked = true;
  assert.deepEqual(await guardianHarness(state).service.list('guardian-A', 'GUARDIAN'), []);
}));
test('GUARD12', async () => runCase('GUARD12', async () => {
  const h = guardianHarness();
  await assert.rejects(h.service.list(undefined, undefined), e => e.getStatus() === 403);
  assert.equal(h.queries(), 0);
}));

// ===========================================================================
// Write evidence JSON after all tests complete
// ===========================================================================
process.on('exit', () => {
  const outDir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'guardian-isolated-results.json');
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        schema: 'guardian-22-case-evidence-v1',
        coverage: { guardianResidentAuthorization: true, databaseIntegration: false },
        limitation: 'Real Guardian services with injected memory database; PostgreSQL integration is a separate release gate.',
        head_sha: process.env.GITHUB_SHA || '',
        run_at: new Date().toISOString(),
        environment: 'isolated-in-memory-no-db',
        tests: evidence,
      },
      null,
      2,
    ),
    'utf8',
  );
  const passed = evidence.filter(e => e.status === 'passed').length;
  const total = evidence.length;
  process.stderr.write(`\nGUARDIAN_EVIDENCE: ${passed}/${total} cases passed\n`);
  process.stderr.write(`EVIDENCE_FILE: ${outFile}\n`);
});
