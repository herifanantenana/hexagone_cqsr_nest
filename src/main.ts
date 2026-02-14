import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './arch/common/interface/http/filter/global-exception.filter';
import { LoggingInterceptor } from './arch/common/interface/http/interceptor/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust proxy : indispensable quand l'app tourne derrière un reverse proxy
  // (Nginx, Cloudflare, AWS ALB…). Sans ça, req.ip retourne l'IP du proxy.
  // Le "1" signifie "faire confiance au premier proxy dans la chaîne".
  // Voir aussi : RateLimitGuard.resolveIp() qui utilise x-forwarded-for.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Serve static files (for uploaded avatars)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
