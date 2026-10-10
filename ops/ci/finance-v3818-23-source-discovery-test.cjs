'use strict';
const assert=require('node:assert/strict');
const {discoverCanonicalManualFinanceSource:discover}=require('../../api/dist/finance-billing/finance-v381823-canonical-source-discovery.js');
const ledger={schema:'public',name:'finance_entries',columns:['finance_entry_id','entry_type','amount_vnd','recognition_date']};
assert.equal(discover([ledger]).status,'BLOCKED_NO_AUTHORITATIVE_DOCUMENT_SOURCE');
assert.equal(discover([ledger]).enableRead,false);
assert.equal(discover(null).enableWrite,false);
const canonical={schema:'public',name:'finance_manual_documents',columns:[
 'document_id','origin_key','document_type','amount_vnd','recognition_date',
 'evidence_type','description','maker_id','reviewer_id','approver_id','state','revision']};
let x=discover([canonical]);
assert.equal(x.status,'CANDIDATE_SCHEMA_ONLY');
assert.equal(x.enableRead,false);
assert.equal(x.enableWrite,false);
assert.equal(discover([{...canonical,schema:'finance_manual_ci'}]).candidate,null);
assert.equal(discover([{...canonical,columns:canonical.columns.slice(1)}]).candidate,null);
console.log('TAMANCARE_FINANCE_V381823_CANONICAL_SOURCE_DISCOVERY_FAIL_CLOSED_PASS');
