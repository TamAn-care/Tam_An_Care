import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ResidentRepository } from './resident.repository';

import {
  CreateResidentInput,
  ResidentCareLevel,
  ResidentContextResponse,
  ResidentGender,
} from './resident.types';

@Injectable()
export class ResidentService {
  constructor(
    private readonly repository:
      ResidentRepository,
  ) {}


  async authorizeSupervisor(
    actorId?: string,
    actorRole?: string,
  ): Promise<void> {
    if (!actorId || !actorRole) {
      throw new UnauthorizedException(
        'Actor context is required',
      );
    }

    if (actorRole !== 'SUPERVISOR') {
      throw new ForbiddenException(
        'Supervisor authority is required',
      );
    }

    const valid =
      await this.repository.resolveActiveSupervisor(
        actorId,
      );

    if (!valid) {
      throw new ForbiddenException(
        'Canonical active Supervisor is required',
      );
    }
  }

  async create(
    body: {
      residentCode?: string;
      displayName?: string;
      dateOfBirth?: string;
      gender?: string;
      room?: string | null;
      bed?: string | null;
      careLevel?: string;
    },
    performedBy: string,
  ): Promise<ResidentContextResponse> {
    const residentCode =
      String(body.residentCode || '').trim();

    const displayName =
      String(body.displayName || '').trim();

    const dateOfBirth =
      String(body.dateOfBirth || '').trim();

    const gender =
      String(body.gender || '')
        .trim()
        .toUpperCase();

    const careLevel =
      String(body.careLevel || '')
        .trim()
        .toUpperCase();

    if (!residentCode) {
      throw new BadRequestException(
        'residentCode is required',
      );
    }

    if (!displayName) {
      throw new BadRequestException(
        'displayName is required',
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        dateOfBirth,
      )
    ) {
      throw new BadRequestException(
        'dateOfBirth must be YYYY-MM-DD',
      );
    }

    const allowedGender: ResidentGender[] = [
      'MALE',
      'FEMALE',
      'OTHER',
      'UNSPECIFIED',
    ];

    if (
      !allowedGender.includes(
        gender as ResidentGender,
      )
    ) {
      throw new BadRequestException(
        'Invalid gender',
      );
    }

    const allowedCareLevel:
      ResidentCareLevel[] = [
        'INDEPENDENT',
        'ASSISTED',
        'HIGH_ASSISTANCE',
        'DEPENDENT',
      ];

    if (
      !allowedCareLevel.includes(
        careLevel as ResidentCareLevel,
      )
    ) {
      throw new BadRequestException(
        'Invalid careLevel',
      );
    }

    const input: CreateResidentInput = {
      residentCode,
      displayName,
      dateOfBirth,
      gender: gender as ResidentGender,
      room:
        body.room == null
          ? null
          : String(body.room).trim() || null,
      bed:
        body.bed == null
          ? null
          : String(body.bed).trim() || null,
      careLevel:
        careLevel as ResidentCareLevel,
    };

    const resident =
      await this.repository.createWithAudit(
        input,
        performedBy,
        'SUPERVISOR',
      );

    return {
      resident,
      source:
        'V7.4.3_DEVELOPMENT_CONTEXT',
      clinicalRecord:
        false,
    };
  }

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


  async listPage(
    limit: number,
    offset: number,
  ) {
    const page =
      await this.repository.listPage(
        limit,
        offset,
      );

    return {
      ...page,
      items:
        page.items.map(
          (resident) => ({
            resident,
            source:
              'V7.4.3_DEVELOPMENT_CONTEXT',
            clinicalRecord:
              false,
          }),
        ),
    };
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
