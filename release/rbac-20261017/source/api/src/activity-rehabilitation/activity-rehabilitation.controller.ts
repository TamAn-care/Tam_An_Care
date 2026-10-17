import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import {
  ActivityRehabilitationService,
} from './activity-rehabilitation.service';

import {
  RehabCommand,
} from './activity-rehabilitation.types';

@Controller('api/activity-rehabilitation')
export class ActivityRehabilitationController {
  constructor(
    private readonly service: ActivityRehabilitationService,
  ) {}

  @Get('test/summary')
  async summary() {
    return this.service.summary();
  }

  @Post(':residentId/execute')
  async execute(
    @Param('residentId') residentId: string,
    @Body() command: RehabCommand,
  ) {
    try {
      const data = await this.service.execute(
        residentId,
        command,
      );

      return {
        status: 'OK',
        data,
        autonomousClinicalAction: false,
      };
    } catch (error: any) {
      const message =
        error?.message ??
        'Unable to process Activity / Rehabilitation request.';

      const businessMarkers = [
        'required',
        'Only ',
        'cannot ',
        'may not ',
        'authorized',
        'Human ',
        'human ',
        'Unsupported ',
        'Terminal ',
        'Session ',
        'Activity ',
        'Rehabilitation ',
        'Participation ',
        'Functional ',
        'AI or SYSTEM',
      ];

      if (
        error instanceof BadRequestException ||
        businessMarkers.some((m) => message.includes(m))
      ) {
        throw new BadRequestException(message);
      }

      throw error;
    }
  }
}
