'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// CI sometimes compiles this service without adjacent optional runtime modules.
// Stub only constructor dependency modules; the actual service implementation
// under test remains the compiled production code.
const Module = require('node:module');
const originalLoad = Module._load;
const isolatedDependencies = new Map([
  ['../cross-domain-integration/cross-domain-integration.service', 'CrossDomainIntegrationService'],
  ['../resident-access-scope/resident-access-scope.service', 'ResidentAccessScopeService'],
  ['../database/database.service', 'DatabaseService'],
]);
Module._load = function(request, parent, isMain) {
  if (parent && parent.filename.endsWith('/operational-care-view/operational-care-view.service.js') && isolatedDependencies.has(request)) {
    return { [isolatedDependencies.get(request)]: class IsolatedDependency {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let OperationalCareViewService;
try {
  ({ OperationalCareViewService } = require('../dist/operational-care-view/operational-care-view.service'));
} finally {
  Module._load = originalLoad;
}

function fixture(allowed, rows) {
  const events = [];
  const db = { query: async (sql, params) => {
    events.push(['query', params]);
    assert.match(sql, /c\.resident_id = \$1/);
    assert.match(sql, /a\.assessment_version DESC/);
    assert.deepEqual(params, ['resident-A']);
    return { rows };
  }};
  const scope = { canAccessResident: async (...args) => {
    events.push(['scope', args]);
    return allowed;
  }};
  const integration = { residentOverview: async (id) => {
    events.push(['overview', id]);
    return {
      data: { resident: {resident_id:id, display_name:'Fixture'}, carePlans:[],careTasks:[],clinicalObservations:[],medication:[],incidents:[] },
      availability: {carePlans:'EMPTY',careTasks:'EMPTY',clinicalObservations:'EMPTY',medication:'EMPTY',incidents:'EMPTY'},
      provenance: {resident:'residents',carePlans:'care_plans',careTasks:'care_tasks',clinicalObservations:'clinical_observations',medicationOrders:'medication_orders',medicationAdministrations:'medication_administrations',incidents:'incidents'},
      limits: {perDomain:20}
    };
  }};
  return { service:new OperationalCareViewService(integration,scope,db),events };
}
const nurse = {actorId:'test-nurse', actorRole:'NURSE'};
test('denied resident never queries assessment or care domains', async () => {
  const x=fixture(false,[]);
  await assert.rejects(x.service.getResidentCareView('resident-A', nurse));
  assert.equal(x.events.length,1);
  assert.equal(x.events[0][0],'scope');
});
test('allowed nurse reads only requested resident and current latest assessment projection', async () => {
  const x=fixture(true,[{assessment_version:5,status:'AMENDED',updated_at:'2026-10-13',summary:'{"sleep":"tốt"}'}]);
  const result=await x.service.getResidentCareView('resident-A', nurse);
  assert.equal(result.initialAssessment.assessmentVersion,5);
  assert.equal(result.initialAssessment.assessmentStatus,'AMENDED');
  assert.deepEqual(result.initialAssessment.summary,{sleep:'tốt'});
  assert.deepEqual(x.events.map(v=>v[0]),['scope','query','overview']);
  assert.equal(result.authority.readOnly,true);
});
test('caregiver does not receive sensitive initial assessment', async () => {
  const x=fixture(true,[]);
  const result=await x.service.getResidentCareView('resident-A',{actorId:'test-caregiver',actorRole:'CAREGIVER'});
  assert.equal(result.initialAssessment,null);
  assert.deepEqual(x.events.map(v=>v[0]),['scope','overview']);
});
test('missing initial assessment returns null, no fabricated data', async () => {
  const x=fixture(true,[]);
  const result=await x.service.getResidentCareView('resident-A',nurse);
  assert.equal(result.initialAssessment,null);
});
