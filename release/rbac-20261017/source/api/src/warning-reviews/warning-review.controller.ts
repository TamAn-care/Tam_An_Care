import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
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
  ) {

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
