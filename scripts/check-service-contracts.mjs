import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const page = readFileSync('frontend/src/features/service-contracts/ServiceContractsPage.tsx', 'utf8');
const api = readFileSync('frontend/src/api/service-contracts.ts', 'utf8');
const required = [
  'Điều 5. Đánh giá thực trạng người cao tuổi và điều chỉnh mức phí dịch vụ',
  '5.1. Nguyên tắc cung cấp thông tin khi ký hợp đồng',
  '5.2. Thời gian đánh giá thực trạng',
  '5.3. Trường hợp thực trạng phù hợp',
  'Đại diện Thân nhân 1',
  'Đại diện Thân nhân 2',
  'relative2Name: e.target.value',
  'relative2BirthYear: e.target.value',
  'relative2Cccd: e.target.value',
  'relative2Address: e.target.value',
  'relative2Relationship: e.target.value',
  'relative1Address: e.target.value',
  'discountType: e.target.value',
  'discountStartDate: e.target.value',
  'discountEndDate: e.target.value',
  'discountDetails: e.target.value',
  'viewingContract.appendix.discountDetails',
  'viewingContract.partyA.relative2Name',
];
for (const value of required) assert.ok(page.includes(value), `Missing contract requirement: ${value}`);
for (const field of ['discountType?', 'discountStartDate?', 'discountEndDate?', 'discountDetails?']) {
  assert.ok(api.includes(field), `Missing backwards-compatible contract field: ${field}`);
}
assert.ok(!page.includes('the contract can always be saved'), 'Unexpected storage assumption');
console.log('CONTRACT_STATIC_REGRESSION=PASS');
console.log('Checks are static only; API persistence, RBAC, PDF print parity and live-source compatibility remain unverified.');
