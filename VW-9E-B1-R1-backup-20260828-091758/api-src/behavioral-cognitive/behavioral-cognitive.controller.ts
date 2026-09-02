import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BehavioralCognitiveService } from './behavioral-cognitive.service';

@Controller('api/behavioral-cognitive')
export class BehavioralCognitiveController {
  constructor(private readonly service: BehavioralCognitiveService) {}

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
