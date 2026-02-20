// Interceptor HTTP global : log chaque requête entrante et sortante via Winston
// Incoming : method, path, ip, userAgent, requestId, userId
// Outgoing : statusCode, durationMs, requestId
// Niveau adapté au status : 2xx/3xx → info, 4xx → warn, 5xx → error

import { AppLogger } from '@common/infra/logger';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger: AppLogger;

  constructor(appLogger: AppLogger) {
    this.logger = appLogger.withContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const requestId = (request.headers['x-request-id'] as string) || 'no-id';
    const userAgent = request.headers['user-agent'] || 'unknown';
    // userId est injecté par Passport après l'auth guard (peut être undefined)
    const userId = (request as Request & { user?: { userId?: string } }).user
      ?.userId;

    const now = Date.now();

    // Log incoming (toujours niveau "http")
    this.logger.http(`--> ${method} ${url}`, {
      requestId,
      ip,
      userAgent,
      ...(userId && { userId }),
    });

    // tap() observe la réponse sans la modifier
    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const durationMs = Date.now() - now;
          const statusCode = response.statusCode;

          this.logOutgoing(method, url, statusCode, durationMs, requestId);
        },
        error: () => {
          // Les erreurs sont loggées par GlobalExceptionFilter avec plus de détails
          // On log uniquement la durée ici pour compléter le cycle requête/réponse
          const durationMs = Date.now() - now;
          this.logger.http(`<-- ${method} ${url} ERROR ${durationMs}ms`, {
            requestId,
          });
        },
      }),
    );
  }

  // Niveau de log adapté au code HTTP de la réponse
  private logOutgoing(
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
    requestId: string,
  ): void {
    const message = `<-- ${method} ${url} ${statusCode} ${durationMs}ms`;
    const meta = { requestId, statusCode, durationMs };

    if (statusCode >= 500) {
      this.logger.error(message, meta);
    } else if (statusCode >= 400) {
      this.logger.warn(message, meta);
    } else {
      this.logger.http(message, meta);
    }
  }
}
