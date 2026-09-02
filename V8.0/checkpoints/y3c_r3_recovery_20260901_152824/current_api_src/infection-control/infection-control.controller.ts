import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InfectionControlService } from './infection-control.service';

@Controller('api/infection-control')
export class InfectionControlController {
  constructor(private readonly service: InfectionControlService) {}

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
