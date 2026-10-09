'use strict';
/** Audit repository deployment design, never contact servers or inspect secrets. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const files=[
 'docker-compose.production-test.yml',
 'deploy/production/docker-compose.production.yml',
 'deploy/production/nginx/tamancare.conf',
 'ops/x3-production/backup/backup.sh',
 'ops/x3-production/backup/restore.sh',
 'ops/x3-production/dr/verify-restore.sh',
 '.github/workflows/production-test-ci.yml',
 '.github/workflows/contract-release-approval-scaffold.yml'
];
const info=files.map(name=>{
 const p=path.join(root,name);
 if(!fs.existsSync(p))return {name,present:false};
 const buf=fs.readFileSync(p);
 return {name,present:true,bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex')};
});
const workflows=fs.readdirSync(path.join(root,'.github/workflows')).filter(x=>/\.ya?ml$/.test(x));
const candidates=workflows.filter(x=>/deploy|release|production|contract/.test(x));
const findings={
 auditScope:'GITHUB_REPOSITORY_SOURCE_ONLY',
 checked:info,
 candidateWorkflowNames:candidates,
 scheduledServerJobs:'NOT_VERIFIED_ON_RUNTIME',
 cloudflareTunnel:'NOT_VERIFIED_ON_RUNTIME',
 dnsIngress:'NOT_VERIFIED_ON_RUNTIME',
 serverDiskMemory:'NOT_VERIFIED_ON_RUNTIME',
 liveBackupRestore:'NOT_VERIFIED_ON_RUNTIME',
 existingProductionDeploy:'NOT_VERIFIED_ON_RUNTIME',
 deploymentReady:false
};
fs.mkdirSync(path.join(root,'ops/ci/out'),{recursive:true});
fs.writeFileSync(path.join(root,'ops/ci/out/controlled-pull-source-audit.json'),JSON.stringify(findings,null,2)+'\n');
console.log('CONTROLLED_PULL_GITHUB_SOURCE_AUDIT=PASS');
console.log('LIVE_PRODUCTION_AUDIT=PENDING');
console.log('PULL_AGENT_INSTALL=NO');
console.log('DEPLOY=NO MIGRATION=NO SEED=NO');
