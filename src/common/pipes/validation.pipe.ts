import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiException } from '../errors/api.exception.js';
import { ErrorCode } from '../errors/error-codes.js';

// Global DTO validation. Any failure -> 400 VALIDATION_ERROR with readable messages.
export const appValidationPipe = new ValidationPipe({
  transform: true, // run class-transformer (@Transform trims strings before validation)
  whitelist: true, // drop properties that are not in the DTO
  exceptionFactory: (errors) =>
    new ApiException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      flatten(errors).join('; ') || 'Invalid request.',
    ),
});

function flatten(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...flatten(e.children ?? []),
  ]);
}
