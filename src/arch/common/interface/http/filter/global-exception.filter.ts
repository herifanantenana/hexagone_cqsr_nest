import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      // Map domain errors to HTTP status codes
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

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
