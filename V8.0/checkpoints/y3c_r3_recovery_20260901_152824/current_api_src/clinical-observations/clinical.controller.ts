import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Param,
  Post,
} from '@nestjs/common';

import {
  ClinicalService,
} from './clinical.service';

import {
  ClinicalAction,
  ClinicalMutationInput,
} from './clinical.types';

@Controller(
  'api/clinical',
)
export class ClinicalController {

  constructor(
    private readonly service:
      ClinicalService,
  ) {}


  @Post(
    ':aggregateType/:aggregateId/:action',
  )
  async mutate(
    @Param('aggregateType')
    aggregateType: string,

    @Param('aggregateId')
    aggregateId: string,

    @Param('action')
    rawAction: string,

    @Body()
    input: ClinicalMutationInput,
  ) {

    try {

      const action =
        String(rawAction ?? '')
          .trim()
          .toUpperCase() as
          ClinicalAction;

      const allowed:
        ClinicalAction[] = [
          'VERIFY_OBSERVATION',
          'AMEND_OBSERVATION',
          'VOID_OBSERVATION',

          'SIGN_NURSING_NOTE',

          'ACKNOWLEDGE_FINDING',
          'START_FINDING_REVIEW',
          'ESCALATE_FINDING',
          'CLOSE_FINDING',

          'ASSIGN_ESCALATION',
          'ACCEPT_ESCALATION',
          'RESOLVE_ESCALATION',
          'CANCEL_ESCALATION',

          'LINK_CARE_ACTION',
        ];

      if (
        !allowed.includes(
          action,
        )
      ) {
        throw new Error(
          'Unsupported clinical action.',
        );
      }

      const data =
        await this.service.mutate(
          aggregateType,
          aggregateId,
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

      const markers = [
        'required',
        'Only a ',
        'Only an ',
        'not authorized',
        'cannot mutate',
        'assigned human',
        'not found',
        'Unsupported',
        'requires an accepted',
        'Care Action not found',
      ];

      if (
        markers.some(
          marker =>
            message.includes(marker),
        )
      ) {
        throw new BadRequestException(
          message,
        );
      }

      throw new InternalServerErrorException(
        'Unable to process clinical request.',
      );
    }
  }
}
