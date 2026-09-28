import {
  Body,
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiException } from '../common/errors/api.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
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

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post() // 201 by default
  async create(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    return { booking: await this.bookingsService.create(dto) };
  }

  @Delete(':bookingId') // 200 by default
  async cancel(
    @Param('bookingId', bookingIdPipe) bookingId: string,
  ): Promise<BookingResponseDto> {
    return { booking: await this.bookingsService.cancel(bookingId) };
  }
}
