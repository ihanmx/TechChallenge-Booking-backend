import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes.js';

// A domain error with a spec error code. Services throw this; the global filter formats it.
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message, status);
  }
}
