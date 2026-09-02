import {
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';

import { EarlyWarningService } from './early-warning.service';

import { ResidentService } from '../residents/resident.service';

@Controller('api/ai/engines/health-trend')
export class EarlyWarningController {

  constructor(
    private readonly earlyWarningService:
      EarlyWarningService,

    private readonly residentService:
      ResidentService,
  ) {}


  @Post('patterns')
  patterns(
    @Body() body: any,
  ) {
    return this.earlyWarningService
      .analyze(body);
  }


  @Post('resident/:residentId/patterns')
  async residentPatterns(
    @Param('residentId')
    residentId: string,

    @Body()
    body: any,
  ) {

    const context =
      await this.residentService
        .getById(residentId);

    const analysis =
      this.earlyWarningService
        .analyze({
          ...body,

          residentId:
            context.resident.residentId,
        });

    return {
      ...analysis,

      residentId:
        context.resident.residentId,

      residentContext: {
        residentId:
          context.resident.residentId,

        residentCode:
          context.resident.residentCode,

        displayName:
          context.resident.displayName,

        room:
          context.resident.room,

        bed:
          context.resident.bed,

        careLevel:
          context.resident.careLevel,

        activeStatus:
          context.resident.activeStatus,
      },

      residentAssociation: {
        verified:
          true,

        source:
          'POSTGRES_RESIDENT_CONTEXT',
      },

      autonomousClinicalAction:
        false,
    };
  }
}
