import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PainComfortService } from './pain-comfort.service';

@Controller('api/pain-comfort')
export class PainComfortController {
  constructor(private readonly service: PainComfortService) {}

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
