// Module global qui fournit Winston + AppLogger à toute l'application
// @Global : pas besoin d'importer LoggerModule dans chaque module

import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { AppLogger } from './logger.service';
import { createWinstonLogger } from './winston.instance';

// Instance Winston partagée entre le module NestJS et le bootstrap (main.ts)
export const winstonInstance = createWinstonLogger();

@Global()
@Module({
  imports: [
    // nest-winston intègre Winston dans le système DI de NestJS
    // WINSTON_MODULE_PROVIDER devient injectable via @Inject(WINSTON_MODULE_PROVIDER)
    WinstonModule.forRoot({ instance: winstonInstance }),
  ],
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
