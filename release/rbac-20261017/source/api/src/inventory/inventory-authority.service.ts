import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export type InventoryHumanRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'CARE_MANAGER'
  | 'SUPERVISOR';

export interface InventoryActor {
  actorId: string;
  actorRole: InventoryHumanRole;
}

@Injectable()
export class InventoryAuthorityService {
  private readonly humanRoles: InventoryHumanRole[] = [
    'CAREGIVER',
    'NURSE',
    'CARE_MANAGER',
    'SUPERVISOR',
  ];

  private readonly authorityRoles: InventoryHumanRole[] = [
    'CARE_MANAGER',
    'SUPERVISOR',
  ];

  constructor(private readonly database: DatabaseService) {}

  async requireActor(
    actorId?: string,
    actorRole?: string,
    client?: PoolClient,
  ): Promise<InventoryActor> {
    const id = String(actorId || '').trim();
    const role =
      String(actorRole || '').trim().toUpperCase() as InventoryHumanRole;

    if (!id || !role) {
      throw new UnauthorizedException('Actor context is required');
    }

    if (!this.humanRoles.includes(role)) {
      throw new ForbiddenException('Human operational role is required');
    }

    const query = client
      ? client.query.bind(client)
      : this.database.query.bind(this.database);

    const result = await query(
      `
      SELECT actor_id, primary_operational_role, status
      FROM staff_actors
      WHERE actor_id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rowCount) {
      throw new UnauthorizedException('Canonical actor not found');
    }

    const actor: any = result.rows[0];

    if (actor.status !== 'ACTIVE') {
      throw new ForbiddenException('Canonical actor is not active');
    }

    if (actor.primary_operational_role !== role) {
      throw new ForbiddenException(
        'Actor role does not match canonical role',
      );
    }

    return {
      actorId: actor.actor_id,
      actorRole: actor.primary_operational_role,
    };
  }

  requireAuthority(actor: InventoryActor): void {
    if (!this.authorityRoles.includes(actor.actorRole)) {
      throw new ForbiddenException(
        'Care manager or supervisor authority is required',
      );
    }
  }
}
