import {
  Body,
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiException } from '../common/errors/api.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import {
  ApiErrorResponse,
  ApiInternalError,
} from '../common/swagger/api-error-response.decorator.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingResponseDto } from './dto/booking.dto.js';

const bookingIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new ApiException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      'bookingId must be a UUID',
    ),
});

const exampleBooking = {
  id: '22222222-2222-4222-8222-222222222222',
  slotId: '11111111-1111-4111-8111-111111111101',
  customerName: 'Alex Morgan',
  customerEmail: 'alex@example.com',
};

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post() // 201 by default
  @ApiOperation({
    summary: 'Book a slot',
    description:
      'Creates an **active** booking for an available slot. `customerName` and `customerEmail` are ' +
      'trimmed before validation and storage (e.g. `"  Alex Morgan  "` is stored as `"Alex Morgan"`).\n\n' +
      '**Concurrency:** a slot can have at most one active booking, enforced by a PostgreSQL partial ' +
      'unique index. Of two simultaneous requests for the same available slot, exactly one gets `201` ' +
      'and the other `409 SLOT_UNAVAILABLE` (whether customer details match or differ).\n\n' +
      'On success the server broadcasts the Socket.IO event `slot.booked` (see README).',
  })
  @ApiBody({
    type: CreateBookingDto,
    required: true,
    examples: {
      valid: {
        summary: 'Valid request',
        value: {
          slotId: '11111111-1111-4111-8111-111111111101',
          customerName: 'Alex Morgan',
          customerEmail: 'alex@example.com',
        },
      },
    },
  })
  @ApiCreatedResponse({
    type: BookingResponseDto,
    description: 'Booking created with status `active`.',
    example: { booking: { ...exampleBooking, status: 'active' } },
  })
  @ApiErrorResponse(400, 'Invalid or missing fields, or malformed JSON.', {
    invalidSlotId: {
      summary: 'slotId is not a UUID',
      code: ErrorCode.VALIDATION_ERROR,
      message: 'slotId must be a UUID',
    },
    emptyName: {
      summary: 'customerName empty after trimming',
      code: ErrorCode.VALIDATION_ERROR,
      message: 'customerName must not be empty',
    },
    invalidEmail: {
      summary: 'customerEmail has invalid syntax',
      code: ErrorCode.VALIDATION_ERROR,
      message: 'customerEmail must be a valid email address',
    },
    malformedJson: {
      summary: 'Body is not valid JSON',
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Unexpected end of JSON input',
    },
  })
  @ApiErrorResponse(404, 'slotId is a valid UUID but no such slot exists.', {
    slotNotFound: {
      summary: 'Slot does not exist',
      code: ErrorCode.SLOT_NOT_FOUND,
      message: 'Slot not found.',
    },
  })
  @ApiErrorResponse(409, 'The slot already has an active booking.', {
    slotUnavailable: {
      summary: 'Slot already booked',
      code: ErrorCode.SLOT_UNAVAILABLE,
      message: 'This slot already has an active booking.',
    },
  })
  @ApiInternalError()
  async create(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    return { booking: await this.bookingsService.create(dto) };
  }

  @Delete(':bookingId') // 200 by default
  @ApiOperation({
    summary: 'Cancel a booking',
    description:
      'Cancels an **active** booking and releases its slot (it appears in `GET /slots` again). ' +
      'No request body.\n\n' +
      '**Idempotent:** cancelling an already-cancelled booking returns `200` with the same cancelled ' +
      'booking, without any state change or event. Cancelled bookings remain addressable, and an old ' +
      'cancelled booking never affects a newer active booking for the same slot.\n\n' +
      'On an actual cancellation the server broadcasts the Socket.IO event `slot.released` (see README).',
  })
  @ApiParam({
    name: 'bookingId',
    format: 'uuid',
    description: 'ID of the booking to cancel.',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @ApiOkResponse({
    type: BookingResponseDto,
    description: 'Booking is cancelled (first or repeated cancellation).',
    examples: {
      cancelled: {
        summary: 'Cancelled (first or repeated call - same response)',
        value: { booking: { ...exampleBooking, status: 'cancelled' } },
      },
    },
  })
  @ApiErrorResponse(400, 'bookingId is not a valid UUID.', {
    invalidId: {
      summary: 'Invalid UUID',
      code: ErrorCode.VALIDATION_ERROR,
      message: 'bookingId must be a UUID',
    },
  })
  @ApiErrorResponse(404, 'bookingId is a valid UUID but no such booking exists.', {
    bookingNotFound: {
      summary: 'Booking does not exist',
      code: ErrorCode.BOOKING_NOT_FOUND,
      message: 'Booking not found.',
    },
  })
  @ApiInternalError()
  async cancel(
    @Param('bookingId', bookingIdPipe) bookingId: string,
  ): Promise<BookingResponseDto> {
    return { booking: await this.bookingsService.cancel(bookingId) };
  }
}
