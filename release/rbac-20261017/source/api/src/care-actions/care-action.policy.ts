import {
  CareActionStatus,
} from './care-action.types';


const ALLOWED_TRANSITIONS:
  Record<
    CareActionStatus,
    readonly CareActionStatus[]
  > = {

    PENDING: [
      'IN_REVIEW',
    ],

    IN_REVIEW: [
      'RESOLVED',
    ],

    RESOLVED: [
      'IN_REVIEW',
    ],

  };


export function canTransitionCareAction(
  from: CareActionStatus,
  to: CareActionStatus,
): boolean {

  return ALLOWED_TRANSITIONS[
    from
  ].includes(to);

}


export function assertCareActionTransition(
  from: CareActionStatus,
  to: CareActionStatus,
): void {

  if (
    !canTransitionCareAction(
      from,
      to,
    )
  ) {

    throw new Error(
      `Invalid Care Action transition: ${from} -> ${to}`,
    );

  }

}
