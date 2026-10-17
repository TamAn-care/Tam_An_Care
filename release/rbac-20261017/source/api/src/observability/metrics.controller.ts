import {
  Controller,
  Get,
} from '@nestjs/common';

import {
  processMetrics,
} from './metrics.registry';

@Controller('api/metrics')
export class MetricsController {
  @Get()
  getMetrics() {
    return processMetrics.snapshot();
  }
}
