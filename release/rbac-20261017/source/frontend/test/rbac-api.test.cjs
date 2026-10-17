'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('typescript');
function load(name,mocks){const source=fs.readFileSync(require('node:path').join(__dirname,'../src',name),'utf8').replaceAll('import.meta.env.PROD','true');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;const exports={};vm.runInNewContext(js,{exports,require:n=>{if(!(n in mocks))throw Error('Unexpected import '+n);return mocks[n];},console,URLSearchParams,localStorage:{getItem:()=>assert.fail('production must not load local fixtures')}});return exports;}
for(const code of [401,403,404])test('Production resident APIs propagate '+code,async()=>{const error=Error('HTTP '+code);const api=load('api/residents.ts',{'./client':{apiRequest:async()=>{throw error;}}});for(const call of [()=>api.listResidents({actorId:'A',actorRole:'NURSE'}),()=>api.getResident('B',{}),()=>api.getResidentCareView('B',{})])await assert.rejects(call,e=>e===error);});
test('Production empty scoped list remains empty',async()=>{let path;const api=load('api/residents.ts',{'./client':{apiRequest:async p=>{path=p;return [];}}});const result=await api.listResidents({actorRole:'PSYCHOLOGIST'});assert.equal(result.length,0);assert.equal(path,'/api/operations/residents/assigned');assert.equal(api.getStoredResidents().length,0);});
test('Login uses server password authentication and stores JWT',async()=>{let sent,stored;const actor={actorId:'actor-A',actorRole:'NURSE'};const api=load('api/auth.ts',{'./client':{API_BASE_URL:'',apiRequest:async(p,o)=>{sent={p,o};return {accessToken:'ci-token',actor};}},'../auth/session':{storeAccessToken:v=>{stored=v;}},'./staff-actors':{mockStaffActors:[]}});assert.equal(await api.authenticateActor('actor-A',' password '),actor);assert.equal(sent.p,'/api/auth/login');assert.equal(JSON.parse(sent.o.body).password,' password ');assert.equal(stored,'ci-token');await assert.rejects(api.resolveStaffActor('Admin'));});

test('Staff status uses backend and propagates failure instead of local success',async()=>{
 let sent;const error=Error('revocation failed');const api=load('api/staff-actors.ts',{'./client':{apiRequest:async(p,o)=>{sent={p,o};throw error;}}});
 await assert.rejects(api.updateStaffStatus({actorId:'manager-A',actorRole:'SUPERVISOR'},{actorId:'staff-A',status:'SUSPENDED',reason:'test'}),e=>e===error);
 assert.equal(sent.p,'/api/operations/staff-actors/staff-A/status');assert.equal(JSON.parse(sent.o.body).status,'SUSPENDED');
});

for(const code of [401,403,404,500])test('Health report operations propagate HTTP '+code,async()=>{
 const error=Error('HTTP '+code),actor={actorId:'A',actorRole:'NURSE'};
 const api=load('features/health-reports/healthReportsApi.ts',{'../../api/client':{apiRequest:async()=>{throw error;}},'../../auth/session':{}});
 for(const call of [()=>api.listHealthReports(actor),()=>api.createHealthReport(actor,{}),()=>api.updateHealthReport(actor,'B','{}','APPROVED'),()=>api.generateHealthReport(actor,'B'),()=>api.submitHealthReportForReview(actor,'B'),()=>api.approveHealthReport(actor,'B'),()=>api.deliverHealthReport(actor,'B',{})])await assert.rejects(call,e=>e===error);
});
test('Health reports preserve empty result and do not send client approval status',async()=>{
 const calls=[],actor={actorId:'A',actorRole:'NURSE'};
 const api=load('features/health-reports/healthReportsApi.ts',{'../../api/client':{apiRequest:async(p,o)=>{calls.push({p,o});return [];}},'../../auth/session':{}});
 assert.equal((await api.listHealthReports(actor)).length,0);
 await api.createHealthReport(actor,{residentId:'B',initialStatus:'APPROVED'});
 await api.updateHealthReport(actor,'B','{}','APPROVED');
 assert.equal(calls[0].p,'/api/health-reports');
 assert.equal(JSON.parse(calls[1].o.body).initialStatus,undefined);
 assert.deepEqual(JSON.parse(calls[2].o.body),{summary:'{}'});
});
