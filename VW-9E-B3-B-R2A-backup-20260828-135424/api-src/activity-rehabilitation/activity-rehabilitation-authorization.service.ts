import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  RehabActorRole,
  RehabCommand,
} from './activity-rehabilitation.types';

@Injectable()
export class ActivityRehabilitationAuthorizationService {
  private normalizeRole(role: RehabActorRole | string): RehabActorRole {
    return String(role ?? '')
      .trim()
      .toUpperCase() as RehabActorRole;
  }

  assertHuman(command: RehabCommand): void {
    const role = this.normalizeRole(command.actorRole);

    if (role === 'AI' || role === 'SYSTEM') {
      throw new BadRequestException(
        'AI or SYSTEM cannot perform official rehabilitation mutation.',
      );
    }
  }

  assertManager(command: RehabCommand): void {
    this.assertHuman(command);

    const role = this.normalizeRole(command.actorRole);

    if (!['SUPERVISOR', 'CARE_MANAGER'].includes(role)) {
      throw new BadRequestException(
        'Only SUPERVISOR or CARE_MANAGER is authorized.',
      );
    }
  }

  assertClinicalHuman(command: RehabCommand): void {
    this.assertHuman(command);

    const role = this.normalizeRole(command.actorRole);

    if (!['NURSE', 'SUPERVISOR', 'CARE_MANAGER'].includes(role)) {
      throw new BadRequestException(
        'Authorized human clinical reviewer required.',
      );
    }
  }

  assertSessionCreator(command: RehabCommand): void {
    this.assertClinicalHuman(command);
  }

  assertAssignedOwner(
    command: RehabCommand,
    assignedTo: string | null,
  ): void {
    this.assertHuman(command);

    if (!assignedTo || assignedTo !== command.actorId) {
      throw new BadRequestException(
        'Only the assigned human owner may perform this transition.',
      );
    }
  }

  assertReviewer(
    command: RehabCommand,
    reviewer: string | null,
  ): void {
    this.assertHuman(command);

    if (!reviewer || reviewer !== command.actorId) {
      throw new BadRequestException(
        'Only the assigned human reviewer may perform this transition.',
      );
    }
  }
}
