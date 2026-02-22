// Bootstrap : configure le pipeline HTTP global
// Ordre d'execution par requete : Middleware → Guards → Interceptor(before) → Pipe → Handler → Interceptor(after) → Filter(si erreur)

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppLogger } from './arch/common/infra/logger';

async function bootstrap() {
  // bufferLogs: true → NestJS stocke les logs de bootstrap en memoire
  // app.flushLogs()  → les rejoue tous via Winston une fois le DI pret
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.flushLogs();

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.enableCors();
  app.enableShutdownHooks();

  // Swagger (OpenAPI) sur /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hexagonal CQRS API')
    .setDescription(
      'API REST + WebSocket NestJS avec architecture hexagonale, CQRS, JWT auth, posts et chat temps reel.\n\n' +
        '**Format des erreurs :** `{ statusCode, error, message, requestId, timestamp, path }`\n\n' +
        '**WebSocket :** connect to `/chat` namespace with `{ auth: { token: "<JWT>" } }`',
    )
    .setVersion('1.0.0')
    .addServer(
      `http://localhost:${process.env.PORT || 3000}`,
      'Local development',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'BearerAuth',
    )
    .addTag('Health', 'Health check endpoint')
    .addTag('Auth', 'Authentication : signup, login, token refresh, logout')
    .addTag('Users', 'User profile management')
    .addTag('Posts', 'CRUD posts with visibility (public/private)')
    .addTag('Chat', 'Conversations and messages (HTTP + WebSocket)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  logger.log(
    `Swagger docs available at: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}
void bootstrap();
