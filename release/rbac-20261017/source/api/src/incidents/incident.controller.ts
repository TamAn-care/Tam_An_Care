import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';

import {
  IncidentService,
} from './incident.service';

import {
  IncidentMutationInput,
  ReportIncidentInput,
} from './incident.types';


@Controller('api/incidents')
export class IncidentController {

  constructor(
    private readonly service:
      IncidentService,
  ) {}


  @Post('report')
  async report(
    @Body()
    input: ReportIncidentInput,
  ): Promise<any> {

    try {

      return {
        status: 'OK',
        data:
          await this.service
            .report(
              input,
            ),
      };

    } catch (error) {

      this.handleError(
        error,
      );
    }
  }


  @Post(':incidentId/:action')
  async mutate(
    @Param('incidentId')
    incidentId: string,

    @Param('action')
    action: string,

    @Body()
    input: IncidentMutationInput,
  ): Promise<any> {

    try {

      return {
        status: 'OK',
        data:
          await this.service
            .mutate(
              incidentId,
              action,
              input,
            ),
      };

    } catch (error) {

      this.handleError(
        error,
      );
    }
  }


  private handleError(
    error: unknown,
  ): never {

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown Incident error.';

    const businessMarkers = [
      'required',
      'not found',
      'Only a ',
      'Only an ',
      'not authorized',
      'assigned human owner',
      'assigned human reviewer',
      'cannot mutate',
      'must be a human',
      'must be an authorized human',
      'must be human',
      'requires a ',
      'required before',
      'Unsupported Incident action',
    ];

    if (
      businessMarkers.some(
        marker =>
          message.includes(
            marker,
          ),
      )
    ) {
      throw new BadRequestException(
        message,
      );
    }

    throw error;
  }
}
