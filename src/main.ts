// Bootstrap : configure le pipeline HTTP global
// Ordre d'exécution par requête : Middleware → Guards → Interceptor(before) → Pipe → Handler → Interceptor(after) → Filter(si erreur)

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './arch/common/interface/http/filter/global-exception.filter';
import { LoggingInterceptor } from './arch/common/interface/http/interceptor/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust proxy : indispensable derrière un reverse proxy (Nginx, Cloudflare…)
  // Active req.ip avec la vraie IP client (x-forwarded-for)
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Global validation pipe : valide les DTOs via class-validator
  // whitelist : supprime les propriétés non décorées du body
  // forbidNonWhitelisted : rejette la requête si des propriétés inconnues sont envoyées
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // Active class-transformer (ex: @Type(() => Number) sur les query params)
    }),
  );

  // Global exception filter : attrape toutes les exceptions (domaine + HTTP + inattendues)
  // Traduit les erreurs domaine en codes HTTP via le nom de la classe d'erreur
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptor : log "[requestId] --> GET /path" et "<-- GET /path 200 12ms"
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Serve static files (avatars uploadés dans ./uploads)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.enableCors(); // Autorise toutes les origines (à restreindre en production)

  // ─── Swagger (OpenAPI) ─────────────────────────────────────────────────
  // Documentation interactive accessible sur /api/docs
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
  SwaggerModule.setup('api/docs', app, document); // UI Swagger sur /api/docs

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}
void bootstrap();
