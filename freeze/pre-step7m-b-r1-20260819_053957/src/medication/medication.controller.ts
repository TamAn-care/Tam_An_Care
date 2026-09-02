import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Param,
  Post,
} from '@nestjs/common';

import {
  MedicationService,
} from './medication.service';

import {
  MedicationAdministrationAction,
  MedicationAdministrationInput,
} from './medication.types';

@Controller(
  'api/medication-administrations',
)
export class MedicationController {

  constructor(
    private readonly service:
      MedicationService,
  ) {}


  @Post(':administrationId/:action')
  async mutate(
    @Param('administrationId')
    administrationId: string,

    @Param('action')
    rawAction: string,

    @Body()
    input: MedicationAdministrationInput,
  ) {

    try {

      const action =
        String(rawAction ?? '')
          .trim()
          .toUpperCase() as
          MedicationAdministrationAction;

      const allowed:
        MedicationAdministrationAction[] =
        [
          'ASSIGN',
          'ACCEPT',
          'READY',
          'DOUBLE_CHECK',
          'ADMINISTER',
          'MISSED',
          'REFUSED',
          'HELD',
          'CANCEL',
        ];

      if (
        !allowed.includes(action)
      ) {
        throw new Error(
          'Unsupported Medication Administration action.',
        );
      }

      const data =
        await this.service
          .mutateAdministration(
            administrationId,
            action,
            input,
          );

      return {
        status: 'OK',
        data,
      };

    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error';

      const businessMarkers = [
        'required',
        'Only a ',
        'Only an ',
        'not authorized',
        'cannot mutate',
        'requires a human',
        'different humans',
        'must be ACTIVE',
        'has not PASSED',
        'does not allow',
        'not found',
        'Unsupported',
      ];

      if (
        businessMarkers.some(
          marker =>
            message.includes(marker),
        )
      ) {
        throw new BadRequestException(
          message,
        );
      }

      throw new InternalServerErrorException(
        'Unable to process Medication Administration request.',
      );
    }
  }
}
