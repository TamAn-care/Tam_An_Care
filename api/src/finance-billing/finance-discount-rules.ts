export type DiscountType = 'PERCENT' | 'FIXED_AMOUNT';
export type DiscountMode = 'PERCENT' | 'MONTHLY_PRORATED' | 'ONE_TIME';
export type FeeScope = 'ROOM' | 'CARE' | 'ROOM_AND_CARE' | 'ELIGIBLE_SERVICES';

export interface DiscountPolicyV1 {
  id: string;
  type: DiscountType;
  valueVnd: bigint;
  mode: DiscountMode;
  scope: FeeScope;
  effectiveFrom: string;
  effectiveTo: string | null;
  approved: boolean;
}

export interface EligibleFeeSegment {
  scope: 'ROOM' | 'CARE' | 'SERVICE' | 'DEPOSIT' | 'THIRD_PARTY' | 'MEDICINE' | 'OTHER';
  from: string;
  to: string;
  amountVnd: bigint;
}

export interface DiscountResult {
  amountVnd: bigint;
  eligibleBaseVnd: bigint;
  effectiveDays: number;
  periodDays: number;
}

const DAY_MS = 86_400_000;
const dateMs = (date: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('INVALID_DATE');
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw new Error('INVALID_DATE');
  return ms;
};
const daysBetweenInclusive = (from: string, to: string): number => {
  const days = (dateMs(to) - dateMs(from)) / DAY_MS + 1;
  if (days < 1 || !Number.isInteger(days)) throw new Error('INVALID_DATE_RANGE');
  return days;
};
const halfUp = (numerator: bigint, denominator: bigint): bigint => {
  if (numerator < 0n || denominator <= 0n) throw new Error('INVALID_MONEY');
  return (numerator + denominator / 2n) / denominator;
};

function scopeEligible(scope: FeeScope, fee: EligibleFeeSegment['scope']): boolean {
  if (fee === 'DEPOSIT' || fee === 'THIRD_PARTY' || fee === 'MEDICINE' || fee === 'OTHER') return false;
  if (scope === 'ROOM') return fee === 'ROOM';
  if (scope === 'CARE') return fee === 'CARE';
  if (scope === 'ROOM_AND_CARE') return fee === 'ROOM' || fee === 'CARE';
  return fee === 'SERVICE';
}

export function calculateDiscountV1(input: {
  policy: DiscountPolicyV1;
  periodFrom: string;
  periodTo: string;
  segments: EligibleFeeSegment[];
  sourceKey?: string;
}): DiscountResult {
  const { policy } = input;
  if (!policy.approved) throw new Error('DISCOUNT_NOT_APPROVED');
  if (policy.valueVnd < 0n || (policy.type === 'PERCENT' && policy.valueVnd > 100n)) throw new Error('INVALID_DISCOUNT_VALUE');
  if ((policy.type === 'PERCENT') !== (policy.mode === 'PERCENT')) throw new Error('INVALID_DISCOUNT_MODE');
  const periodDays = daysBetweenInclusive(input.periodFrom, input.periodTo);
  const effectiveFrom = Math.max(dateMs(input.periodFrom), dateMs(policy.effectiveFrom));
  const effectiveTo = Math.min(dateMs(input.periodTo), policy.effectiveTo ? dateMs(policy.effectiveTo) : dateMs(input.periodTo));
  if (policy.effectiveTo && dateMs(policy.effectiveTo) < dateMs(policy.effectiveFrom)) throw new Error('INVALID_DATE_RANGE');
  if (effectiveTo < effectiveFrom) return { amountVnd: 0n, eligibleBaseVnd: 0n, effectiveDays: 0, periodDays };
  const effectiveDays = Math.floor((effectiveTo - effectiveFrom) / DAY_MS) + 1;
  let eligibleBaseVnd = 0n;
  let percentDiscount = 0n;
  for (const segment of input.segments) {
    if (segment.amountVnd < 0n) throw new Error('INVALID_ELIGIBLE_AMOUNT');
    if (!scopeEligible(policy.scope, segment.scope)) continue;
    const clippedFrom = Math.max(effectiveFrom, dateMs(segment.from));
    const clippedTo = Math.min(effectiveTo, dateMs(segment.to));
    if (clippedTo < clippedFrom) continue;
    const segmentDays = daysBetweenInclusive(segment.from, segment.to);
    const applicableDays = Math.floor((clippedTo - clippedFrom) / DAY_MS) + 1;
    const eligible = segmentDays === applicableDays
      ? segment.amountVnd
      : halfUp(segment.amountVnd * BigInt(applicableDays), BigInt(segmentDays));
    eligibleBaseVnd += eligible;
    if (policy.type === 'PERCENT') percentDiscount += halfUp(eligible * policy.valueVnd, 100n);
  }
  let amountVnd: bigint;
  if (policy.type === 'PERCENT') amountVnd = percentDiscount;
  else if (policy.mode === 'MONTHLY_PRORATED') amountVnd = halfUp(policy.valueVnd * BigInt(effectiveDays), BigInt(periodDays));
  else {
    if (!input.sourceKey?.trim()) throw new Error('ONE_TIME_SOURCE_KEY_REQUIRED');
    amountVnd = policy.valueVnd;
  }
  if (amountVnd > eligibleBaseVnd) amountVnd = eligibleBaseVnd;
  return { amountVnd, eligibleBaseVnd, effectiveDays, periodDays };
}

export function rejectOverlappingDiscounts(effectiveRanges: Array<{ from: string; to: string | null }>): void {
  const sorted = effectiveRanges.map((range) => ({
    from: dateMs(range.from),
    to: range.to === null ? Number.POSITIVE_INFINITY : dateMs(range.to),
  })).sort((a, b) => a.from - b.from);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].from <= sorted[index - 1].to) throw new Error('OVERLAPPING_DISCOUNTS_REQUIRE_EXPLICIT_APPROVAL');
  }
}

export function eligibleMealDeductionDates(input: {
  absenceFrom: string;
  absenceTo: string;
  notifiedAt: string;
  familyConfirmed: boolean;
  requiredUpdateDates: string[];
}): string[] {
  const from = dateMs(input.absenceFrom);
  const to = dateMs(input.absenceTo);
  if (to < from) throw new Error('INVALID_DATE_RANGE');
  const firstDayStart = new Date(from).toISOString().slice(0, 10) + 'T00:00:00+07:00';
  const noticeMs = Date.parse(input.notifiedAt);
  const startsInHcm = Date.parse(firstDayStart);
  if (!Number.isFinite(noticeMs)) throw new Error('INVALID_NOTIFICATION_TIMESTAMP');
  const advanceNotice = startsInHcm - noticeMs >= 48 * 60 * 60 * 1000;
  if (!input.familyConfirmed) return [];
  const updates = new Set(input.requiredUpdateDates);
  const eligible: string[] = [];
  for (let cursor = from; cursor <= to; cursor += DAY_MS) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    if (cursor === from && !advanceNotice) continue;
    if (cursor !== from && !updates.has(date)) continue;
    eligible.push(date);
  }
  return eligible;
}
