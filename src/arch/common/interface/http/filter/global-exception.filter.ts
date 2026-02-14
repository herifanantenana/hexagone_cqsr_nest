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
// Traduit les erreurs domaine en codes HTTP appropriés (hexagonal : le domaine ne connaît pas HTTP)
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Valeurs par défaut : 500 si l'exception n'est pas reconnue
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      // Exceptions NestJS classiques (ValidationPipe, guards, etc.)
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        const body = exceptionResponse as { message?: string; error?: string };
        message = body.message || message;
        error = body.error || error;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      // Mapping erreurs domaine → HTTP status (par nom de classe)
      const errorName = exception.constructor.name;

      switch (errorName) {
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
        case 'UserNotFoundError':
        case 'SessionNotFoundError':
          status = HttpStatus.NOT_FOUND;
          message = exception.message;
          error = 'NotFound';
          break;
        case 'ForbiddenError':
        case 'UserDisabledError':
          status = HttpStatus.FORBIDDEN;
          message = exception.message;
          error = 'Forbidden';
          break;
        case 'InvalidEmailError':
        case 'InvalidPasswordError':
        case 'InvalidFileTypeError':
        case 'FileTooLargeError':
          status = HttpStatus.BAD_REQUEST;
          message = exception.message;
          error = 'BadRequest';
          break;
        default:
          message = exception.message;
      }
    }

    // Log avec stack trace pour le debug
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Réponse JSON standardisée pour le client
    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
