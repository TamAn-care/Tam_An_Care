import { Injectable } from '@nestjs/common';
import { AppConfig, loadAppConfig } from './env';

@Injectable()
export class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    this.config = loadAppConfig();
  }

  get isProduction(): boolean {
    return this.config.isProduction;
  }

  get nodeEnv(): string {
    return this.config.nodeEnv;
  }

  get port(): number {
    return this.config.port;
  }

  get database() {
    return this.config.database;
  }

  get jwtSecret(): string {
    return this.config.jwt.secret;
  }

  get corsOrigins(): string[] {
    return this.config.cors.allowedOrigins;
  }

  get rateLimitPerMinute(): number {
    return this.config.rateLimit.perMinute;
  }

  get swaggerEnabled(): boolean {
    return this.config.swagger.enabled;
  }

  get raw(): AppConfig {
    return this.config;
  }
}
