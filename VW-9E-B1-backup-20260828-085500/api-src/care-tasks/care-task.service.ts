import {
  Injectable,
} from '@nestjs/common';

import {
  CareTask,
  CareTaskAuditEvent,
  CareTaskPriority,
  CreateCareTaskInput,
} from './care-task.types';

import {
  CareTaskRepository,
} from './care-task.repository';


function requireText(
  value: unknown,
  field: string,
): string {

  const normalized =
    String(
      value ?? '',
    ).trim();

  if (!normalized) {
    throw new Error(
      `${field} is required.`,
    );
  }

  return normalized;
}


function normalizePriority(
  value: unknown,
): CareTaskPriority {

  const normalized =
    String(
      value ?? '',
    )
      .trim()
      .toUpperCase();

  if (
    normalized !== 'LOW' &&
    normalized !== 'MODERATE' &&
    normalized !== 'HIGH'
  ) {
    throw new Error(
      'Priority must be LOW, MODERATE, or HIGH.',
    );
  }

  return normalized as
    CareTaskPriority;
}


function normalizeOptionalDate(
  value: Date | string | null | undefined,
  field: string,
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
      `${field} must be a valid date.`,
    );
  }

  return date;
}


@Injectable()
export class CareTaskService {

  constructor(
    private readonly repository:
      CareTaskRepository,
  ) {}


  async createPlanned(
    input: CreateCareTaskInput,
  ): Promise<CareTask> {

    const scheduledAt =
      normalizeOptionalDate(
        input.scheduledAt,
        'scheduledAt',
      );

    const dueAt =
      normalizeOptionalDate(
        input.dueAt,
        'dueAt',
      );

    if (
      scheduledAt &&
      dueAt &&
      dueAt.getTime() <
        scheduledAt.getTime()
    ) {
      throw new Error(
        'dueAt cannot be earlier than scheduledAt.',
      );
    }

    const normalized:
      CreateCareTaskInput = {

        ...input,

        careTaskId:
          requireText(
            input.careTaskId,
            'careTaskId',
          ),

        carePlanId:
          requireText(
            input.carePlanId,
            'carePlanId',
          ),

        residentId:
          requireText(
            input.residentId,
            'residentId',
          ),

        taskCode:
          requireText(
            input.taskCode,
            'taskCode',
          ),

        title:
          requireText(
            input.title,
            'title',
          ),

        taskCategory:
          requireText(
            input.taskCategory,
            'taskCategory',
          ),

        priority:
          normalizePriority(
            input.priority,
          ),

        scheduledAt,

        dueAt,

        actorId:
          requireText(
            input.actorId,
            'actorId',
          ),

        actorRole:
          requireText(
            input.actorRole,
            'actorRole',
          ),
      };

    return this.repository.create(
      normalized,
    );
  }


  async get(
    careTaskId: string,
  ): Promise<CareTask | null> {

    return this.repository.findById(
      requireText(
        careTaskId,
        'careTaskId',
      ),
    );
  }


  async listForPlan(
    carePlanId: string,
  ): Promise<CareTask[]> {

    return this.repository.findByPlan(
      requireText(
        carePlanId,
        'carePlanId',
      ),
    );
  }


  async listForResident(
    residentId: string,
  ): Promise<CareTask[]> {

    return this.repository.findByResident(
      requireText(
        residentId,
        'residentId',
      ),
    );
  }


  async audit(
    careTaskId: string,
  ): Promise<CareTaskAuditEvent[]> {

    return this.repository.getAudit(
      requireText(
        careTaskId,
        'careTaskId',
      ),
    );
  }
}
