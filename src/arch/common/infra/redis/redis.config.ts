import { ConfigService } from '@nestjs/config';

// Retourne l'URL Redis depuis les variables d'env (supporte redis:// et rediss:// TLS)
export const getRedisUrl = (configService: ConfigService): string => {
  return configService.get<string>('REDIS_URL', 'redis://localhost:6379');
};
