import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import {
  CareActionService,
} from './care-action.service';

import {
  AssignCareActionInput,
  ReopenCareActionInput,
  ResolveCareActionInput,
  StartCareActionReviewInput,
  TransferCareActionInput,
} from './care-action.types';


@Controller('api/care-actions')
export class CareActionController {

  constructor(
    private readonly service:
      CareActionService,
  ) {}


  private handleError(
    error: unknown,
  ): never {

    if (error instanceof HttpException) {
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

      throw new HttpException(
        {
          statusCode:
            HttpStatus.NOT_FOUND,

          error:
            'Not Found',

          message,
        },
        HttpStatus.NOT_FOUND,
      );

    }


    if (
      message.includes(
        'required',
      ) ||
      message.includes(
        'Invalid Care Action transition'
      ) ||
      message.includes(
        'Priority must be'
      ) ||
      message.includes(
        'already assigned'
      ) ||
      message.includes(
        'Use assign() first'
      ) ||
      message.includes(
        'reopened before transfer'
      )
    ) {

      throw new HttpException(
        {
          statusCode:
            HttpStatus.BAD_REQUEST,

          error:
            'Bad Request',

          message,
        },
        HttpStatus.BAD_REQUEST,
      );

    }


    throw new HttpException(
      {
        statusCode:
          HttpStatus.INTERNAL_SERVER_ERROR,

        error:
          'Internal Server Error',

        message:
          'Unable to process Care Action request.',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

  }


  @Get(
    ':residentId/:patternId',
  )
  async getDetails(
    @Param('residentId')
    residentId: string,

    @Param('patternId')
    patternId: string,
  ) {

    try {

      const result =
        await this.service.getDetails(
          residentId,
          patternId,
        );


      if (!result) {

        throw new HttpException(
          {
            statusCode:
              HttpStatus.NOT_FOUND,

            error:
              'Not Found',

            message:
              'Care Action not found.',
          },
          HttpStatus.NOT_FOUND,
        );

      }


      return {
        status:
          'OK',

        data:
          result,
      };


    } catch (error) {

      return this.handleError(
        error,
      );

    }

  }


  @Post(
    ':residentId/:patternId/assign',
  )
  async assign(
    @Param('residentId')
    residentId: string,

    @Param('patternId')
    patternId: string,

    @Body()
    body: AssignCareActionInput,
  ) {

    try {

      const action =
        await this.service.assign(
          residentId,
          patternId,
          body,
        );


      return {
        status:
          'OK',

        data:
          action,
      };


    } catch (error) {

      return this.handleError(
        error,
      );

    }

  }


  @Post(
    ':residentId/:patternId/transfer',
  )
  async transfer(
    @Param('residentId')
    residentId: string,

    @Param('patternId')
    patternId: string,

    @Body()
    body: TransferCareActionInput,
  ) {

    try {

      const action =
        await this.service.transfer(
          residentId,
          patternId,
          body,
        );


      return {
        status:
          'OK',

        data:
          action,
      };


    } catch (error) {

      return this.handleError(
        error,
      );

    }

  }


  @Post(
    ':residentId/:patternId/start-review',
  )
  async startReview(
    @Param('residentId')
    residentId: string,

    @Param('patternId')
    patternId: string,

    @Body()
    body:
      StartCareActionReviewInput,
  ) {

    try {

      const action =
        await this.service.startReview(
          residentId,
          patternId,
          body,
        );


      return {
        status:
          'OK',

        data:
          action,
      };


    } catch (error) {

      if (
        error instanceof Error &&
        (
          error.message ===
            'Care Action must have an assigned human owner before review can start.' ||
          error.message ===
            'Care Action must be assigned before review starts.' ||
          error.message ===
            'AI or SYSTEM actor cannot start Care Action review.' ||
          error.message ===
            'Actor is not authorized to start review for this Care Action.' ||
          error.message ===
            'Only a PENDING Care Action can start review.'
        )
      ) {

        throw new HttpException(
          {
            statusCode: 400,
            error: 'Bad Request',
            message: error.message,
          },
          400,
        );

      }

      return this.handleError(
        error,
      );

    }

  }


  @Post(
    ':residentId/:patternId/resolve',
  )
  async resolve(
    @Param('residentId')
    residentId: string,

    @Param('patternId')
    patternId: string,

    @Body()
    body: ResolveCareActionInput,
  ) {

    try {

      const action =
        await this.service.resolve(
          residentId,
          patternId,
          body,
        );


      return {
        status:
          'OK',

        data:
          action,
      };


    } catch (error) {

      return this.handleError(
        error,
      );

    }

  }


  @Post(
    ':residentId/:patternId/reopen',
  )
  async reopen(
    @Param('residentId')
    residentId: string,

    @Param('patternId')
    patternId: string,

    @Body()
    body: ReopenCareActionInput,
  ) {

    try {

      const action =
        await this.service.reopen(
          residentId,
          patternId,
          body,
        );


      return {
        status:
          'OK',

        data:
          action,
      };


    } catch (error) {

      return this.handleError(
        error,
      );

    }

  }

}
