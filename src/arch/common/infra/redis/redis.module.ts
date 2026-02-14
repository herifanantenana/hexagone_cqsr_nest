import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT, RedisClientProvider } from './redis.client';

// @Global : rend REDIS_CLIENT injectable partout sans importer RedisModule à chaque fois
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisClientProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Ferme proprement la connexion Redis à l'arrêt de l'app
  async onModuleDestroy() {
    await this.redis.quit();
  }
}
