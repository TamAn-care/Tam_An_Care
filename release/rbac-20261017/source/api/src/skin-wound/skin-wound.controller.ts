import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { SkinWoundService } from './skin-wound.service';

@Controller('api/skin-wound')
export class SkinWoundController {
  constructor(
    private readonly service: SkinWoundService,
  ) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Post(':residentId/execute')
  execute(
    @Param('residentId') residentId: string,
    @Body() body: any,
  ) {
    return this.service.execute(
      residentId,
      body,
    );
  }
}
