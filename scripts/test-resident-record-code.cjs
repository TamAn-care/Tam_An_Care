/* Regression gate for pure code formatting. No DB or Production Test writes. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const path = require('node:path');
const filename=path.join(__dirname,'../frontend/src/utils/resident-record-code.ts');
const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const sandbox={exports:{}};
vm.runInNewContext(js,sandbox,{filename});
const {formatResidentRecordCode,parseContractSerialAndYear,verifyContractMatchesResidentRecord}=sandbox.exports;
const make=(serial,year,trial=false)=>formatResidentRecordCode({serial,issueYear:year,isTrialWithoutContract:trial});
assert.equal(make('001',2026),'001/2026/TA');
assert.equal(make('001',2026,true),'001/2026/TA/TN');
assert.equal(make('001',2026,false),'001/2026/TA');
assert.equal(make('1000000',2026),'1000000/2026/TA');
assert.equal(make('999999999999999999999999999999',2030),'999999999999999999999999999999/2030/TA');
assert.equal(make('0001',2026),'0001/2026/TA'); // exact source contract token
assert.equal(parseContractSerialAndYear('001/2026/HĐDV-TA').serial,'001');
assert.equal(verifyContractMatchesResidentRecord('001/2026/HĐDV-TA',{serial:'001',issueYear:2026}),true);
assert.equal(verifyContractMatchesResidentRecord('001/2026/HĐDV-TA',{serial:'0001',issueYear:2026}),true);
assert.equal(verifyContractMatchesResidentRecord('002/2026/HĐDV-TA',{serial:'001',issueYear:2026}),false);
assert.equal(verifyContractMatchesResidentRecord('001/2027/HĐDV-TA',{serial:'001',issueYear:2026}),false);
assert.equal(parseContractSerialAndYear('abc/2026/HĐDV-TA'),null);
for(const serial of ['0','0000','-1','1a','', '1.5']) {
  assert.throws(()=>make(serial,2026));
}
for(const year of [0, 10000, 2026.1]) assert.throws(()=>make('001',year));
console.log('RESIDENT_RECORD_CODE_FORMAT_TESTS=PASS');
console.log('NOTE=formatter_tests_only_not_server_allocation');
