'use strict';

// Isolated, in-memory verification of the actual compiled middleware.
// No application bootstrap, network, PostgreSQL, seed or resident data.
// These checks cover middleware authentication, NOT all 22 release cases.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { ProductionAuthMiddleware } = require('../dist/security/production-auth.middleware.js');

const SECRET = 'isolated-ci-only-nonproduction-jwt-key-000000001';
const now = () => Math.floor(Date.now() / 1000);

function token(payload, secret = SECRET) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = createHmac('sha256', secret).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + s;
}

function claims(overrides = {}) {
  return { sub: 'staff-ci-1', role: 'CAREGIVER', jti: 'session-ci-1',
    exp: now() + 3600, nbf: now() - 1, ...overrides };
}

async function invoke({ authorization, rows = [{ actor_id: 'staff-ci-1', actor_role: 'CAREGIVER' }], staffRows = [{ actor_id: 'staff-ci-1' }],
  path = '/api/residents', spoof = {} } = {}) {
  let queryCount = 0;
  let nextCount = 0;
  const db = { query: async (sql, params) => {
    queryCount++;
    if (queryCount === 1) {
      assert.match(sql, /FROM auth_sessions/);
      assert.match(sql, /revoked_at IS NULL/);
      assert.match(sql, /expires_at > now\(\)/);
      assert.deepEqual(params, ['session-ci-1', 'staff-ci-1', 'CAREGIVER']);
      return { rows };
    }
    assert.match(sql, /FROM staff_actors/);
    assert.match(sql, /status = 'ACTIVE'/);
    assert.match(sql, /primary_operational_role = \$2/);
    assert.deepEqual(params, ['staff-ci-1', 'CAREGIVER', 'session-ci-1']);
    assert.match(sql, /updated_at <= \(SELECT issued_at FROM auth_sessions/);
    return { rows: staffRows };
  }};
  const middleware = new ProductionAuthMiddleware(db);
  const req = {
    originalUrl: path,
    headers: { ...spoof },
    header(name) { return name.toLowerCase() === 'authorization' ? authorization : undefined; }
  };
  let error;
  try { await middleware.use(req, undefined, () => { nextCount++; }); }
  catch (e) { error = e; }
  return { req, error, nextCount, queryCount };
}

const oldNodeEnv = process.env.NODE_ENV;
const oldSecret = process.env.JWT_SECRET;
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = SECRET;
process.on('exit', () => {
  if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = oldNodeEnv;
  if (oldSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = oldSecret;
});

test('AUTH-MW01 active staff session passes and sets server-derived actor headers', async () => {
  const r = await invoke({ authorization: 'Bearer ' + token(claims()),
    spoof: { 'x-actor-id': 'forged', 'x-actor-role': 'SUPERVISOR' } });
  assert.equal(r.error, undefined);
  assert.equal(r.nextCount, 1);
  assert.equal(r.queryCount, 2);
  assert.equal(r.req.headers['x-actor-id'], 'staff-ci-1');
  assert.equal(r.req.headers['x-actor-role'], 'CAREGIVER');
  assert.equal(r.req.headers['x-auth-session-id'], 'session-ci-1');
});

for (const [id, value] of [
  ['AUTH-MW02 missing bearer token', undefined],
  ['AUTH-MW03 malformed token', 'Bearer malformed'],
  ['AUTH-MW04 expired token', 'Bearer ' + token(claims({ exp: now() - 100 }))],
  ['AUTH-MW05 invalid signature', 'Bearer ' + token(claims(), 'wrong-ci-only-signing-key-000000000')],
  ['AUTH-MW06 guardian role rejected for staff middleware', 'Bearer ' + token(claims({ role: 'GUARDIAN' }))],
  ['AUTH-MW07 unknown staff role rejected', 'Bearer ' + token(claims({ role: 'ADMINISTRATOR' }))],
  ['AUTH-MW08 not-before in future rejected', 'Bearer ' + token(claims({ nbf: now() + 3600 }))],
  ['AUTH-MW09 missing session claim rejected', 'Bearer ' + token(claims({ jti: '' }))],
]) {
  test(id, async () => {
    const r = await invoke({ authorization: value });
    assert.ok(r.error, 'must reject request');
    assert.equal(r.nextCount, 0, 'must not reach route');
    assert.equal(r.queryCount, 0, 'must reject before database lookup');
  });
}

test('AUTH-MW10 inactive/revoked session denied using injected memory DB', async () => {
  const r = await invoke({ authorization: 'Bearer ' + token(claims()), rows: [] });
  assert.ok(r.error);
  assert.equal(r.nextCount, 0);
  assert.equal(r.queryCount, 1);
});

test('AUTH-MW11 explicitly public health path is exempt from staff JWT check', async () => {
  const r = await invoke({ path: '/api/health', authorization: undefined });
  assert.equal(r.error, undefined);
  assert.equal(r.nextCount, 1);
  assert.equal(r.queryCount, 0);
});

for (const reason of ['disabled account', 'changed role']) {
  test('AUTH-MW12 stale session denied: ' + reason, async () => {
    const r = await invoke({ authorization: 'Bearer ' + token(claims()), staffRows: [] });
    assert.ok(r.error);
    assert.equal(r.error.getStatus(), 401);
    assert.equal(r.nextCount, 0);
    assert.equal(r.queryCount, 2);
  });
}
