import {
  CARE_ACTION_PRIORITIES,
  CARE_ACTION_STATUSES,
  CareActionPriority,
  CareActionStatus,
} from './care-action.types';


export function isCareActionStatus(
  value: unknown,
): value is CareActionStatus {

  return (
    typeof value === 'string' &&
    (
      CARE_ACTION_STATUSES as readonly string[]
    ).includes(value)
  );

}


export function isCareActionPriority(
  value: unknown,
): value is CareActionPriority {

  return (
    typeof value === 'string' &&
    (
      CARE_ACTION_PRIORITIES as readonly string[]
    ).includes(value)
  );

}


export function requireNonEmptyText(
  value: unknown,
  fieldName: string,
): string {

  const normalized =
    String(value ?? '').trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return normalized;

}


export function normalizeNullableDate(
  value: Date | string | null | undefined,
): Date | null {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      'Invalid date value.',
    );
  }

  return date;

}


export function assertValidPriority(
  value: unknown,
): CareActionPriority {

  if (!isCareActionPriority(value)) {
    throw new Error(
      'Priority must be HIGH, MODERATE, or LOW.',
    );
  }

  return value;

}
