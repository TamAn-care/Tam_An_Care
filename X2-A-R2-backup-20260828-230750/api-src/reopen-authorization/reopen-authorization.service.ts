import {
  Injectable,
} from '@nestjs/common';

import {
  ReopenAuthorizationDecision,
  ReopenAuthorizationInput,
} from './reopen-authorization.types';

@Injectable()
export class ReopenAuthorizationService {

  authorize(
    input: ReopenAuthorizationInput,
  ): ReopenAuthorizationDecision {

    const status =
      String(
        input.status ?? '',
      ).trim();

    const actorId =
      String(
        input.actorId ?? '',
      ).trim();

    const actorRole =
      String(
        input.actorRole ?? '',
      ).trim();

    const reopenReason =
      String(
        input.reopenReason ?? '',
      ).trim();

    if (
      status !==
      'RESOLVED'
    ) {
      throw new Error(
        'Only a RESOLVED Care Action can be reopened.',
      );
    }

    if (
      !input.resolvedAt
    ) {
      throw new Error(
        'Care Action must have a resolved timestamp before reopen.',
      );
    }

    if (!actorId) {
      throw new Error(
        'actorId is required.',
      );
    }

    if (!actorRole) {
      throw new Error(
        'actorRole is required.',
      );
    }

    if (!reopenReason) {
      throw new Error(
        'reopenReason is required.',
      );
    }

    const normalizedRole =
      actorRole.toUpperCase();

    if (
      normalizedRole === 'AI' ||
      normalizedRole === 'SYSTEM'
    ) {
      throw new Error(
        'AI or SYSTEM actor cannot reopen a Care Action.',
      );
    }

    if (
      normalizedRole ===
      'SUPERVISOR'
    ) {
      return {
        authorized: true,
        actorId,
        actorRole:
          normalizedRole,
        reason:
          'SUPERVISOR_REOPEN',
        autonomousClinicalAction:
          false,
      };
    }

    if (
      normalizedRole ===
      'CARE_MANAGER'
    ) {
      return {
        authorized: true,
        actorId,
        actorRole:
          normalizedRole,
        reason:
          'CARE_MANAGER_REOPEN',
        autonomousClinicalAction:
          false,
      };
    }

    throw new Error(
      'Actor is not authorized to reopen this Care Action.',
    );
  }
}
