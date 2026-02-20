// @Catch() sans argument → attrape TOUTES les exceptions (HTTP + domain + inattendues)
// Traduit les erreurs domaine en codes HTTP appropriés
// Hexagonal : le domaine ne connaît pas HTTP, c'est ce filtre qui fait le mapping
// Les erreurs 5xx incluent la stack trace dans les logs (pas dans la réponse)

import { AppLogger } from '@common/infra/logger';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: AppLogger;

  constructor(appLogger: AppLogger) {
    this.logger = appLogger.withContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // requestId injecté par RequestIdMiddleware en amont
    const requestId = (request.headers['x-request-id'] as string) || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      // Exceptions NestJS classiques (ValidationPipe, guards, ThrottlerException, etc.)
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        const body = exceptionResponse as {
          message?: string | string[];
          error?: string;
        };
        message = body.message || message;
        error = body.error || error;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      // Mapping erreurs domaine → HTTP status (par nom de classe)
      // Chaque module domaine définit ses propres erreurs ; on les traduit ici
      const errorName = exception.constructor.name;

      switch (errorName) {
        // ── JWT token errors (jsonwebtoken library) ──
        case 'TokenExpiredError':
          status = HttpStatus.UNAUTHORIZED;
          message = 'Access token has expired';
          error = 'TokenExpired';
          break;
        case 'JsonWebTokenError':
        case 'NotBeforeError':
          status = HttpStatus.UNAUTHORIZED;
          message = 'Invalid or malformed token';
          error = 'InvalidToken';
          break;

        // ── Auth domain errors ──
        case 'InvalidCredentialsError':
        case 'InvalidTokenError':
          status = HttpStatus.UNAUTHORIZED;
          message = exception.message;
          error = 'Unauthorized';
          break;
        case 'EmailAlreadyUsedError':
        case 'UserAlreadyExistsError':
          status = HttpStatus.CONFLICT;
          message = exception.message;
          error = 'Conflict';
          break;

        // ── User + Posts domain errors ──
        case 'UserNotFoundError':
        case 'SessionNotFoundError':
        case 'PostNotFoundError':
          status = HttpStatus.NOT_FOUND;
          message = exception.message;
          error = 'NotFound';
          break;
        case 'UserDisabledError':
        case 'ForbiddenPostAccessError':
        case 'SessionRevokedError':
          status = HttpStatus.FORBIDDEN;
          message = exception.message;
          error = 'Forbidden';
          break;
        case 'InvalidEmailError':
        case 'InvalidPasswordError':
        case 'InvalidDisplayNameError':
        case 'InvalidBioError':
        case 'InvalidFileTypeError':
        case 'FileSizeLimitExceededError':
        case 'InvalidPostDataError':
        case 'EmptyMessageError':
        case 'MessageTooLongError':
          status = HttpStatus.BAD_REQUEST;
          message = exception.message;
          error = 'BadRequest';
          break;

        // ── Chat domain errors ──
        case 'ConversationNotFoundError':
          status = HttpStatus.NOT_FOUND;
          message = exception.message;
          error = 'NotFound';
          break;
        case 'NotConversationMemberError':
        case 'CannotAddMemberError':
          status = HttpStatus.FORBIDDEN;
          message = exception.message;
          error = 'Forbidden';
          break;
        case 'AlreadyConversationMemberError':
          status = HttpStatus.CONFLICT;
          message = exception.message;
          error = 'Conflict';
          break;

        default:
          // Erreur domaine non mappée → 500 (à investiguer et ajouter au switch)
          message = exception.message;
      }
    }

    // Log avec niveau adapté au status code
    const logMeta = {
      requestId,
      statusCode: status,
      method: request.method,
      path: request.url,
      ...(exception instanceof Error && (status as number) >= 500
        ? { stack: exception.stack }
        : {}),
    };

    if ((status as number) >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${String(message)}`,
        logMeta,
      );
    } else if ((status as number) >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${String(message)}`,
        logMeta,
      );
    }

    // Format de réponse standardisé (identique pour toutes les erreurs)
    response.status(status).json({
      statusCode: status,
      error,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
