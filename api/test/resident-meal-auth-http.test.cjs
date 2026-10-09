const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
// Isolate the middleware's DI-only database import; the request path still
// exercises real HS256 verification and session validation via a controlled DB stub.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../database/database.service' &&
      parent?.filename?.endsWith('production-auth.middleware.js')) {
    return { DatabaseService: class TestDatabaseToken {} };
  }
  return originalLoad.apply(this, arguments);
};
let ProductionAuthMiddleware;
try {
  ({ ProductionAuthMiddleware } = require('../dist/security/production-auth.middleware.js'));
} finally {
  Module._load = originalLoad;
}

const secret='ci-isolated-jwt-test-secret-key-long-enough';
const sessionId='ci-active-session';
const db={query:async(_sql,args)=>({rows:args[0]===sessionId && args[1]==='ci-caregiver' && args[2]==='CAREGIVER'?[{actor_id:args[1],actor_role:args[2]}]:[]})};
function sign(payload){
  const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const data=b({alg:'HS256',typ:'JWT'})+'.'+b(payload);
  return data+'.'+crypto.createHmac('sha256',secret).update(data).digest('base64url');
}
const valid=sign({sub:'ci-caregiver',role:'CAREGIVER',jti:sessionId,exp:Math.floor(Date.now()/1000)+600});
const spoofed=sign({sub:'ci-caregiver',role:'SUPERVISOR',jti:sessionId,exp:Math.floor(Date.now()/1000)+600});
test('production middleware verifies JWT/session over real HTTP and defeats forged actor headers',async()=>{
 const oldEnv={NODE_ENV:process.env.NODE_ENV,JWT_SECRET:process.env.JWT_SECRET};
 process.env.NODE_ENV='production';process.env.JWT_SECRET=secret;
 const middleware=new ProductionAuthMiddleware(db);
 const server=http.createServer(async (req,res)=>{
   req.originalUrl=req.url;
   req.header=name=>req.headers[name.toLowerCase()];
   try{
     await middleware.use(req,res,()=>{
       res.writeHead(200,{'content-type':'application/json'});
       res.end(JSON.stringify({id:req.headers['x-actor-id'],role:req.headers['x-actor-role']}));
     });
   }catch(e){res.writeHead(e.getStatus?.()||500);res.end('denied');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  const good=await fetch(origin+'/api/resident-meal-registrations',{headers:{
    Authorization:'Bearer '+valid,'x-actor-id':'hacker','x-actor-role':'ADMIN'
  }});
  assert.equal(good.status,200);
  assert.deepEqual(await good.json(),{id:'ci-caregiver',role:'CAREGIVER'});
  for(const headers of [
   {'x-actor-id':'ci-caregiver','x-actor-role':'CAREGIVER'},
   {Authorization:'Bearer '+spoofed},
   {Authorization:'Bearer '+valid.slice(0,-3)+'abc'}
  ]){
   const response=await fetch(origin+'/api/resident-meal-registrations',{headers});
   assert.equal(response.status,401);
  }
 } finally {
   await new Promise(resolve=>server.close(resolve));
   process.env.NODE_ENV=oldEnv.NODE_ENV;
   if(oldEnv.JWT_SECRET===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldEnv.JWT_SECRET;
 }
});
