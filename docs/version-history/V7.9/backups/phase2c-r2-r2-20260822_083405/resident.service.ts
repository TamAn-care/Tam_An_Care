import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ResidentRepository } from './resident.repository';

import {
  ResidentContextResponse,
} from './resident.types';

@Injectable()
export class ResidentService {
  constructor(
    private readonly repository:
      ResidentRepository,
  ) {}

  async list():
    Promise<ResidentContextResponse[]> {
    const residents =
      await this.repository.list();

    return residents.map(
      (resident) => ({
        resident,
        source:
          'V7.4.3_DEVELOPMENT_CONTEXT',
        clinicalRecord:
          false,
      }),
    );
  }

  async getById(
    residentId: string,
  ): Promise<ResidentContextResponse> {
    const normalizedResidentId =
      String(residentId || '').trim();

    if (!normalizedResidentId) {
      throw new NotFoundException(
        'Resident context not found.',
      );
    }

    const resident =
      await this.repository.findById(
        normalizedResidentId,
      );

    if (!resident) {
      throw new NotFoundException(
        'Resident context not found.',
      );
    }

    return {
      resident,
      source:
        'V7.4.3_DEVELOPMENT_CONTEXT',
      clinicalRecord:
        false,
    };
  }
}
