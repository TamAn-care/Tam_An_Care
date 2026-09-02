import {
  Injectable,
} from '@nestjs/common';

import {
  StartReviewAuthorizationInput,
  StartReviewAuthorizationResult,
} from './start-review-authorization.types';

@Injectable()
export class StartReviewAuthorizationService {

  private readonly supervisorRoles =
    new Set<string>([
      'SUPERVISOR',
      'CARE_MANAGER',
    ]);


  private requireText(
    value: unknown,
    name: string,
  ): string {

    const normalized =
      String(
        value ?? '',
      ).trim();

    if (!normalized) {
      throw new Error(
        `${name} is required.`,
      );
    }

    return normalized;
  }


  private normalizeRole(
    value: unknown,
  ): string {

    return this.requireText(
      value,
      'actorRole',
    ).toUpperCase();
  }


  authorize(
    input:
      StartReviewAuthorizationInput,
  ): StartReviewAuthorizationResult {

    const action =
      input.action;

    if (!action) {
      throw new Error(
        'Care Action is required.',
      );
    }

    const actorId =
      this.requireText(
        input.actorId,
        'actorId',
      );

    const actorRole =
      this.normalizeRole(
        input.actorRole,
      );

    if (
      actorRole === 'AI' ||
      actorRole === 'SYSTEM'
    ) {
      throw new Error(
        'AI or SYSTEM actor cannot start Care Action review.',
      );
    }

    if (
      action.status !==
        'PENDING'
    ) {
      throw new Error(
        'Only a PENDING Care Action can start review.',
      );
    }

    if (
      !action.assignedTo ||
      !action.assignedRole
    ) {
      throw new Error(
        'Care Action must have an assigned human owner before review can start.',
      );
    }

    const isOwner =
      actorId ===
        action.assignedTo;

    const isSupervisor =
      this.supervisorRoles
        .has(
          actorRole,
        );

    if (
      !isOwner &&
      !isSupervisor
    ) {
      throw new Error(
        'Actor is not authorized to start review for this Care Action.',
      );
    }

    const mode =
      isOwner
        ? 'OWNER' as const
        : 'SUPERVISOR_OVERRIDE' as const;

    return {
      authorized:
        true,

      mode,

      careActionId:
        action.id,

      residentId:
        action.residentId,

      patternId:
        action.patternId,

      ownerId:
        action.assignedTo,

      ownerRole:
        action.assignedRole,

      actorId,

      actorRole,

      ownershipChanged:
        false,

      transferRequired:
        false,

      auditEvent:
        'REVIEW_STARTED',

      autonomousClinicalAction:
        false,
    };
  }
}
