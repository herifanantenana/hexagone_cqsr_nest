import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Interceptor global qui log chaque requête HTTP avec son temps de réponse
// Format : [requestId] --> GET /path puis [requestId] <-- GET /path 200 12ms
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    // x-request-id injecté par RequestIdMiddleware en amont
    const requestId = (request.headers['x-request-id'] as string) || 'no-id';

    const now = Date.now();
    this.logger.log(`[${requestId}] --> ${method} ${url}`);

    // tap() observe le stream sans le modifier (log en side effect)
    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const delay = Date.now() - now;
          this.logger.log(
            `[${requestId}] <-- ${method} ${url} ${String(response.statusCode)} ${String(delay)}ms`,
          );
        },
        error: (err: Error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `[${requestId}] <-- ${method} ${url} ERROR ${String(delay)}ms`,
            err.message,
          );
        },
      }),
    );
  }
}
