'use strict';
const fs=require('node:fs'),path=require('node:path');let modules=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.ts')&&!file.endsWith('.d.ts')){const output=file.replace(/^src/,'dist').replace(/\.ts$/,'.js');if(!fs.existsSync(output))throw Error('Missing compiled module: '+output);modules++;}}}
walk('src');for(const file of ['security/production-auth.middleware','resident-access-scope/guardian-resident.service','resident-access-scope/assigned-resident.controller','clinical-observations/vital-sign.service'])require('../dist/'+file);console.log('BUILD_OUTPUT=PASS modules='+modules);
