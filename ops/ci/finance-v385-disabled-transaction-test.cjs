'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../../api/dist');
function locate(name){let found=[];function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else if(d.name===name)found.push(p)}}walk(root);assert.equal(found.length,1);return found[0]}
const serviceFile=locate('finance-document-transaction.service.js');
const original=Module._load;
Module._load=function(id,parent,main){if(id==='../database/database.service' && parent?.filename===serviceFile)return {DatabaseService:class{}};if(id==='./finance-document-authorization.service' && parent?.filename===serviceFile)return {FinanceDocumentAuthorizationService:class{}};return original.apply(this,arguments)};
let Service;try{Service=require(serviceFile).FinanceDocumentTransactionService}finally{Module._load=original}
async function main(){
 let calls=0,writes=0;
 const db={withTransaction:async()=>{writes++;throw Error('WRITE CALLED')},query:async()=>{writes++;throw Error('QUERY CALLED')}};
 const auth={authorize:async(_req,action)=>{calls++;if(action==='APPROVE')return {actorId:'DIRECTOR',actorRole:'DIRECTOR',sessionId:'CI_SESSION'};throw Error('NOT_AUTHORIZED')}};
 const svc=new Service(db,auth);
 await assert.rejects(svc.transitionInIsolatedLab({}, {documentId:'CI',expectedRevision:1,action:'APPROVE',reason:'Verify evidence'}),/FINANCE_DOCUMENT_WRITE_NOT_AUTHORIZED/);
 await assert.rejects(svc.transitionInIsolatedLab({}, {documentId:'CI',expectedRevision:1,action:'REVIEW',reason:'Verify evidence'}),/NOT_AUTHORIZED/);
 assert.equal(calls,2);assert.equal(writes,0);
 assert.match(Service.isolatedTransitionSql(),/\$1::text/);
 console.log('FINANCE_V385_AUTH_BOUNDARY_WRITE_DISABLED_PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});
