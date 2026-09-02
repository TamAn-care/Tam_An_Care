import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { CareActionBridgeService } from './care-action-bridge.service';

@Controller('api/care-action-bridge')
export class CareActionBridgeController {

  constructor(
    private readonly service:
      CareActionBridgeService,
  ) {}


  @Post(':warningId/execute')
  async execute(
    @Param('warningId')
    warningId: string,

    @Body()
    body: any,
  ) {

    try {

      return await this.service.execute({
        warningId,

        actorId:
          body?.actorId,

        actorRole:
          body?.actorRole,
      });

    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : 'Care Action bridge failed.';

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
        message.includes('not approved') ||
        message.includes('already exists') ||
        message.includes(
          'must remain unassigned',
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
