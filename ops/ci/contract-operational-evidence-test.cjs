'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
function find(d,n){for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory()){const a=find(p,n);if(a)return a;}else if(x.name===n)return p;}}
const filename=find(path.join(__dirname,'../../api/dist'),'contract-operational-evidence.service.js');
const old=Module._load;Module._load=function(id,parent,isMain){if(id==='../database/database.service'&&parent?.filename===filename)return {DatabaseService:class{}};return old.apply(this,arguments);};
let Service;try{Service=require(filename).ContractOperationalEvidenceService;}finally{Module._load=old;}
const queries=[];
const db={query:async(sql,args)=>{queries.push(sql);assert.equal(args[0],'CI_R1');
if(sql.includes('FROM public.residents'))return {rows:[{resident_id:'CI_R1',care_level:'ASSISTED'}]};
if(sql.includes('FROM public.admission_care_classifications'))return {rows:[{approved_care_level:'ASSISTED',review_status:'APPROVED',approved_at:'CI_TIME'}]};
if(sql.includes('FROM public.bed_assignments'))return {rows:[{bed_id:'CI_BED',bed_code:'CI_B',room_id:'CI_ROOM',room_code:'CI_R'}]};
throw Error('UNKNOWN_SQL');}};
(async()=>{
const service=new Service(db);
const r=await service.inspect('CI_R1');
assert.equal(r.operationalEvidenceVerified,true);
assert.equal(r.roomId,'CI_ROOM');
assert.equal(r.careLevel,'ASSISTED');
assert.ok(queries.every(q=>/^SELECT\s/i.test(q.trim())));
await assert.rejects(service.inspect('bad/id'),/CONTRACT_RESIDENT_ID_INVALID/);
const missing=new Service({query:async(sql)=>sql.includes('FROM public.residents')?{rows:[{resident_id:'CI_R1',care_level:'ASSISTED'}]}:{rows:[]}});
await assert.rejects(missing.inspect('CI_R1'),/CONTRACT_ADMISSION_CARE_OR_BED_NOT_APPROVED/);
console.log('CONTRACT_CANONICAL_ADMISSION_BED_READ_ONLY_PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
