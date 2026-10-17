import { Injectable } from '@nestjs/common';
import {
  NutritionActorRole,
  NutritionCommand,
} from './nutrition-hydration.types';

@Injectable()
export class NutritionHydrationAuthorizationService {
  actor(input: NutritionCommand) {
    const actorId = String(input.actorId ?? '').trim();
    const actorRole = (
      String(input.actorRole ?? '').trim().toUpperCase()
    ) as NutritionActorRole;

    if (!actorId) {
      throw new Error('actorId is required.');
    }

    if (!actorRole) {
      throw new Error('actorRole is required.');
    }

    return { actorId, actorRole };
  }

  requireHuman(input: NutritionCommand) {
    const actor = this.actor(input);

    if (
      actor.actorRole === 'AI' ||
      actor.actorRole === 'SYSTEM'
    ) {
      throw new Error(
        'AI or SYSTEM cannot perform official nutrition mutation.',
      );
    }

    if (
      ![
        'CAREGIVER',
        'NURSE',
        'SUPERVISOR',
        'CARE_MANAGER',
      ].includes(actor.actorRole)
    ) {
      throw new Error('Actor is not authorized.');
    }

    return actor;
  }

  requireClinical(input: NutritionCommand) {
    const actor = this.requireHuman(input);

    if (
      ![
        'NURSE',
        'SUPERVISOR',
        'CARE_MANAGER',
      ].includes(actor.actorRole)
    ) {
      throw new Error(
        'Authorized clinical human role is required.',
      );
    }

    return actor;
  }

  requireGovernance(input: NutritionCommand) {
    const actor = this.requireHuman(input);

    if (
      ![
        'SUPERVISOR',
        'CARE_MANAGER',
      ].includes(actor.actorRole)
    ) {
      throw new Error(
        'Supervisor or Care Manager authorization is required.',
      );
    }

    return actor;
  }

  requireAlertCreator(input: NutritionCommand) {
    const actor = this.actor(input);

    if (actor.actorRole === 'SYSTEM') {
      throw new Error(
        'SYSTEM cannot create official nutrition alert.',
      );
    }

    if (actor.actorRole === 'AI') {
      if (
        String(input.sourceType ?? '').toUpperCase()
        !== 'AI_ALERT'
      ) {
        throw new Error(
          'AI may create suspected alert only as AI_ALERT.',
        );
      }

      return actor;
    }

    return this.requireHuman(input);
  }
}
