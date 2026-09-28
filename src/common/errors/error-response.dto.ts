import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode } from './error-codes.js';

export class ErrorDetailDto {
  @ApiProperty({ enum: Object.values(ErrorCode), enumName: 'ErrorCode', example: 'SLOT_UNAVAILABLE' })
  code: ErrorCode;

  @ApiProperty({ example: 'This slot already has an active booking.', minLength: 1 })
  message: string;
}

// {"error":{"code":"...","message":"..."}} - the body of every non-2xx response.
export class ErrorResponseDto {
  @ApiProperty({ type: ErrorDetailDto })
  error: ErrorDetailDto;
}
