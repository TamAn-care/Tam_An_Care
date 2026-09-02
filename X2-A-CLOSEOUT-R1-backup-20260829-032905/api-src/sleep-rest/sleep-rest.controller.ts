import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SleepRestService } from './sleep-rest.service';

@Controller('api/sleep-rest')
export class SleepRestController {
  constructor(private readonly service: SleepRestService) {}

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
