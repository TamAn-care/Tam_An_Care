'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GuardianAccessService } =
  require('../dist/guardian-access/guardian-access.service.js');

function harness({ rowCount = 1 } = {}) {
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rowCount, rows: rowCount === 1 ? [{}] : [] };
    },
  };
  return {
    service: new GuardianAccessService(db),
    queries,
  };
}

test('GUARDIAN-SCOPE-01 active relationship and permission allow report view', async () => {
  const h = harness();
  assert.equal(
    await h.service.canViewResidentHealthReport('guardian-1', 'resident-1'),
    true,
  );
  assert.deepEqual(h.queries[0].params, ['guardian-1', 'resident-1']);
  assert.match(h.queries[0].sql, /gp\.status = 'ACTIVE'/);
  assert.match(h.queries[0].sql, /grr\.status = 'ACTIVE'/);
  assert.match(h.queries[0].sql, /health_report:view/);
});

for (const [name, rowCount] of [
  ['cross-resident relationship denied', 0],
  ['revoked or expired relationship denied', 0],
]) {
  test(`GUARDIAN-SCOPE-${name}`, async () => {
    const h = harness({ rowCount });
    assert.equal(
      await h.service.canViewResidentHealthReport('guardian-1', 'resident-other'),
      false,
    );
  });
}

test('GUARDIAN-SCOPE-04 missing identity or resident fails closed without query', async () => {
  const h = harness();
  assert.equal(await h.service.canViewResidentHealthReport('', 'resident-1'), false);
  assert.equal(await h.service.canViewResidentHealthReport('guardian-1', ''), false);
  assert.equal(h.queries.length, 0);
});
