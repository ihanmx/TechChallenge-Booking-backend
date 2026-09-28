import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorCode } from '../errors/error-codes.js';
import { ErrorResponseDto } from '../errors/error-response.dto.js';

type ErrorExample = { summary: string; code: ErrorCode; message: string };

/**
 * Documents an error status with the shared ErrorResponseDto schema and named examples:
 *   @ApiErrorResponse(404, 'Slot does not exist', { notFound: { summary, code, message } })
 */
export function ApiErrorResponse(
  status: number,
  description: string,
  examples: Record<string, ErrorExample>,
) {
  return applyDecorators(
    ApiResponse({
      status,
      description,
      type: ErrorResponseDto,
      examples: Object.fromEntries(
        Object.entries(examples).map(([name, { summary, code, message }]) => [
          name,
          { summary, value: { error: { code, message } } },
        ]),
      ),
    }),
  );
}

export const ApiInternalError = () =>
  ApiErrorResponse(500, 'Unexpected failure. No stack traces or database details are exposed.', {
    internal: {
      summary: 'Unexpected failure',
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
    },
  });
