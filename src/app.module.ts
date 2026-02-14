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
import { RateLimitGuard } from './arch/common/interface/http/guards';
import { RequestIdMiddleware } from './arch/common/interface/http/middleware/request-id.middleware';
import { AuthModule } from './arch/modules/auth/auth.module';
import { UserModule } from './arch/modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.example',
    }),

    RedisModule, // Client ioredis partagé (@Global)

    // Rate limiting : 3 throttlers nommés avec storage Redis
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (configService: ConfigService, redisClient: Redis) => ({
        // Chaque throttler a un compteur indépendant dans Redis
        // Clé Redis : {prefix}-{throttlerName}-{tracker}
        throttlers: [
          {
            name: THROTTLER_GLOBAL, // Appliqué partout
            ttl: configService.get<number>('THROTTLE_GLOBAL_TTL_MS', 60_000),
            limit: configService.get<number>('THROTTLE_GLOBAL_LIMIT', 120),
          },
          {
            name: THROTTLER_AUTH, // Opt-in via @AuthThrottle()
            ttl: configService.get<number>('THROTTLE_AUTH_TTL_MS', 60_000),
            limit: configService.get<number>('THROTTLE_AUTH_LIMIT', 5),
          },
          {
            name: THROTTLER_UPLOAD, // Opt-in via @UploadThrottle()
            ttl: configService.get<number>('THROTTLE_UPLOAD_TTL_MS', 60_000),
            limit: configService.get<number>('THROTTLE_UPLOAD_LIMIT', 10),
          },
        ],
        // Storage Redis = compteurs partagés entre instances (multi-instance safe)
        storage: new ThrottlerStorageRedisService(redisClient),
      }),
    }),

    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // Guard global sur toutes les routes (notre custom, pas ThrottlerGuard brut)
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
