import {
  Injectable,
} from '@nestjs/common';

import {
  CareActionService,
} from '../care-actions/care-action.service';

import {
  CareActionPriority,
} from '../care-actions/care-action.types';

import {
  AcceptResponsibilityInput,
  ResponsibilityAcceptanceResult,
} from './responsibility-acceptance.types';

@Injectable()
export class ResponsibilityAcceptanceService {

  constructor(
    private readonly careActions:
      CareActionService,
  ) {}


  private requireText(
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


  private normalizeDueAt(
    value:
      Date | string | null | undefined,
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
        ? value
        : new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      throw new Error(
        'dueAt is invalid.',
      );
    }

    return date;
  }


  private normalizePriority(
    value:
      CareActionPriority,
  ): CareActionPriority {

    const allowed:
      CareActionPriority[] = [
        'LOW',
        'MODERATE',
        'HIGH',
      ];

    if (
      !allowed.includes(value)
    ) {
      throw new Error(
        'priority is invalid.',
      );
    }

    return value;
  }


  async accept(
    input:
      AcceptResponsibilityInput,
  ): Promise<ResponsibilityAcceptanceResult> {

    const residentId =
      this.requireText(
        input.residentId,
        'residentId',
      );

    const patternId =
      this.requireText(
        input.patternId,
        'patternId',
      );

    const actorId =
      this.requireText(
        input.actorId,
        'actorId',
      );

    const actorRole =
      this.requireText(
        input.actorRole,
        'actorRole',
      );

    const priority =
      this.normalizePriority(
        input.priority,
      );

    const dueAt =
      this.normalizeDueAt(
        input.dueAt,
      );

    const existing =
      await this.careActions.get(
        residentId,
        patternId,
      );

    if (!existing) {
      throw new Error(
        'Care Action not found.',
      );
    }

    if (
      existing.status !==
        'PENDING'
    ) {
      throw new Error(
        'Only a PENDING Care Action can be accepted.',
      );
    }

    if (
      existing.assignedTo !== null ||
      existing.assignedRole !== null
    ) {
      throw new Error(
        'Care Action responsibility has already been accepted.',
      );
    }

    /*
     * HUMAN SELF-ACCEPTANCE:
     *
     * The actor accepting responsibility
     * becomes the assignee.
     *
     * AI cannot provide or substitute
     * this human identity.
     */

    const assigned =
      await this.careActions.assign(
        residentId,
        patternId,
        {
          assignedTo:
            actorId,

          assignedRole:
            actorRole,

          priority,

          dueAt,

          actorId,
          actorRole,
        },
      );

    if (
      assigned.assignedTo !== actorId ||
      assigned.assignedRole !== actorRole
    ) {
      throw new Error(
        'Responsibility acceptance identity mismatch.',
      );
    }

    return {
      careActionId:
        assigned.id,

      residentId:
        assigned.residentId,

      patternId:
        assigned.patternId,

      status:
        assigned.status,

      acceptedBy:
        actorId,

      acceptedRole:
        actorRole,

      acceptedAt:
        assigned.assignedAt,

      priority:
        assigned.priority,

      dueAt:
        assigned.dueAt,

      responsibilityStatus:
        'ACCEPTED',

      autonomousClinicalAction:
        false,
    };
  }
}
