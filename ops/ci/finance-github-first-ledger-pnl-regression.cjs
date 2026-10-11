'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const root=path.resolve(__dirname,'../../api/dist');
function find(name){
 const matches=[];
 function walk(dir){
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,item.name);
   if(item.isDirectory())walk(p);
   else if(item.name===name)matches.push(p);
  }
 }
 walk(root);
 assert.equal(matches.length,1,'unique compiled '+name);
 return matches[0];
}
const file=find('monthly-operating-result.service.js');
const realLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(parent?.filename===file&&request==='../database/database.service')
  return {DatabaseService:class{}};
 return realLoad.apply(this,arguments);
};
let Service;
try{Service=require(file).MonthlyOperatingResultService;}
finally{Module._load=realLoad;}
const columns=[
 'finance_entry_id','entry_type','recognition_date','amount_vnd',
 'status','source_mode','source_domain','source_entity_type','source_entity_id'
];
const kinds=['REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX'];
const row=(kind,i,amount='0')=>({
 finance_entry_id:'E'+i,entry_type:kind,recognition_date:'2026-10-08',
 amount_vnd:amount,status:'POSTED',source_mode:'SYSTEM',
 source_domain:'FINANCE',source_entity_type:'SOURCE',
 source_entity_id:'S'+i
});
function mock(rows){
 const queries=[];
 return {
  queries,
  async query(sql,params){
   assert.match(sql,/^\s*SELECT\b/i);
   assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\b/i);
   queries.push({sql,params});
   if(sql.includes('information_schema.columns'))return {rows:columns.map(column_name=>({column_name}))};
   if(sql.includes('FROM public.finance_entries'))return {rows};
   throw Error('UNEXPECTED_SQL');
  }
 };
}
async function expectUnreleased(rows,label){
 const db=mock(rows);
 const result=await new Service(db).read('2026-10');
 assert.equal(result.state,'CHUA_DU_DU_LIEU',label);
 for(const field of ['revenueVnd','expenseVnd','profitVnd'])
  assert.equal(result[field],null,label+' '+field);
 assert.ok(result.reasons.includes('MONTH_CLOSE_EVIDENCE_MISSING'),label+' missing evidence');
 assert.equal(db.queries.length,2);
 return result;
}
async function main(){
 await expectUnreleased(kinds.map((k,i)=>row(k,i, i===0?'15000000':'1000000')),
  '7 canonical entry types');
 await expectUnreleased(kinds.map((k,i)=>row(k,i,'0')),
  'observed zero not certified zero');
 await expectUnreleased([], 'empty month not zero');
 await expectUnreleased([row('REVENUE',1,'15000000')],
  'receipt absent from canonical ledger not new revenue');
 await assert.rejects(
  new Service(mock([row('REVENUE',1,'15000000'),row('REVENUE',1,'15000000')])).read('2026-10'),
  /MONTHLY_FINANCE_DUPLICATE_OR_INVALID_ENTRY/,
  'duplicate ledger entry must fail closed by throwing');
 await expectUnreleased([row('REVENUE',1,'15000000.00')],
  'whole VND decimal representation');
 await assert.rejects(
  new Service(mock([row('CASH_RECEIPT',1,'100')])).read('2026-10'),
  /UNKNOWN_LEDGER_KIND/,
  'non-ledger receipt type must not be counted as revenue');
 console.log('FINANCE_GITHUB_FIRST_LEDGER_PNL_SEVEN_TYPES_FAIL_CLOSED_PASS');
 console.log('REAL_BUSINESS_PROVENANCE=NOT_PROVEN');
 console.log('OFFICIAL_MONTHLY_PROFIT=NOT_RELEASED');
 console.log('PRODUCTION_GO_NO_GO=NO_GO');
}
main().catch(e=>{console.error(e);process.exitCode=1});
