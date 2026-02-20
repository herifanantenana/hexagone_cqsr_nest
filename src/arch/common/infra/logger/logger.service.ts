// Service injectable qui encapsule Winston et expose une API compatible NestJS LoggerService
// Utilisable dans n'importe quel service/controller via injection de dépendance
// Supporte un "context" (nom du module/classe) pour filtrer facilement les logs

import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
export class AppLogger implements LoggerService {
  private context = '';

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winston: WinstonLogger,
  ) {}

  // Crée un child logger avec un contexte fixe (ex: "Auth", "Posts", "HTTP")
  // Utile pour identifier rapidement l'origine d'un log
  withContext(context: string): AppLogger {
    const child = new AppLogger(this.winston);
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
    this.winston.error(message, this.buildMeta(optionalParams));
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.winston.warn(message, this.buildMeta(optionalParams));
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.winston.debug(message, this.buildMeta(optionalParams));
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.winston.debug(message, this.buildMeta(optionalParams));
  }

  // Log HTTP dédié (niveau custom "http") pour les requêtes entrantes/sortantes
  http(message: string, meta?: Record<string, unknown>): void {
    this.winston.log('http', message, {
      context: this.context || 'HTTP',
      ...meta,
    });
  }

  // Construit l'objet metadata à partir des paramètres optionnels
  // Compatible avec l'API NestJS : logger.log('msg', 'Context') ou logger.log('msg', { key: value })
  private buildMeta(optionalParams: unknown[]): Record<string, unknown> {
    const meta: Record<string, unknown> = {};

    if (this.context) {
      meta.context = this.context;
    }

    for (const param of optionalParams) {
      if (typeof param === 'string') {
        // NestJS convention : dernier param string = context
        meta.context = param;
      } else if (typeof param === 'object' && param !== null) {
        Object.assign(meta, param);
      }
    }

    return meta;
  }
}
