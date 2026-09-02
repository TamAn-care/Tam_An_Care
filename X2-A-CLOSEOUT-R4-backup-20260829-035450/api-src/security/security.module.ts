import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import {
  ProductionAuthMiddleware,
} from './production-auth.middleware';

@Module({})
export class SecurityModule
  implements NestModule
{
  configure(
    consumer: MiddlewareConsumer,
  ): void {
    consumer
      .apply(ProductionAuthMiddleware)
      .forRoutes('*');
  }
}
