'use strict';
const assert=require('node:assert/strict');
const {hasServiceMappingCapability:can}=require('../../api/dist/finance-billing/service-mapping-rbac.js');
for(const role of ['ADMIN','SUPERVISOR']) for(const cap of ['VIEW','EDIT_DRAFT','SUBMIT','APPROVE','SUPERSEDE']) assert.equal(can(role,cap),true,`${role}/${cap}`);
for(const cap of ['VIEW']) assert.equal(can('ACCOUNTANT',cap),true);
for(const cap of ['EDIT_DRAFT','SUBMIT','APPROVE','SUPERSEDE']) assert.equal(can('ACCOUNTANT',cap),false,`ACCOUNTANT/${cap}`);
for(const role of ['CAREGIVER','NURSE','CARE_MANAGER','GUARDIAN','STAFF','']) for(const cap of ['VIEW','EDIT_DRAFT','SUBMIT','APPROVE','SUPERSEDE']) assert.equal(can(role,cap),false,`${role}/${cap}`);
console.log('FINANCE_SERVICE_MAPPING_RBAC_PASS');
