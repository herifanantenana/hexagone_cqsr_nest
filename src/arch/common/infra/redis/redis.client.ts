import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisUrl } from './redis.config';

// Token d'injection pour le client Redis partagé (Symbol = pas de conflit de noms)
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

// Provider factory : crée le client ioredis à l'init du module
export const RedisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): Redis => {
    const logger = new Logger('RedisClient');
    const url = getRedisUrl(configService);

    // ioredis gère rediss:// (TLS) nativement — compatible Upstash, ElastiCache, etc.
    const client = new Redis(url);

    client.on('connect', () => {
      logger.log('Redis client connected');
    });

    client.on('error', (err) => {
      logger.error('Redis client error', err.message);
    });

    return client;
  },
  inject: [ConfigService],
};
