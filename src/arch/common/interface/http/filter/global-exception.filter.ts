import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// @Catch() sans argument → attrape TOUTES les exceptions (HTTP + domain + inattendues)
// Traduit les erreurs domaine en codes HTTP appropriés
// Hexagonal : le domaine ne connaît pas HTTP, c'est ce filtre qui fait le mapping
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

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
      // Pour ajouter un nouveau module : ajouter ses erreurs dans le switch ci-dessous
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
          // Erreur domaine non mappée → 500 avec le message (à investiguer et ajouter au switch)
          message = exception.message;
      }
    }

    // Log avec requestId pour corrélation
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} - ${status} - ${String(message)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

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
