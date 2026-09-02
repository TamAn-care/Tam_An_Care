import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DatabaseService,
} from '../database/database.service';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
  ) {}

  @Get()
  get() {
    return {
      status: 'ok',
      version: '7.3.3',
      component: 'health-trend-ai',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  live() {
    return {
      status: 'ok',
      check: 'liveness',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    try {
      const database =
        await this.db.healthCheck();

      if (!database) {
        throw new Error(
          'Database readiness failed',
        );
      }

      return {
        status: 'ready',
        database: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
