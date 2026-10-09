'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../api/dist');
function find(name){const matches=[];const walk=d=>{for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory())walk(p);else if(x.name===name)matches.push(p)}};walk(root);assert.equal(matches.length,1);return matches[0]}
const {FinanceDocumentAuthorizationService:Service}=require(find('finance-document-authorization.service.js'));
const {publishVerifiedFinanceIdentity:publish}=require(find('verified-finance-identity.js'));
async function main(){
 const original={...process.env};
 const db={queries:[],async query(sql,args){this.queries.push({sql,args});return {rows:[{actor_id:'MAKER',actor_role:'FINANCE_PREPARER'}]}}};
 const service=new Service(db);
 const req={};
 publish(req,{actorId:'MAKER',actorRole:'FINANCE_PREPARER',sessionId:'S1'});
 await assert.rejects(service.authorize(req,'SUBMIT'),/FORBIDDEN|Forbidden|role/i);
 process.env.TAMANCARE_FINANCE_DOCUMENT_PREPARER_ROLES='FINANCE_PREPARER';
 const result=await service.authorize(req,'SUBMIT');
 assert.equal(result.actorId,'MAKER');
 assert.equal(db.queries.length,1);
 assert.match(db.queries[0].sql,/revoked_at IS NULL/);
 assert.match(db.queries[0].sql,/expires_at>now\(\)/);
 await assert.rejects(service.authorize({},'SUBMIT'),/Forbidden|identity/i);
 await assert.rejects(service.authorize(req,'APPROVE'),/Forbidden|role/i);
 process.env.TAMANCARE_FINANCE_DOCUMENT_REVIEWER_ROLES='FINANCE_REVIEWER';
 await assert.rejects(service.authorize(req,'REVIEW'),/Forbidden|role/i);
 db.query=async()=>({rows:[]});
 await assert.rejects(service.authorize(req,'SUBMIT'),/Forbidden|session/i);
 for(const key of ['TAMANCARE_FINANCE_DOCUMENT_PREPARER_ROLES','TAMANCARE_FINANCE_DOCUMENT_REVIEWER_ROLES','TAMANCARE_FINANCE_DOCUMENT_APPROVER_ROLES']) {
  if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];
 }
 console.log('FINANCE_V384_AUTHENTICATED_SESSION_RBAC_FAIL_CLOSED_PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});
