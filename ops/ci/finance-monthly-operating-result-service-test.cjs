'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

function locate(root,name){
  const found=[];
  (function walk(dir){
    for(const d of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,d.name);
      if(d.isDirectory()) walk(p);
      else if(d.name===name) found.push(p);
    }
  })(root);
  assert.equal(found.length,1,'unique '+name);
  return found[0];
}

const dist=path.join(__dirname,'../../api/dist');
const serviceFile=locate(dist,'monthly-operating-result.service.js');
const load=Module._load;
Module._load=function(id,parent,isMain){
  if(id==='../database/database.service' && parent?.filename===serviceFile)
    return {DatabaseService:class{}};
  return load.apply(this,arguments);
};
let Service;
try{ Service=require(serviceFile).MonthlyOperatingResultService; }
finally{ Module._load=load; }

const required=[
  'finance_entry_id','entry_type','recognition_date',
  'amount_vnd','posting_status','reconciliation_status'
];

function dbFor({columns=required,rows=[]}={}){
  const queries=[];
  return {
    queries,
    async query(sql,params){
      const normalized=sql.trim();
      assert.match(normalized,/^SELECT\b/i,'monthly result integration must be READ ONLY');
      queries.push({sql:normalized,params});
      if(normalized.includes('information_schema.columns'))
        return {rows:columns.map(column_name=>({column_name}))};
      if(normalized.includes('FROM public.finance_entries'))
        return {rows};
      throw Error('UNEXPECTED_SQL');
    }
  };
}

async function main(){
  {
    const db=dbFor({rows:[
      {finance_entry_id:'R1',entry_type:'REVENUE',recognition_date:'2026-10-01',amount_vnd:'15000000',posting_status:'POSTED',reconciliation_status:'VERIFIED'},
      {finance_entry_id:'E1',entry_type:'EXPENSE',recognition_date:'2026-10-09',amount_vnd:'12000000',posting_status:'POSTED',reconciliation_status:'VERIFIED'},
    ]});
    const out=await new Service(db).read('2026-10');
    assert.equal(out.state,'READY');
    assert.equal(out.revenueVnd,'15000000');
    assert.equal(out.expenseVnd,'12000000');
    assert.equal(out.profitVnd,'3000000');
    assert.equal(out.ledgerSchemaReady,true);
    assert.equal(db.queries.length,2);
  }
  {
    const db=dbFor({columns:['finance_entry_id','entry_type']});
    const out=await new Service(db).read('2026-10');
    assert.equal(out.state,'CHUA_DU_DU_LIEU');
    assert.equal(out.ledgerSchemaReady,false);
    assert.ok(out.missingColumns.includes('amount_vnd'));
    assert.equal(db.queries.length,1,'must not query ledger values with incomplete schema');
  }
  {
    const db=dbFor({rows:[
      {finance_entry_id:'R2',entry_type:'REVENUE',recognition_date:'2026-10-02',amount_vnd:'100',posting_status:'POSTED',reconciliation_status:'PENDING'},
    ]});
    const out=await new Service(db).read('2026-10');
    assert.equal(out.state,'CHUA_DU_DU_LIEU');
    assert.equal(out.profitVnd,null);
    assert.ok(out.reasons.includes('SOURCE_RECONCILIATION_PENDING'));
  }
  await assert.rejects(new Service(dbFor()).read('2026-13'),/INVALID_MONTH/);
  console.log('TAMANCARE_MONTHLY_RESULT_LEDGER_READ_ONLY_SERVICE_PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});
