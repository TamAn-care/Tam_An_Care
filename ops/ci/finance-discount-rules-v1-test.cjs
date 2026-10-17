'use strict';
const assert = require('node:assert/strict');
const {
  calculateDiscountV1,
  eligibleMealDeductionDates,
  rejectOverlappingDiscounts,
} = require('../../api/dist/finance-billing/finance-discount-rules');

const period = { periodFrom: '2026-10-01', periodTo: '2026-10-31' };
const room = [{ scope: 'ROOM', from: period.periodFrom, to: period.periodTo, amountVnd: 3_100_000n }];
const policy = (overrides = {}) => ({
  id: 'discount-v1', type: 'PERCENT', valueVnd: 10n, mode: 'PERCENT', scope: 'ROOM',
  effectiveFrom: '2026-10-01', effectiveTo: null, approved: true, ...overrides,
});

assert.equal(calculateDiscountV1({ policy: policy(), ...period, segments: room }).amountVnd, 310_000n);
assert.equal(calculateDiscountV1({
  policy: policy({ effectiveFrom: '2026-10-16', effectiveTo: '2026-10-31' }),
  ...period, segments: room,
}).amountVnd, 160_000n, 'round half up at the eligible fee segment');
assert.equal(calculateDiscountV1({
  policy: policy({ type: 'FIXED_AMOUNT', valueVnd: 1_000_000n, mode: 'MONTHLY_PRORATED', effectiveFrom: '2026-10-16' }),
  ...period, segments: room,
}).amountVnd, 516_129n, 'monthly fixed discount is prorated once across the month');
assert.equal(calculateDiscountV1({
  policy: policy({ type: 'FIXED_AMOUNT', valueVnd: 9_000_000n, mode: 'ONE_TIME' }),
  ...period, segments: room, sourceKey: 'approved-event-2026-10-001',
}).amountVnd, 3_100_000n, 'discount is capped by eligible fees');
assert.throws(() => calculateDiscountV1({
  policy: policy({ type: 'FIXED_AMOUNT', mode: 'ONE_TIME' }), ...period, segments: room,
}), /ONE_TIME_SOURCE_KEY_REQUIRED/);
assert.equal(calculateDiscountV1({
  policy: policy({ effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30' }), ...period, segments: room,
}).amountVnd, 0n);
assert.equal(calculateDiscountV1({
  policy: policy({ scope: 'ROOM_AND_CARE' }), ...period,
  segments: [...room, { scope: 'DEPOSIT', from: period.periodFrom, to: period.periodTo, amountVnd: 800_000n }],
}).eligibleBaseVnd, 3_100_000n, 'deposits are never eligible');
assert.throws(() => calculateDiscountV1({ policy: policy({ approved: false }), ...period, segments: room }), /DISCOUNT_NOT_APPROVED/);
assert.throws(() => rejectOverlappingDiscounts([
  { from: '2026-10-01', to: null }, { from: '2026-11-01', to: null },
]), /OVERLAPPING_DISCOUNTS/);
assert.deepEqual(eligibleMealDeductionDates({
  absenceFrom: '2026-10-10', absenceTo: '2026-10-12',
  notifiedAt: '2026-10-08T00:00:00+07:00', familyConfirmed: true, requiredUpdateDates: ['2026-10-11'],
}), ['2026-10-10', '2026-10-11']);
assert.deepEqual(eligibleMealDeductionDates({
  absenceFrom: '2026-10-10', absenceTo: '2026-10-12',
  notifiedAt: '2026-10-09T00:00:00+07:00', familyConfirmed: true, requiredUpdateDates: ['2026-10-11'],
}), ['2026-10-11'], 'late notice retains day one and only updated following days qualify');
assert.deepEqual(eligibleMealDeductionDates({
  absenceFrom: '2026-10-10', absenceTo: '2026-10-12',
  notifiedAt: '2026-10-08T00:00:00+07:00', familyConfirmed: false, requiredUpdateDates: [],
}), [], 'unconfirmed absence cannot reduce meal charges');
console.log('FINANCE_DISCOUNT_AND_ABSENCE_V1_PASS');
