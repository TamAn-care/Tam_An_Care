'use strict';
// Isolated source contract: both query variants must apply one identical,
// deterministic name-first order BEFORE pagination, never use resident codes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/residents/resident.repository.ts'),'utf8');
test('full list and paginated list both sort by Vietnamese given name',()=>{
  const orders=[...src.matchAll(/ORDER BY\s+([\s\S]*?)(?=\n\s*(?:\x60|LIMIT \$1))/g)]
    .map(x=>x[1]).filter(x=>x.includes('display_name'));
  assert.equal(orders.length,2,'expected two resident list ORDER BY clauses');
  assert.equal(orders[0].trim(),orders[1].trim(),'pagination must share list ordering');
  for(const order of orders){
    assert.match(order,/regexp_replace\(btrim\(display_name\)/);
    assert.match(order,/COLLATE "vi-x-icu"/);
    assert.match(order,/resident_id ASC/);
    assert.doesNotMatch(order,/resident_code|date_of_admission|contract/i);
  }
});
