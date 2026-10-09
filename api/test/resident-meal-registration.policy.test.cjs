const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizeResidentMealRegistration, countRegisteredPortions } =
  require('../dist/kitchen-operations/resident-meal-registration.policy.js');

const check = (role,action,assignedResident=false,activeAuthenticatedActor=true) =>
  authorizeResidentMealRegistration({role,action,assignedResident,activeAuthenticatedActor});

for(const action of ['VIEW','REGISTER','UPDATE','CANCEL']) {
  test('care manager allowed '+action, () => assert.equal(check('CARE_MANAGER',action).allowed,true));
  test('caregiver assigned allowed '+action, () => assert.equal(check('CAREGIVER',action,true).allowed,true));
  test('caregiver unassigned denied '+action, () => assert.equal(check('CAREGIVER',action,false).allowed,false));
  test('unauthenticated denied '+action, () => assert.equal(check('CARE_MANAGER',action,false,false).allowed,false));
}
for(const role of ['NUTRITIONIST','SUPERVISOR']) {
  test(role+' read-only',()=>{
    assert.equal(check(role,'VIEW').allowed,true);
    for(const action of ['REGISTER','UPDATE','CANCEL']) assert.equal(check(role,action).allowed,false);
  });
}
for(const role of ['ADMIN','NURSE','PSYCHOLOGIST','GUARDIAN','UNKNOWN','']) {
  test(role+' denied',()=>{for(const action of ['VIEW','REGISTER','UPDATE','CANCEL']) assert.equal(check(role,action).allowed,false)});
}
test('totals exclude cancellations',()=>assert.equal(countRegisteredPortions([
  {status:'REGISTERED',portions:2},{status:'CANCELLED',portions:5},{status:'REGISTERED',portions:1}
]),3));
test('totals reject invalid quantities',()=>assert.throws(()=>countRegisteredPortions([{status:'REGISTERED',portions:-1}])));
