'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const billing = fs.readFileSync('frontend/src/api/billing.ts', 'utf8');
const billingPage = fs.readFileSync('frontend/src/features/billing/BillingPage.tsx', 'utf8');
const familyPage = fs.readFileSync('frontend/src/features/family-portal/FamilyPortalPage.tsx', 'utf8');

for (const marker of ['mockInvoices', 'mockReceipts', 'mockDetailedFeeNotices', 'res-demo-', 'INV-202609-']) {
  assert.ok(!billing.includes(marker), `legacy mock data remains: ${marker}`);
}
for (const marker of ['FINANCE_BILLING_WRITE_API_NOT_READY', 'FINANCE_PRICING_READ_API_NOT_READY', 'FINANCE_FEE_NOTICE_LIST_API_NOT_READY']) {
  assert.ok(billing.includes(marker), `missing fail-closed API: ${marker}`);
}
assert.ok(billing.includes('basicCarePackages: []'), 'pricing fallback must not publish an unverified tariff');
assert.ok(billingPage.includes('Finance chưa kết nối nguồn dữ liệu đã xác minh'));
assert.ok(familyPage.includes('Chưa thể xác minh thông báo thu phí'));
console.log('TAMANCARE_FINANCE_LEGACY_BILLING_MOCK_AND_WRITE_PATHS_FAIL_CLOSED_PASS');
