import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Headers,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

import { WarningReviewService } from './warning-review.service';

@Controller('api/warning-reviews')
export class WarningReviewController {

  constructor(
    private readonly service:
      WarningReviewService,
  ) {}


  @Post()
  async review(
    @Body() body: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {

    const normalizedActorId =
      String(actorId ?? '').trim();

    const normalizedActorRole =
      String(actorRole ?? '').trim();

    if (
      !normalizedActorId ||
      !normalizedActorRole
    ) {
      throw new UnauthorizedException(
        'Actor identity is required.',
      );
    }

    const bodyReviewerId =
      String(
        body?.reviewerId ?? '',
      ).trim();

    const bodyReviewerRole =
      String(
        body?.reviewerRole ?? '',
      ).trim();

    if (
      bodyReviewerId !== normalizedActorId ||
      bodyReviewerRole !== normalizedActorRole
    ) {
      throw new ForbiddenException(
        'Warning review actor mismatch.',
      );
    }


    try {

      return await this.service
        .review(body);

    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : 'Warning review failed.';

      if (
        message.includes(
          'Resident context not found',
        )
      ) {
        throw new HttpException(
          message,
          HttpStatus.NOT_FOUND,
        );
      }

      if (
        message.includes('required') ||
        message.includes('Invalid') ||
        message.includes(
          'already been reviewed',
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


  @Get(':warningId')
  async get(
    @Param('warningId')
    warningId: string,
  ) {

    const result =
      await this.service
        .get(warningId);

    if (!result) {
      throw new HttpException(
        'Warning review not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return result;
  }
}
