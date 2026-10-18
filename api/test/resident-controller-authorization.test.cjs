'use strict';
// Resident controller authorization regression. In-memory mocks only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ResidentController } = require('../dist/residents/resident.controller.js');
function setup({ allowed = false, supervisorValid = false } = {}) {
  let reads = 0, scopeChecks = 0, supervisorChecks = 0;
  const service = {
    authorizeSupervisor: async () => { supervisorChecks++; if (!supervisorValid) throw Error('DENIED_SUPERVISOR'); },
    list: async () => { reads++; return []; },
    listPage: async () => { reads++; return { items: [] }; },
    getById: async id => { reads++; return { resident: { resident_id: id } }; }
  };
  const scope = {
    canAccessResident: async () => { scopeChecks++; return allowed; }
  };
  return { controller: new ResidentController(service, scope),
    reads: () => reads, scopeChecks: () => scopeChecks,
    supervisorChecks: () => supervisorChecks };
}
test('RES-GET01 missing identity is denied without resident read', async () => {
  const h=setup({allowed:true});
  await assert.rejects(h.controller.getResident(undefined, undefined, 'A'));
  assert.equal(h.reads(),0);
  assert.equal(h.scopeChecks(),0);
});
test('RES-GET02 guardian identity cannot access staff resident endpoint', async () => {
  const h=setup({allowed:true});
  await assert.rejects(h.controller.getResident('guardian-A','GUARDIAN','A'));
  assert.equal(h.reads(),0);
  assert.equal(h.scopeChecks(),0);
});
test('RES-GET03 unauthorized assigned staff denied before reading resident B', async () => {
  const h=setup({allowed:false});
  await assert.rejects(h.controller.getResident('staff-A','CAREGIVER','B'));
  assert.equal(h.reads(),0);
  assert.equal(h.scopeChecks(),1);
});
test('RES-GET04 authorized staff can read resident A', async () => {
  const h=setup({allowed:true});
  const r=await h.controller.getResident('staff-A','NURSE','A');
  assert.equal(r.resident.resident_id,'A');
  assert.equal(h.reads(),1);
  assert.equal(h.scopeChecks(),1);
});
test('RES-LIST01 staff without supervisory approval cannot list residents', async () => {
  const h=setup({supervisorValid:false});
  await assert.rejects(h.controller.listResidents('staff-A','CAREGIVER'));
  assert.equal(h.reads(),0);
});
test('RES-LIST02 guardian cannot list residents', async () => {
  const h=setup({supervisorValid:false});
  await assert.rejects(h.controller.listResidents('guardian-A','GUARDIAN'));
  assert.equal(h.reads(),0);
});
test('RES-LIST03 verified supervisor list remains available', async () => {
  const h=setup({supervisorValid:true});
  await h.controller.listResidents('staff-S','SUPERVISOR');
  assert.equal(h.reads(),1);
  assert.equal(h.supervisorChecks(),1);
});
