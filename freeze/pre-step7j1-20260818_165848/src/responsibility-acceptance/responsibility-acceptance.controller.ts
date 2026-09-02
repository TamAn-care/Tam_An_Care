import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import {
  ResponsibilityAcceptanceService,
} from './responsibility-acceptance.service';

@Controller('api/care-actions')
export class ResponsibilityAcceptanceController {

  constructor(
    private readonly service:
      ResponsibilityAcceptanceService,
  ) {}


  @Post(
    ':residentId/:patternId/accept-responsibility',
  )
  async accept(
    @Param('residentId')
    residentId: string,

    @Param('patternId')
    patternId: string,

    @Body()
    body: any,
  ) {

    try {

      return await this.service.accept({
        residentId,
        patternId,

        actorId:
          body?.actorId,

        actorRole:
          body?.actorRole,

        priority:
          body?.priority,

        dueAt:
          body?.dueAt ?? null,
      });

    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : 'Responsibility acceptance failed.';

      if (
        message.includes(
          'not found',
        )
      ) {
        throw new HttpException(
          message,
          HttpStatus.NOT_FOUND,
        );
      }

      if (
        message.includes('required') ||
        message.includes('invalid') ||
        message.includes(
          'Only a PENDING'
        ) ||
        message.includes(
          'already been accepted'
        ) ||
        message.includes(
          'already assigned'
        ) ||
        message.includes(
          'identity mismatch'
        )
      ) {
        throw new HttpException(
          message,
          HttpStatus.BAD_REQUEST,
        );
      }

      throw error;
    }
  }
}
