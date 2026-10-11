'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('api/src/app.module.ts');
const moduleSource=read('api/src/paper-records/paper-record.module.ts');
const controller=read('api/src/paper-records/paper-record.controller.ts');
const service=read('api/src/paper-records/paper-record.service.ts');
const middleware=read('api/src/security/production-auth.middleware.ts');
assert.match(app,/PaperRecordModule/);
assert.match(moduleSource,/PaperRecordController/);
assert.match(moduleSource,/PaperRecordService/);
assert.match(moduleSource,/ResidentAccessScopeModule/);
assert.match(service,/canAccessResident/);
assert.match(service,/UnauthorizedException/);
assert.match(middleware,/verifyHs256/);
assert.match(middleware,/auth_sessions/);
assert.match(middleware,/req\.headers\[\s*'x-actor-id'\s*\]\s*=\s*actorId/);
assert.match(middleware,/req\.headers\[\s*'x-actor-role'\s*\]\s*=\s*actorRole/);
// Header-based actor context is safe only behind actually enabled verification.
// This static test is not sufficient proof of runtime security.
assert.match(controller,/@Headers\('x-actor-id'\)/);
assert.match(middleware,/process\.env\.NODE_ENV\s*!==\s*'production'/);
console.log('PAPER_RECORD_SOURCE_INTEGRATION=STATIC_PASS');
console.log('PAPER_RECORD_RUNTIME_JWT_RBAC=NOT_YET_PROVEN');
console.log('PRODUCTION_GO_NO_GO=NO_GO');
