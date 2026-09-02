import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';

import {
  CARE_PLAN_GOVERNANCE_ACTIONS,
  CarePlanGovernanceAction,
} from '../care-plan-authorization/care-plan-authorization.types';

import {
  CarePlanGovernanceService,
} from './care-plan-governance.service';


interface GovernanceBody {
  actorId?: string;
  actorRole?: string;
}


@Controller(
  'api/care-plan-governance',
)
export class CarePlanGovernanceController {

  constructor(
    private readonly service:
      CarePlanGovernanceService,
  ) {}


  @Post(
    ':carePlanId/:action',
  )
  async execute(
    @Param('carePlanId')
    carePlanId: string,

    @Param('action')
    rawAction: string,

    @Body()
    body: GovernanceBody,
  ) {

    const action =
      String(
        rawAction ?? '',
      )
        .trim()
        .toUpperCase();


    if (
      !CARE_PLAN_GOVERNANCE_ACTIONS
        .includes(
          action as
            CarePlanGovernanceAction,
        )
    ) {
      throw new BadRequestException(
        'Unsupported Care Plan governance action.',
      );
    }


    try {
      const data =
        await this.service
          .execute(
            carePlanId,
            action as
              CarePlanGovernanceAction,
            String(
              body?.actorId ?? '',
            ),
            String(
              body?.actorRole ?? '',
            ),
          );

      return {
        status:
          'OK',

        data,
      };
    } catch (error) {

      if (
        error instanceof
        HttpException
      ) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);


      if (
        message.includes(
          'not found',
        )
      ) {
        throw new NotFoundException(
          message,
        );
      }


      const businessErrors = [
        'required',
        'cannot govern',
        'not authorized',
        'Only a DRAFT',
        'Only an ACTIVE',
        'Only a SUSPENDED',
        'Only a DRAFT, ACTIVE, or SUSPENDED',
        'Unsupported Care Plan governance action',
      ];


      if (
        businessErrors.some(
          term =>
            message.includes(
              term,
            ),
        )
      ) {
        throw new BadRequestException(
          message,
        );
      }


      throw new HttpException(
        {
          statusCode:
            HttpStatus.INTERNAL_SERVER_ERROR,

          error:
            'Internal Server Error',

          message:
            'Unable to process Care Plan governance request.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
