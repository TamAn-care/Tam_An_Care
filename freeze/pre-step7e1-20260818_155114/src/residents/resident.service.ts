import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ResidentContext,
  ResidentContextResponse,
} from './resident.types';

@Injectable()
export class ResidentService {
  private readonly residents: ResidentContext[] = [
    {
      residentId: 'resident-demo-001',
      residentCode: 'TA-DEMO-001',
      displayName: 'Development Resident',
      dateOfBirth: '1945-01-01',
      gender: 'UNSPECIFIED',
      room: 'DEV-01',
      bed: 'A',
      careLevel: 'ASSISTED',
      activeStatus: true,
    },
  ];

  list(): ResidentContextResponse[] {
    return this.residents.map((resident) => ({
      resident,
      source: 'V7.4.3_DEVELOPMENT_CONTEXT',
      clinicalRecord: false,
    }));
  }

  getById(residentId: string): ResidentContextResponse {
    const resident = this.residents.find(
      (item) => item.residentId === residentId,
    );

    if (!resident) {
      throw new NotFoundException('Resident context not found.');
    }

    return {
      resident,
      source: 'V7.4.3_DEVELOPMENT_CONTEXT',
      clinicalRecord: false,
    };
  }
}
