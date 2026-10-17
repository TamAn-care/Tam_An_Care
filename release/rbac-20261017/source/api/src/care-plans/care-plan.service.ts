import {
  Injectable,
} from '@nestjs/common';

import {
  CarePlan,
  CarePlanAuditEvent,
  CreateCarePlanInput,
} from './care-plan.types';

import {
  CarePlanRepository,
} from './care-plan.repository';

function requireText(
  value: unknown,
  field: string,
): string {
  const normalized =
    String(value ?? '').trim();

  if (!normalized) {
    throw new Error(
      `${field} is required.`,
    );
  }

  return normalized;
}

@Injectable()
export class CarePlanService {

  constructor(
    private readonly repository:
      CarePlanRepository,
  ) {}

  async createDraft(
    input: CreateCarePlanInput,
  ): Promise<CarePlan> {

    const normalized:
      CreateCarePlanInput = {
        ...input,

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

        planCode:
          requireText(
            input.planCode,
            'planCode',
          ),

        title:
          requireText(
            input.title,
            'title',
          ),

        createdBy:
          requireText(
            input.createdBy,
            'createdBy',
          ),

        createdByRole:
          requireText(
            input.createdByRole,
            'createdByRole',
          ),
      };

    return this.repository.create(
      normalized,
    );
  }


  async get(
    carePlanId: string,
  ): Promise<CarePlan | null> {

    return this.repository.findById(
      requireText(
        carePlanId,
        'carePlanId',
      ),
    );
  }


  async listForResident(
    residentId: string,
  ): Promise<CarePlan[]> {

    return this.repository.findByResident(
      requireText(
        residentId,
        'residentId',
      ),
    );
  }


  async audit(
    carePlanId: string,
  ): Promise<CarePlanAuditEvent[]> {

    return this.repository.getAudit(
      requireText(
        carePlanId,
        'carePlanId',
      ),
    );
  }
}
