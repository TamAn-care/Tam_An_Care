const assert=require('node:assert/strict');
const {
 FinanceWriteController
}=require('../dist/finance-billing/finance-write.controller.js');
const {
 publishVerifiedFinanceIdentity
}=require('../dist/security/verified-finance-identity.js');

process.env.TAMANCARE_FINANCE_WRITE_ENABLED='true';
process.env.TAMANCARE_FINANCE_WRITE_ROLES='ACCOUNTANT';

const db={
 query:async()=>({
  rows:[{actor_id:'finance-ci-actor',actor_role:'ACCOUNTANT'}]
 })
};

const payload={
 receiptId:'CI_RECEIPT',
 invoiceId:'CI_INVOICE',
 allocationId:'CI_ALLOCATION',
 amountVnd:'300',
 operationKey:'CI_OPERATION'
};

function verifiedRequest(){
 const req={};
 publishVerifiedFinanceIdentity(req,{
  actorId:'finance-ci-actor',
  actorRole:'ACCOUNTANT',
  sessionId:'finance-ci-session'
 });
 return req;
}

async function expectError(name,code,expected){
 const controller=new FinanceWriteController(db,{
  allocatePayment:async()=>{throw new Error(code);}
 });
 let observed;
 try{
  await controller.allocate(verifiedRequest(),payload);
 }catch(error){
  observed=error;
 }
 const status=typeof observed?.getStatus==='function'
  ? observed.getStatus():500;

 assert.equal(status,expected,name);
 console.log(name+'=PASS HTTP_'+status);
}

(async()=>{
 await expectError(
  'CROSS_RESIDENT',
  'FINANCE_CROSS_RESIDENT_FORBIDDEN',422
 );
 await expectError(
  'OVERALLOCATION',
  'FINANCE_ALLOCATION_OUT_OF_BOUNDS',409
 );
 await expectError(
  'IDEMPOTENCY_CONFLICT',
  'FINANCE_IDEMPOTENCY_CONFLICT',409
 );
 await expectError(
  'INVALID_VND',
  'FINANCE_INVALID_INTEGER_VND',422
 );
 await expectError(
  'UNKNOWN_ERROR',
  'UNEXPECTED_DATABASE_FAILURE',500
 );

 const controller=new FinanceWriteController(db,{
  allocatePayment:async()=>({
   allocationId:'CI_ALLOCATION',replayed:false
  })
 });

 assert.deepEqual(
  await controller.allocate(verifiedRequest(),payload),
  {allocationId:'CI_ALLOCATION',replayed:false}
 );

 console.log('SUCCESS_UNCHANGED=PASS');
 console.log('FINANCE_ERROR_REGRESSION=PASS');
})().catch(error=>{
 console.error('FINANCE_ERROR_REGRESSION=HOLD',error.message);
 process.exitCode=2;
});
