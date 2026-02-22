// Module global : fournit Winston + AppLogger a toute l'application
// @Global : injectable partout sans re-importer LoggerModule

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { loadLoggerConfig } from './logger.config';
import { AppLogger } from './logger.service';
import { createWinstonLogger } from './winston.instance';

@Global()
@Module({
  // ─── Pourquoi ne pas utiliser WinstonModule.forRoot({ instance }) ─────────────
  // nest-winston@1.10.2 a un bug dans createWinstonProviders() :
  // il appelle toujours winston.createLogger(opts) sans vérifier opts.instance,
  // ce qui crée un nouveau logger vide (sans transports) au lieu de réutiliser
  // l'instance. Solution : fournir WINSTON_MODULE_PROVIDER directement via useValue.
  providers: [
    {
      provide: WINSTON_MODULE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = loadLoggerConfig(configService);
        const instance = createWinstonLogger(config);
        // Rend l'instance accessible pour AppLogger.create() (hors DI)
        AppLogger.setInstance(instance);
        return instance;
      },
    },
    AppLogger,
  ],
  exports: [AppLogger],
})
export class LoggerModule {}
