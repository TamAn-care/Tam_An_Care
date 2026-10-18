import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { enterpriseOperationsMiddleware } from './security/enterprise-operations.middleware';

async function bootstrap() {
  const app =
    await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const production = configService.isProduction;

  if (production) {
    app
      .getHttpAdapter()
      .getInstance()
      .set('trust proxy', 1);
  }

  const origins = configService.corsOrigins;

  app.enableCors(
    production
      ? {
          origin: origins,
          credentials: true,
        }
      : undefined,
  );

  app.use(
    (
      req: any,
      res: any,
      next: () => void,
    ) => {
      const supplied =
        req.headers['x-request-id'];

      const requestId =
        typeof supplied === 'string' &&
        supplied.trim()
          ? supplied.trim()
          : randomUUID();

      req.headers['x-request-id'] = requestId;

      res.setHeader(
        'x-request-id',
        requestId,
      );
      res.setHeader(
        'x-content-type-options',
        'nosniff',
      );
      res.setHeader(
        'x-frame-options',
        'DENY',
      );
      res.setHeader(
        'referrer-policy',
        'no-referrer',
      );
      res.setHeader(
        'permissions-policy',
        'camera=(), microphone=(), geolocation=()',
      );

      if (production) {
        res.setHeader(
          'strict-transport-security',
          'max-age=31536000; includeSubDomains',
        );
      }

      next();
    },
  );

  // X2_ENTERPRISE_OPERATIONS
  app.use(
    enterpriseOperationsMiddleware,
  );



  if (configService.swaggerEnabled) {
    const config =
      new DocumentBuilder()
        .setTitle('Tâm An Care API')
        .setDescription(
          'Tâm An Care operational API',
        )
        .setVersion('8.0')
        .build();

    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  await app.listen(
    configService.port,
    '0.0.0.0',
  );
}

bootstrap();
