'use strict';
// Staff RBAC executable controller checks against the compiled production class.
// No Nest app boot, network, PostgreSQL, business data, or Production Test connection.
const test = require('node:test');
const assert = require('node:assert/strict');
const { StaffActorController } = require('../dist/staff-actors/staff-actor.controller.js');

function harness({ canonical = true } = {}) {
  const calls = { auth: 0, reads: 0, writes: 0 };
  const record = {
    actor_id: 'ci-staff-target', staff_code: 'CI-ONLY',
    display_name: 'Disposable test identity', primary_operational_role: 'NURSE',
    status: 'ACTIVE', employment_reference: null,
    created_at: new Date(0), updated_at: new Date(0),
  };
  const service = {
    resolveActiveActorWithRole: async (id, role) => {
      calls.auth++;
      return canonical && id === 'ci-supervisor' && role === 'SUPERVISOR'
        ? { actor_id: id, primary_operational_role: role, status: 'ACTIVE' }
        : null;
    },
    listStaffActors: async () => { calls.reads++; return [record]; },
    findByActorId: async () => { calls.reads++; return record; },
    createStaffActor: async () => { calls.writes++; return record; },
  };
  return { controller: new StaffActorController(service), calls };
}

const newStaff = {
  staffCode: 'CI-ONLY', displayName: 'Disposable test identity',
  primaryOperationalRole: 'NURSE', employmentReference: null,
};

for (const role of ['CAREGIVER', 'NURSE', 'CARE_MANAGER', 'GUARDIAN']) {
  test('STAFF-RBAC: ' + role + ' cannot list staff or disclose records', async () => {
    const h = harness();
    await assert.rejects(h.controller.list('ci-other', role));
    assert.equal(h.calls.reads, 0);
  });
  test('STAFF-RBAC: ' + role + ' cannot create staff or write audit', async () => {
    const h = harness();
    await assert.rejects(h.controller.createStaffActor('ci-other', role, newStaff));
    assert.equal(h.calls.writes, 0);
  });
}
test('STAFF-RBAC: missing principal cannot read staff detail', async () => {
  const h = harness();
  await assert.rejects(h.controller.detail(undefined, undefined, 'ci-staff-target'));
  assert.equal(h.calls.reads, 0);
});
test('STAFF-RBAC: forged supervisor header fails canonical active role', async () => {
  const h = harness({ canonical: false });
  await assert.rejects(h.controller.list('ci-other', 'SUPERVISOR'));
  assert.equal(h.calls.reads, 0);
});
test('STAFF-RBAC: inactive supervisor cannot create staff', async () => {
  const h = harness({ canonical: false });
  await assert.rejects(h.controller.createStaffActor('ci-supervisor', 'SUPERVISOR', newStaff));
  assert.equal(h.calls.writes, 0);
});
test('STAFF-RBAC: verified supervisor can list staff', async () => {
  const h = harness();
  const result = await h.controller.list('ci-supervisor', 'SUPERVISOR');
  assert.equal(result.items.length, 1);
  assert.equal(h.calls.reads, 1);
});
test('STAFF-RBAC: verified supervisor can view staff detail', async () => {
  const h = harness();
  const result = await h.controller.detail('ci-supervisor', 'SUPERVISOR', 'ci-staff-target');
  assert.equal(result.actorId, 'ci-staff-target');
  assert.equal(h.calls.reads, 1);
});
test('STAFF-RBAC: verified supervisor can create authorized staff', async () => {
  const h = harness();
  const result = await h.controller.createStaffActor('ci-supervisor', 'SUPERVISOR', newStaff);
  assert.equal(result.primaryOperationalRole, 'NURSE');
  assert.equal(h.calls.writes, 1);
});
test('STAFF-RBAC: supervisor cannot create a new supervisor via staff endpoint', async () => {
  const h = harness();
  await assert.rejects(h.controller.createStaffActor('ci-supervisor', 'SUPERVISOR', {
    ...newStaff, primaryOperationalRole: 'SUPERVISOR',
  }));
  assert.equal(h.calls.writes, 0);
});
