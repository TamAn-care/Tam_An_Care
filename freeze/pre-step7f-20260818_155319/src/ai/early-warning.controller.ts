import { Body, Controller, Post } from '@nestjs/common';
import { EarlyWarningService } from './early-warning.service';

@Controller('api/ai/engines/health-trend')
export class EarlyWarningController {
  constructor(
    private readonly earlyWarningService: EarlyWarningService,
  ) {}

  @Post('patterns')
  patterns(@Body() body: any) {
    return this.earlyWarningService.analyze(body);
  }
}
