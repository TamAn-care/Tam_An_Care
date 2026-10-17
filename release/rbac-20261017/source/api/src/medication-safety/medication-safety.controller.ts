import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MedicationSafetyService } from './medication-safety.service';

@Controller('api/medication-safety')
export class MedicationSafetyController {
  constructor(private readonly service: MedicationSafetyService) {}

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
