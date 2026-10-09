'use strict';
const assert=require('node:assert/strict');
const {Client}=require('../../api/node_modules/pg');
const {FinanceBillingService}=require('../../api/dist/finance-billing/finance-billing.service.js');
const {DatabaseService}=require('../../api/dist/database/database.service.js');
async function main(){
 const client=new Client();
 await client.connect();
 const seed=async(q)=>client.query(q);
 try{
  await seed("INSERT INTO service_contract_records(contract_id,contract_code,resident_id,status,payload) VALUES ('CI_CONTRACT','CI_CONTRACT_CODE','CI_RESIDENT','ACTIVE','{}')");
  await seed("INSERT INTO billing_invoices(invoice_id,invoice_code,resident_id,contract_id,billing_month,status,total_amount_vnd) VALUES ('CI_INV','CI_INV_CODE','CI_RESIDENT','CI_CONTRACT','2026-10-01','ISSUED',100)");
  await seed("INSERT INTO billing_receipts(receipt_id,receipt_code,resident_id,amount_vnd,received_date,status) VALUES ('CI_REC','CI_REC_CODE','CI_RESIDENT',90,'2026-10-09','CONFIRMED')");
  const db=new DatabaseService();
  try{
   const service=new FinanceBillingService(db);
   const op={receiptId:'CI_REC',invoiceId:'CI_INV',allocationId:'CI_ALLOC1',amountVnd:'60.00',actorId:'CI_ACTOR',operationKey:'CI_OP1'};
   assert.deepEqual(await service.allocatePayment(op),{allocationId:'CI_ALLOC1',replayed:false});
   assert.deepEqual(await service.allocatePayment(op),{allocationId:'CI_ALLOC1',replayed:true});
   await assert.rejects(service.allocatePayment({...op,amountVnd:'61'}),/FINANCE_IDEMPOTENCY_CONFLICT/);
   await assert.rejects(service.allocatePayment({...op,allocationId:'CI_ALLOC2',amountVnd:'40',operationKey:'CI_OP2'}),/FINANCE_ALLOCATION_OUT_OF_BOUNDS/);
   const counts=await client.query("SELECT (SELECT COUNT(*)::int FROM billing_payment_allocations) AS allocations,(SELECT COUNT(*)::int FROM finance_operation_audit) AS audits,(SELECT COUNT(*)::int FROM finance_operation_idempotency) AS operations");
   assert.equal(counts.rows[0].allocations,1);
   assert.equal(counts.rows[0].audits,1);
   assert.equal(counts.rows[0].operations,1);
   console.log('FINANCE_CANONICAL_TRANSACTION_IDEMPOTENCY_PASS');
  }finally{await db.onModuleDestroy();}
 }finally{await client.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
