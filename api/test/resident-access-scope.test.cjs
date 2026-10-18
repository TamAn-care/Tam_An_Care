'use strict';
// Isolated behavioral regression of compiled resident scope service.
// No API startup, PostgreSQL, network, resident records, or data persistence.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ResidentAccessScopeService } =
  require('../dist/resident-access-scope/resident-access-scope.service.js');

function harness({ validStaff = true, rowCount = 1 } = {}) {
  let queries = 0;
  const db = { query: async () => { queries++; return { rowCount, rows: [] }; } };
  const staff = {
    resolveActiveActorWithRole: async () =>
      validStaff ? { actor_id: 'staff-ci-1', status: 'ACTIVE',
        primary_operational_role: 'SUPERVISOR' } : null
  };
  return {
    service: new ResidentAccessScopeService(db, staff),
    queryCount: () => queries
  };
}

test('SCOPE01 active supervisor and active matching resident may access', async () => {
  const h = harness();
  assert.equal(await h.service.canAccessResident('staff-ci-1', 'SUPERVISOR', 'resident-ci-A'), true);
  assert.equal(h.queryCount(), 1);
});

test('SCOPE02 valid supervisor denied when resident query returns zero rows', async () => {
  const h = harness({ rowCount: 0 });
  assert.equal(await h.service.canAccessResident('staff-ci-1', 'SUPERVISOR', 'resident-ci-B'), false);
  assert.equal(h.queryCount(), 1);
});

test('SCOPE03 inactive or role-mismatched supervisor is denied before resident query', async () => {
  const h = harness({ validStaff: false });
  assert.equal(await h.service.canAccessResident('staff-ci-1', 'SUPERVISOR', 'resident-ci-A'), false);
  assert.equal(h.queryCount(), 0);
});

test('SCOPE04 missing actor ID denied without query', async () => {
  const h = harness();
  assert.equal(await h.service.canAccessResident('', 'SUPERVISOR', 'resident-ci-A'), false);
  assert.equal(h.queryCount(), 0);
});

test('SCOPE05 missing resident ID denied without query', async () => {
  const h = harness();
  assert.equal(await h.service.canAccessResident('staff-ci-1', 'SUPERVISOR', ''), false);
  assert.equal(h.queryCount(), 0);
});

test('SCOPE06 direct-care assignment must exist for caregiver', async () => {
  const h = harness({ rowCount: 0 });
  assert.equal(await h.service.canAccessResident('staff-ci-1', 'CAREGIVER', 'resident-ci-A'), false);
  assert.equal(h.queryCount(), 1);
});

test('SCOPE07 sqlPredicate rejects untrusted SQL identifier', () => {
  const h = harness();
  assert.throws(() => h.service.sqlPredicate('r; DROP TABLE residents', 'staff-ci-1', 'CAREGIVER'), /Unsafe resident SQL alias/);
});

test('SCOPE08 sqlPredicate fails closed on missing staff actor', () => {
  const h = harness();
  const predicate = h.service.sqlPredicate('r', '', 'CAREGIVER');
  assert.equal(predicate.sql, 'FALSE');
  assert.deepEqual(predicate.params, []);
});

test('SCOPE09 sqlPredicate for supervisor requires active canonical staff', () => {
  const h = harness();
  const predicate = h.service.sqlPredicate('r', 'staff-ci-1', 'SUPERVISOR');
  assert.match(predicate.sql, /staff_actors/);
  assert.match(predicate.sql, /status\s*=\s*'ACTIVE'/);
  assert.deepEqual(predicate.params, ['staff-ci-1', 'SUPERVISOR']);
});

test('SCOPE10 sqlPredicate for caregiver requires active assignment and actor', () => {
  const h = harness();
  const predicate = h.service.sqlPredicate('r', 'staff-ci-1', 'CAREGIVER');
  assert.match(predicate.sql, /resident_access_assignments/);
  assert.match(predicate.sql, /raa\.status\s*=\s*'ACTIVE'/);
  assert.match(predicate.sql, /staff_actors/);
  assert.deepEqual(predicate.params, ['staff-ci-1', 'CAREGIVER', 'DIRECT_CARE']);
});
