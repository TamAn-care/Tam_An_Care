'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
function find(dir,name){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);if(x.isDirectory()){const r=find(p,name);if(r)return r;}else if(x.name===name)return p;}}
const file=find(path.join(__dirname,'../../api/dist'),'finance-rbac-policy.js');assert.ok(file,'Compiled Finance RBAC policy missing');
const {hasPricingCapability:can,canViewUnapprovedPricing:unapproved}=require(file);
for(const role of ['ADMIN','SUPERVISOR'])for(const cap of ['VIEW','EDIT_DRAFT','SUBMIT','APPROVE'])assert.equal(can(role,cap),true,`${role}:${cap}`);
for(const role of ['ADMIN','SUPERVISOR','CARE_MANAGER'])for(const cap of ['VIEW','EDIT_DRAFT','SUBMIT'])assert.equal(can(role,cap),true,`${role}:${cap}`);
assert.equal(can('CARE_MANAGER','APPROVE'),false);
assert.equal(can('ACCOUNTANT','VIEW'),true);assert.equal(unapproved('ACCOUNTANT'),false);
for(const role of ['ACCOUNTANT','CAREGIVER','NURSE','GUARDIAN','NUTRITIONIST'])for(const cap of ['EDIT_DRAFT','SUBMIT','APPROVE'])assert.equal(can(role,cap),false,`${role}:${cap}`);
for(const role of ['CAREGIVER','NURSE','GUARDIAN','NUTRITIONIST'])assert.equal(can(role,'VIEW'),false);
for(const role of ['ADMIN','SUPERVISOR','CARE_MANAGER'])assert.equal(unapproved(role),true);
console.log('FINANCE_RBAC_PRICING_POLICY_PASS');
