import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SafeguardingService } from './safeguarding.service';

@Controller('api/safeguarding')
export class SafeguardingController {
  constructor(private readonly service: SafeguardingService) {}

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
