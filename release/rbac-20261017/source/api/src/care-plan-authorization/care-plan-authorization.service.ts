import {
  Injectable,
} from '@nestjs/common';

import {
  CarePlanAuthorizationDecision,
  CarePlanAuthorizationInput,
} from './care-plan-authorization.types';


@Injectable()
export class CarePlanAuthorizationService {

  authorize(
    input: CarePlanAuthorizationInput,
  ): CarePlanAuthorizationDecision {

    const status =
      String(
        input.currentStatus ?? '',
      )
        .trim()
        .toUpperCase();

    const actorId =
      String(
        input.actorId ?? '',
      ).trim();

    const actorRole =
      String(
        input.actorRole ?? '',
      )
        .trim()
        .toUpperCase();

    const action =
      input.action;

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

    if (
      actorRole === 'AI' ||
      actorRole === 'SYSTEM'
    ) {
      throw new Error(
        'AI or SYSTEM actor cannot govern a Care Plan.',
      );
    }

    if (
      actorRole !== 'SUPERVISOR' &&
      actorRole !== 'CARE_MANAGER'
    ) {
      throw new Error(
        'Actor is not authorized to govern this Care Plan.',
      );
    }

    if (
      action === 'ACTIVATE'
    ) {
      if (status !== 'DRAFT') {
        throw new Error(
          'Only a DRAFT Care Plan can be activated.',
        );
      }

      return {
        authorized: true,
        actorId,
        actorRole,
        action,
        targetStatus:
          'ACTIVE',
        auditEvent:
          'PLAN_ACTIVATED',
        autonomousClinicalAction:
          false,
      };
    }

    if (
      action === 'REACTIVATE'
    ) {
      if (
        status !==
        'SUSPENDED'
      ) {
        throw new Error(
          'Only a SUSPENDED Care Plan can be reactivated.',
        );
      }

      return {
        authorized: true,
        actorId,
        actorRole,
        action,
        targetStatus:
          'ACTIVE',
        auditEvent:
          'PLAN_REACTIVATED',
        autonomousClinicalAction:
          false,
      };
    }

    if (
      action === 'SUSPEND'
    ) {
      if (
        status !==
        'ACTIVE'
      ) {
        throw new Error(
          'Only an ACTIVE Care Plan can be suspended.',
        );
      }

      return {
        authorized: true,
        actorId,
        actorRole,
        action,
        targetStatus:
          'SUSPENDED',
        auditEvent:
          'PLAN_SUSPENDED',
        autonomousClinicalAction:
          false,
      };
    }

    if (
      action === 'COMPLETE'
    ) {
      if (
        status !==
        'ACTIVE'
      ) {
        throw new Error(
          'Only an ACTIVE Care Plan can be completed.',
        );
      }

      return {
        authorized: true,
        actorId,
        actorRole,
        action,
        targetStatus:
          'COMPLETED',
        auditEvent:
          'PLAN_COMPLETED',
        autonomousClinicalAction:
          false,
      };
    }

    if (
      action === 'CANCEL'
    ) {
      if (
        status !== 'DRAFT' &&
        status !== 'ACTIVE' &&
        status !== 'SUSPENDED'
      ) {
        throw new Error(
          'Only a DRAFT, ACTIVE, or SUSPENDED Care Plan can be cancelled.',
        );
      }

      return {
        authorized: true,
        actorId,
        actorRole,
        action,
        targetStatus:
          'CANCELLED',
        auditEvent:
          'PLAN_CANCELLED',
        autonomousClinicalAction:
          false,
      };
    }

    throw new Error(
      'Unsupported Care Plan governance action.',
    );
  }
}
