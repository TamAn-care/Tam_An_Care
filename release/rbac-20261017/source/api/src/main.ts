import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { AppModule } from './app.module';
import { enterpriseOperationsMiddleware } from './security/enterprise-operations.middleware';

function allowedOrigins(): string[] {
  return (
    process.env.CORS_ALLOWED_ORIGINS ?? ''
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app =
    await NestFactory.create(AppModule);

  const production =
    process.env.NODE_ENV === 'production';

  if (production) {
    app
      .getHttpAdapter()
      .getInstance()
      .set('trust proxy', 1);
  }

  const origins = allowedOrigins();

  if (
    production &&
    origins.length === 0
  ) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS is required in production',
    );
  }

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



  if (
    !production ||
    process.env.ENABLE_SWAGGER === 'true'
  ) {
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
    process.env.PORT
      ? Number(process.env.PORT)
      : 3000,
    '0.0.0.0',
  );
}

bootstrap();
