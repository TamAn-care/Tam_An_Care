import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

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


  async createResident(input: any) {
    const residentCode =
      String(input?.residentCode ?? '')
        .trim();

    const displayName =
      String(input?.displayName ?? '')
        .trim();

    const dateOfBirth =
      String(input?.dateOfBirth ?? '')
        .trim();

    const gender =
      String(input?.gender ?? '')
        .trim()
        .toUpperCase();

    const careLevel =
      String(input?.careLevel ?? '')
        .trim()
        .toUpperCase();

    if (
      !residentCode ||
      !displayName ||
      !dateOfBirth ||
      !gender ||
      !careLevel
    ) {
      throw new BadRequestException(
        'residentCode, displayName, dateOfBirth, gender and careLevel are required.',
      );
    }

    if (
      ![
        'MALE',
        'FEMALE',
        'OTHER',
        'UNSPECIFIED',
      ].includes(gender)
    ) {
      throw new BadRequestException(
        'Invalid gender.',
      );
    }

    if (
      ![
        'INDEPENDENT',
        'ASSISTED',
        'HIGH_ASSISTANCE',
        'DEPENDENT',
      ].includes(careLevel)
    ) {
      throw new BadRequestException(
        'Invalid careLevel.',
      );
    }

    const residentId =
      'res-'
      + Date.now().toString(36)
      + '-'
      + Math.random()
        .toString(36)
        .slice(2, 10);

    try {
      return await this.repository
        .createResident({
          residentId,
          residentCode,
          displayName,
          dateOfBirth,
          gender: gender as any,
          room:
            input?.room === undefined
              ? null
              : input.room,
          bed:
            input?.bed === undefined
              ? null
              : input.bed,
          careLevel:
            careLevel as any,
        });
    } catch (error: any) {
      if (
        String(error?.code ?? '')
        === '23505'
      ) {
        throw new ConflictException(
          'Resident code already exists.',
        );
      }

      throw error;
    }
  }

  async updateResident(
    residentId: string,
    input: any,
  ) {
    const patch: any = {};

    if (
      input?.displayName
      !== undefined
    ) {
      const value =
        String(
          input.displayName
        ).trim();

      if (!value) {
        throw new BadRequestException(
          'displayName cannot be empty.',
        );
      }

      patch.displayName = value;
    }

    if (
      input?.dateOfBirth
      !== undefined
    ) {
      const value =
        String(
          input.dateOfBirth
        ).trim();

      if (!value) {
        throw new BadRequestException(
          'dateOfBirth cannot be empty.',
        );
      }

      patch.dateOfBirth = value;
    }

    if (
      input?.gender
      !== undefined
    ) {
      const value =
        String(
          input.gender
        )
          .trim()
          .toUpperCase();

      if (
        ![
          'MALE',
          'FEMALE',
          'OTHER',
          'UNSPECIFIED',
        ].includes(value)
      ) {
        throw new BadRequestException(
          'Invalid gender.',
        );
      }

      patch.gender = value;
    }

    if (
      input?.careLevel
      !== undefined
    ) {
      const value =
        String(
          input.careLevel
        )
          .trim()
          .toUpperCase();

      if (
        ![
          'INDEPENDENT',
          'ASSISTED',
          'HIGH_ASSISTANCE',
          'DEPENDENT',
        ].includes(value)
      ) {
        throw new BadRequestException(
          'Invalid careLevel.',
        );
      }

      patch.careLevel = value;
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          input ?? {},
          'room',
        )
    ) {
      patch.room =
        input.room === null
          ? null
          : String(input.room);
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          input ?? {},
          'bed',
        )
    ) {
      patch.bed =
        input.bed === null
          ? null
          : String(input.bed);
    }

    const updated =
      await this.repository
        .updateResident(
          residentId,
          patch,
        );

    if (!updated) {
      throw new NotFoundException(
        'Resident not found.',
      );
    }

    return updated;
  }

  async deactivateResident(
    residentId: string,
  ) {
    const updated =
      await this.repository
        .deactivateResident(
          residentId,
        );

    if (!updated) {
      throw new NotFoundException(
        'Resident not found.',
      );
    }

    return updated;
  }

}
