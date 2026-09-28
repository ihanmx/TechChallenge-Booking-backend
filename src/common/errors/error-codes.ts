// Every error code the API can return (see README / OpenAPI).
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SLOT_NOT_FOUND: 'SLOT_NOT_FOUND',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND', // unknown route
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Shape of every error response: {"error":{"code":"...","message":"..."}}
export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}
