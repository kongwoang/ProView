import 'reflect-metadata';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import type { NextFunction, Request, Response } from 'express';
import { loadEnvironment } from './infrastructure/environment';
import { HttpExceptionFilter } from './infrastructure/http-exception.filter';

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  // Load modules after .env to ensure JWT and other provider factories see validated values.
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ json: true }),
    bodyParser: true,
  });
  app.setGlobalPrefix('api/v1');
  if (environment.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  const logger = new Logger('HTTP');
  app.use((request: Request, response: Response, next: NextFunction) => {
    const supplied = request.header('x-request-id');
    const requestId = supplied && /^[A-Za-z0-9_-]{8,80}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader('x-request-id', requestId);
    response.setHeader('Cache-Control', 'no-store');
    const started = performance.now();
    response.on('finish', () =>
      logger.log({
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      }),
    );
    next();
  });
  app.enableCors({
    origin: environment.FRONTEND_URL,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('ProView API').setVersion('1.0').addBearerAuth().build(),
  );
  if (process.env.OPENAPI_OUTPUT)
    await writeFile(process.env.OPENAPI_OUTPUT, JSON.stringify(document, null, 2));
  if (environment.ENABLE_API_DOCS) SwaggerModule.setup('api/docs', app, document);
  await app.listen(environment.PORT, '0.0.0.0');
}

void bootstrap().catch(() => {
  // Configuration/database errors can contain connection secrets; omit raw error objects.
  process.stderr.write('ProView startup failed. Check configuration and database availability.\n');
  process.exitCode = 1;
});
