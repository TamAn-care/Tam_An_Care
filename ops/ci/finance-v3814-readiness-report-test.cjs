'use strict';
const assert=require('node:assert/strict');
const {evaluateFinanceReleaseReadiness:evaluate}=require('../../api/dist/finance-billing/finance-release-readiness-report.js');
const all={snapshotConsistent:true,authenticatedRoleGatePassed:true,
realSourceVerified:true,backupIsolatedRestorePassed:true,parentSymlinkSafetyPassed:true,
durableMetadataObjectConsistencyPassed:true,productionMigrationAuthorized:true};
let r=evaluate({incidents:[],scanned:1,evidence:all});
assert.equal(r.decision,'NO_GO');
assert.equal(r.productionDeployAuthorized,false);
assert.equal(r.monthlyCloseCertified,false);
assert(r.blockers.includes('PRODUCTION_HUMAN_RELEASE_APPROVAL_REQUIRED'));
r=evaluate({incidents:[{code:'MISSING',objectKey:'a'},{code:'CORRUPT',objectKey:'b'},
 {code:'ORPHAN',objectKey:'c'},{code:'UNSAFE_PATH',objectKey:'d'},
 {code:'SCAN_ERROR',objectKey:'e'}],scanned:5,evidence:{...all,backupIsolatedRestorePassed:false}});
assert.deepEqual([r.summary.missing,r.summary.corrupt,r.summary.orphan,r.summary.unsafe,r.summary.errors],[1,1,1,1,1]);
assert(r.blockers.includes('MISSING_PROOF_backupIsolatedRestorePassed'));
assert(r.blockers.includes('ATTACHMENT_RECONCILIATION_INCIDENTS'));
assert.equal(r.decision,'NO_GO');
r=evaluate({incidents:null,scanned:-2,evidence:null});
assert(r.blockers.includes('INCIDENTS_NOT_VERIFIED'));
assert(r.blockers.includes('SCAN_COUNT_INVALID'));
console.log('FINANCE_V3814_RELEASE_READINESS_FAIL_CLOSED_PASS');
