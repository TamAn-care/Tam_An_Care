import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import {
  CareTaskExecutionService,
} from './care-task-execution.service';

import {
  CareTaskExecutionInput,
} from './care-task-execution.types';


@Controller(
  'api/care-task-execution',
)
export class CareTaskExecutionController {

  constructor(
    private readonly service:
      CareTaskExecutionService,
  ) {}


  @Post(
    ':careTaskId/:action',
  )
  async execute(
    @Param('careTaskId')
    careTaskId:
      string,

    @Param('action')
    action:
      string,

    @Body()
    input:
      CareTaskExecutionInput,
  ) {

    try {

      const data =
        await this.service
          .execute(
            careTaskId,
            action,
            input,
          );

      return {
        status:
          'OK',

        data,
      };

    } catch (
      error:
        unknown
    ) {

      if (
        error instanceof
        HttpException
      ) {
        throw error;
      }

      const message =
        error instanceof
          Error
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


      const businessTerms = [
        'required',
        'Only a ',
        'not authorized',
        'cannot mutate',
        'human owner',
        'already been accepted',
        'must be accepted',
        'Unsupported Care Task action',
      ];


      if (
        businessTerms.some(
          term =>
            message.includes(
              term,
            ),
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
            'Unable to process Care Task request.',
        },

        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
