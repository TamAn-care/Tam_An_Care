import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FallMobilityService } from './fall-mobility.service';

@Controller('api/fall-mobility')
export class FallMobilityController {
  constructor(private readonly service: FallMobilityService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Post(':residentId/execute')
  execute(
    @Param('residentId') residentId: string,
    @Body() body: any,
  ) {
    return this.service.execute(residentId, body);
  }
}
