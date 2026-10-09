'use strict';
// Finance V2.9.74: isolated controller integration with an in-memory DB stub.
// NO PostgreSQL, NO network, NO fixtures persisted, NO production identities.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PATH_METADATA, METHOD_METADATA } = require('@nestjs/common/constants');

function findCompiled(root, filename) {
  if (!fs.existsSync(root)) throw Error('API_DIST_NOT_FOUND');
  const found = [];
  function walk(folder) {
    for (const x of fs.readdirSync(folder, { withFileTypes: true })) {
      const next = path.join(folder, x.name);
      if (x.isDirectory()) walk(next);
      else if (x.name === filename) found.push(next);
    }
  }
  walk(root);
  assert.equal(found.length, 1, 'Expected precisely one '+filename);
  return found[0];
}
const dist=path.join(__dirname,'..','..','api','dist');
const controllerPath=findCompiled(dist,'finance-read.controller.js');
const identityPath=findCompiled(dist,'verified-finance-identity.js');
const { FinanceReadController }=require(controllerPath);
const { publishVerifiedFinanceIdentity }=require(identityPath);

const roles=['ADMIN','SUPERVISOR','ACCOUNTANT'];
process.env.TAMANCARE_FINANCE_READ_ROLES=roles.join(',');
process.env.TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES=roles.join(',');

const identity={actorId:'ci-actor',actorRole:'ACCOUNTANT',sessionId:'ci-session'};
const queries=[];
const db={
  async query(sql,values) {
    const normalized=sql.trim();
    assert.match(normalized,/^SELECT\b/i,'Finance Read must perform only SELECT');
    queries.push({sql:normalized,values});
    if (normalized.includes('FROM auth_sessions')) {
      return {rows:[{actor_id:identity.actorId,actor_role:identity.actorRole}]};
    }
    if (normalized.includes('FROM billing_invoice_items')) {
      return {rows:[]};
    }
    if (normalized.includes('FROM billing_receipts')) {
      return {rows:[]};
    }
    if (normalized.includes('FROM billing_invoices')) {
      return {rows:[{invoice_id:'ci-invoice', invoice_code:'CI',
        resident_id:'ci-resident',contract_id:'ci-contract',
        billing_month:'2026-10-01',status:'ISSUED',
        total_amount_vnd:'100',allocated_amount_vnd:'0',
        balance_vnd:'100'}]};
    }
    throw Error('UNEXPECTED_SQL_TABLE');
  }
};
const app=new FinanceReadController(db);
const req=()=>{const request={};publishVerifiedFinanceIdentity(request,identity);return request;};
const methods=[
  ['getInvoiceBalance','invoices/:invoiceId/balance'],
  ['listInvoicesByMonth','invoices/month/:month'],
  ['getInvoiceWithItems','invoices/:invoiceId'],
  ['listLatestReceipts','receipts'],
  ['listReceiptsForInvoice','receipts/invoice/:invoiceId']
];
async function main(){
  assert.equal(Reflect.getMetadata(PATH_METADATA,FinanceReadController),'api/finance-read');
  const defined=Object.getOwnPropertyNames(FinanceReadController.prototype);
  const declared=defined.filter(x=>Reflect.hasMetadata(PATH_METADATA,FinanceReadController.prototype[x]));
  assert.equal(declared.length,5,'Exactly five HTTP endpoints required');
  for(const [method,route] of methods) {
    assert.equal(Reflect.getMetadata(PATH_METADATA,FinanceReadController.prototype[method]),route);
    assert.equal(Reflect.getMetadata(METHOD_METADATA,FinanceReadController.prototype[method]),0,'Must be GET');
  }
  for(const role of roles) {
    const r={};publishVerifiedFinanceIdentity(r,{...identity,actorRole:role});
    // Return matching verified session role, not user-supplied HTTP headers.
    const old=db.query;
    db.query=async(s,v)=>s.includes('FROM auth_sessions')
      ? {rows:[{actor_id:identity.actorId,actor_role:role}]}
      : old(s,v);
    await app.listLatestReceipts(r);
    db.query=old;
  }
  await app.getInvoiceBalance(req(),'ci-invoice');
  await app.listInvoicesByMonth(req(),'2026-10');
  await app.getInvoiceWithItems(req(),'ci-invoice');
  await app.listLatestReceipts(req());
  await app.listReceiptsForInvoice(req(),'ci-invoice');
  const denied=[
    ()=>app.listLatestReceipts({}),
    async()=>{const r={};publishVerifiedFinanceIdentity(r,{...identity,actorRole:'CAREGIVER'});return app.listLatestReceipts(r)},
    async()=>{const r=req(); const old=db.query;db.query=async()=>({rows:[]});try{return await app.listLatestReceipts(r)}finally{db.query=old}}
  ];
  for(const attempt of denied) {
    await assert.rejects(attempt(),e=>e.status===403);
  }
  await assert.rejects(app.listInvoicesByMonth(req(),'2026-13'),e=>e.status===400);
  await assert.rejects(app.getInvoiceBalance(req(),'bad/id'),e=>e.status===400);
  assert.ok(queries.length>=8);
  console.log('FINANCE_V2974_ISOLATED_CONTROLLER_TEST_PASS');
  console.log('ROUTES_GET=5 AUTH_ALLOWED=3 AUTH_DENIED=3 INPUT_REJECTED=2');
  console.log('DATA_SOURCE=EPHEMERAL_MEMORY_SQL_STUB; REAL_DB=NO; HTTP_JWT_E2E=NOT_TESTED');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
