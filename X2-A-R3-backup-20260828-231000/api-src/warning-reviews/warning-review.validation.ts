import {
  WarningReviewDecision,
} from './warning-review.types';

export function requireText(
  value: unknown,
  name: string,
): string {

  const normalized =
    String(value ?? '').trim();

  if (!normalized) {
    throw new Error(
      `${name} is required.`,
    );
  }

  return normalized;
}

export function requireDecision(
  value: unknown,
): WarningReviewDecision {

  const allowed:
    WarningReviewDecision[] = [
      'NO_ACTION_REQUIRED',
      'MONITOR',
      'CREATE_CARE_ACTION',
      'ESCALATE',
    ];

  if (
    !allowed.includes(
      value as WarningReviewDecision,
    )
  ) {
    throw new Error(
      'Invalid warning review decision.',
    );
  }

  return value as WarningReviewDecision;
}
