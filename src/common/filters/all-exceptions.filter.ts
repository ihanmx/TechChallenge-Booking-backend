import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiException } from '../errors/api.exception.js';
import { ErrorBody, ErrorCode } from '../errors/error-codes.js';

/**
 * Turns EVERY error into {"error":{"code","message"}}.
 * Unknown errors become 500 INTERNAL_ERROR with a generic message: the real error
 * (stack trace, Prisma/DB details) is only logged on the server, never sent to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { status, body } = this.toResponse(exception);
    const { httpAdapter } = this.adapterHost;
    httpAdapter.reply(host.switchToHttp().getResponse(), body, status);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorBody } {
    // Our own domain errors (SLOT_NOT_FOUND, SLOT_UNAVAILABLE, ...).
    if (exception instanceof ApiException) {
      return error(exception.getStatus(), exception.code, exception.message);
    }

    // Framework client errors: ParseUUIDPipe -> 400, unknown route -> 404,
    // malformed JSON -> 400 (Nest's Express adapter wraps the parser's SyntaxError
    // in a BadRequestException).
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const status = exception.getStatus();
      const code =
        status === HttpStatus.NOT_FOUND
          ? ErrorCode.NOT_FOUND
          : ErrorCode.VALIDATION_ERROR;
      return error(status, code, messageOf(exception));
    }

    // Anything else is unexpected: log it fully, answer generically.
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    return error(
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred.',
    );
  }
}

function error(status: number, code: ErrorCode, message: string) {
  return { status, body: { error: { code, message } } };
}

// HttpException responses can be a string or {message: string | string[]}.
function messageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' && message ? message : exception.message;
}
