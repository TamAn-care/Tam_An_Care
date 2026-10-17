import {
  Injectable,
} from '@nestjs/common';

import {
  ResolutionAuthorizationDecision,
  ResolutionAuthorizationInput,
} from './resolution-authorization.types';

@Injectable()
export class ResolutionAuthorizationService {

  authorize(
    input: ResolutionAuthorizationInput,
  ): ResolutionAuthorizationDecision {

    const status =
      String(
        input.status ?? '',
      ).trim();

    const assignedTo =
      String(
        input.assignedTo ?? '',
      ).trim();

    const assignedRole =
      String(
        input.assignedRole ?? '',
      ).trim();

    const actorId =
      String(
        input.actorId ?? '',
      ).trim();

    const actorRole =
      String(
        input.actorRole ?? '',
      ).trim();

    const careNote =
      String(
        input.careNote ?? '',
      ).trim();

    const resolutionReason =
      String(
        input.resolutionReason ?? '',
      ).trim();

    if (
      status !== 'IN_REVIEW'
    ) {
      throw new Error(
        'Only an IN_REVIEW Care Action can be resolved.',
      );
    }

    if (
      !assignedTo ||
      !assignedRole
    ) {
      throw new Error(
        'Care Action must have an assigned human owner before resolution.',
      );
    }

    if (
      !input.reviewStartedAt
    ) {
      throw new Error(
        'Care Action review must be started before resolution.',
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

    if (!careNote) {
      throw new Error(
        'careNote is required.',
      );
    }

    if (!resolutionReason) {
      throw new Error(
        'resolutionReason is required.',
      );
    }

    const normalizedRole =
      actorRole.toUpperCase();

    if (
      normalizedRole === 'AI' ||
      normalizedRole === 'SYSTEM'
    ) {
      throw new Error(
        'AI or SYSTEM actor cannot resolve a Care Action.',
      );
    }

    if (
      actorId === assignedTo
    ) {
      return {
        authorized: true,
        actorId,
        actorRole,
        authorizationType:
          'OWNER',
        autonomousClinicalAction:
          false,
      };
    }

    if (
      normalizedRole ===
        'SUPERVISOR'
    ) {
      return {
        authorized: true,
        actorId,
        actorRole,
        authorizationType:
          'SUPERVISOR_OVERRIDE',
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
        actorRole,
        authorizationType:
          'CARE_MANAGER_OVERRIDE',
        autonomousClinicalAction:
          false,
      };
    }

    throw new Error(
      'Actor is not authorized to resolve this Care Action.',
    );
  }
}
