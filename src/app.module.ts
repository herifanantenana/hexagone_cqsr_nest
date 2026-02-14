// Module racine : assemble tous les modules, guards globaux et middleware
// L'ordre des APP_GUARD compte : RateLimit s'exécute avant Permissions

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { REDIS_CLIENT, RedisModule } from './arch/common/infra/redis';
import {
  THROTTLER_AUTH,
  THROTTLER_GLOBAL,
  THROTTLER_UPLOAD,
} from './arch/common/interface/http/constants';
import {
  PermissionsGuard,
  RateLimitGuard,
} from './arch/common/interface/http/guards';
import { RequestIdMiddleware } from './arch/common/interface/http/middleware/request-id.middleware';
import { AuthModule } from './arch/modules/auth/auth.module';
import { PostsModule } from './arch/modules/posts/posts.module';
import { UserModule } from './arch/modules/user/user.module';

@Module({
  imports: [
    // isGlobal → ConfigService injectable partout sans ré-importer ConfigModule
    // Charge .env par défaut (copier .env.example → .env avant de démarrer)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.example',
    }),

    // Redis utilisé comme storage partagé pour les compteurs de rate limiting
    RedisModule,

    // Rate limiting : 3 throttlers nommés, compteurs partagés via Redis
    // global = toutes les routes, auth/upload = opt-in via décorateurs
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (configService: ConfigService, redisClient: Redis) => ({
        throttlers: [
          {
            name: THROTTLER_GLOBAL, // 120 req/min par défaut
            ttl: configService.get<number>('THROTTLE_GLOBAL_TTL_MS', 60_000),
            limit: configService.get<number>('THROTTLE_GLOBAL_LIMIT', 120),
          },
          {
            name: THROTTLER_AUTH, // 5 req/min (login, signup, refresh)
            ttl: configService.get<number>('THROTTLE_AUTH_TTL_MS', 60_000),
            limit: configService.get<number>('THROTTLE_AUTH_LIMIT', 5),
          },
          {
            name: THROTTLER_UPLOAD, // 10 req/min (avatar upload)
            ttl: configService.get<number>('THROTTLE_UPLOAD_TTL_MS', 60_000),
            limit: configService.get<number>('THROTTLE_UPLOAD_LIMIT', 10),
          },
        ],
        // Compteurs Redis partagés entre toutes les instances du serveur
        storage: new ThrottlerStorageRedisService(redisClient),
      }),
    }),

    AuthModule, // signup, login, refresh, logout, change-password
    UserModule, // profil, avatar
    PostsModule, // CRUD posts avec visibilité
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globaux (exécutés dans l'ordre de déclaration sur chaque requête)
    // 1) RateLimitGuard : throttle global + opt-in auth/upload
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    // 2) PermissionsGuard : vérifie @Can(resource, action) si présent sur le handler
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  // RequestIdMiddleware → exécuté AVANT les guards et interceptors
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
