'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const compiledRoot=path.resolve(__dirname,'../../api/dist');
function unique(name){
 const matches=[];
 function visit(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,e.name);
   if(e.isDirectory()) visit(p);
   else if(e.name===name)matches.push(p);
  }
 }
 visit(compiledRoot);assert.equal(matches.length,1,'unique '+name);return matches[0];
}
const serviceFile=unique('monthly-operating-result.service.js');
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(parent?.filename===serviceFile&&request==='../database/database.service')
  return {DatabaseService:class{}};
 return originalLoad.apply(this,arguments);
};
let Service;
try{Service=require(serviceFile).MonthlyOperatingResultService;}
finally{Module._load=originalLoad;}
const {verifyIndependentMonthlyClose}=require(unique('monthly-close-evidence.js'));
const d='a'.repeat(64);
const forged={
 month:'2026-10',snapshotDigest:d,sourceReconciliationDigest:'b'.repeat(64),
 approverId:'FORGED_ADMIN',approvalId:'FORGED_APPROVAL',approvedAt:'2026-10-12T00:00:00Z',
 sourceCount:1,entryCount:1,completenessVerified:true,
 reconciliationVerified:true,approvalSignatureVerified:true
};
assert.equal(verifyIndependentMonthlyClose('2026-10',forged,{entryCount:1,snapshotDigest:d}).verified,true,
 'pure shape validator accepts plausible claims; this is NOT independent signature verification');
const source=fs.readFileSync(path.join(__dirname,'../../api/src/finance-billing/monthly-operating-result.service.ts'),'utf8');
assert.match(source,/verifyIndependentMonthlyClose\(month,\s*null/, 'operational service must not accept untrusted proof flags');
assert.match(source,/sourceVerified:\s*false/, 'ledger source metadata is not independent certification');
async function run(){
 let queryCount=0;
 const db={async query(sql,params){
  queryCount++;
  if(/information_schema\.columns/.test(sql))return {rows:[
   'finance_entry_id','entry_type','recognition_date','amount_vnd','status',
   'source_mode','source_domain','source_entity_type','source_entity_id'
  ].map(column_name=>({column_name}))};
  if(/FROM public\.finance_entries/.test(sql))return {rows:[{
   finance_entry_id:'ONLY_LEDGER_1',entry_type:'REVENUE',recognition_date:'2026-10-01',
   amount_vnd:'10000000',status:'POSTED',source_mode:'SYSTEM',
   source_domain:'BILLING',source_entity_type:'INVOICE',source_entity_id:'I1',
   ...forged
  }]};
  throw Error('UNEXPECTED_QUERY');
 }};
 const observed=await new Service(db).read('2026-10');
 assert.equal(queryCount,2);
 assert.equal(observed.state,'CHUA_DU_DU_LIEU');
 assert.equal(observed.profitVnd,null);
 assert.ok(observed.reasons.includes('MONTH_CLOSE_EVIDENCE_MISSING'));
 console.log('FINANCE_FORGED_MONTH_CLOSE_NOT_TRUSTED_BY_OPERATIONAL_SERVICE=PASS');
 console.log('PURE_EVIDENCE_VALIDATOR_SIGNATURE_AUTHENTICITY=NOT_IMPLEMENTED');
 console.log('MONTH_CLOSE_BACKEND_EVIDENCE_REPOSITORY=NOT_CONNECTED');
 console.log('PRODUCTION_GO_NO_GO=NO_GO');
}
run().catch(e=>{console.error(e);process.exitCode=1});
