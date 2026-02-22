// Service injectable qui encapsule Winston et expose une API compatible NestJS LoggerService
//
// Utilisation DI (controllers, services, gateways) :
//   constructor(private readonly appLogger: AppLogger) {
//     this.logger = appLogger.withContext('MonService');
//   }
//
// Utilisation hors DI (classes non injectables) :
//   private logger = AppLogger.create('MaClasse');

import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Logger as WinstonLogger } from 'winston';
import { loadLoggerConfigFromEnv } from './logger.config';
import { createWinstonLogger } from './winston.instance';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class AppLogger implements LoggerService {
  private static instance: WinstonLogger | null = null;
  private context = '';

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private winston: WinstonLogger,
  ) {}

  // Enregistre l'instance Winston singleton (appele par LoggerModule.forRoot)
  static setInstance(instance: WinstonLogger): void {
    AppLogger.instance = instance;
  }

  // Factory pour classes non injectables (hors DI NestJS)
  // Usage : private logger = AppLogger.create('MaClasse');
  static create(context?: string): AppLogger {
    if (!AppLogger.instance) {
      // Fallback : cree une instance depuis process.env (avant boot DI)
      AppLogger.instance = createWinstonLogger(loadLoggerConfigFromEnv());
    }

    const logger = Object.create(AppLogger.prototype) as AppLogger;
    logger.winston = AppLogger.instance;
    logger.context = context || '';
    return logger;
  }

  // Cree un child logger avec un contexte fixe
  withContext(context: string): AppLogger {
    const child = Object.create(AppLogger.prototype) as AppLogger;
    child.winston = this.winston;
    child.context = context;
    return child;
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.winston.info(message, this.buildMeta(optionalParams));
  }

  error(message: string, ...optionalParams: unknown[]): void {
    // NestJS convention : error(message, stack?, context?)
    const meta: Record<string, unknown> = {};
    if (this.context) meta.context = this.context;

    if (
      optionalParams.length >= 2 &&
      typeof optionalParams[0] === 'string' &&
      typeof optionalParams[1] === 'string'
    ) {
      meta.stack = optionalParams[0];
      meta.context = optionalParams[1];
    } else {
      for (const param of optionalParams) {
        if (typeof param === 'string') {
          meta.context = param;
        } else if (param instanceof Error) {
          meta.stack = param.stack;
        } else if (typeof param === 'object' && param !== null) {
          Object.assign(meta, param);
        }
      }
    }

    this.winston.error(message, meta);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.winston.warn(message, this.buildMeta(optionalParams));
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.winston.debug(message, this.buildMeta(optionalParams));
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.winston.log('verbose', message, this.buildMeta(optionalParams));
  }

  http(message: string, meta?: Record<string, unknown>): void {
    this.winston.log('http', message, {
      context: this.context || 'HTTP',
      ...meta,
    });
  }

  private buildMeta(optionalParams: unknown[]): Record<string, unknown> {
    const meta: Record<string, unknown> = {};

    if (this.context) {
      meta.context = this.context;
    }

    for (const param of optionalParams) {
      if (typeof param === 'string') {
        meta.context = param;
      } else if (param instanceof Error) {
        meta.stack = param.stack;
      } else if (typeof param === 'object' && param !== null) {
        Object.assign(meta, param);
      }
    }

    return meta;
  }
}
