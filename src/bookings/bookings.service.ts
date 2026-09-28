import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { ApiException } from '../common/errors/api.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingDto } from './dto/booking.dto.js';

// Exactly the fields the API returns (no createdAt / cancelledAt).
const bookingSelect = {
  id: true,
  slotId: true,
  customerName: true,
  customerEmail: true,
  status: true,
} satisfies Prisma.BookingSelect;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Conflict prevention: we do NOT "check then insert" (two requests could both pass the check).
   * We just INSERT and let PostgreSQL decide:
   *  - partial unique index `bookings_one_active_per_slot` (slot_id WHERE status = 'active'):
   *    of two concurrent inserts for one slot, the second waits for the first to commit and then
   *    fails with a unique violation (P2002) -> 409 SLOT_UNAVAILABLE.
   *  - foreign key to slots: an unknown slotId fails with P2003 -> 404 SLOT_NOT_FOUND.
   * One atomic statement, no race window, and it also holds across multiple API instances.
   */
  async create(dto: CreateBookingDto): Promise<BookingDto> {
    const booking = await this.insertBooking(dto);
    // The INSERT is a single auto-committed statement: once it resolves, it is committed.
    this.realtime.slotBooked(booking.slotId, booking.id);
    return booking;
  }

  /**
   * Idempotent cancel. The UPDATE only matches an ACTIVE booking, so exactly one caller
   * (even under concurrent cancels) performs the active -> cancelled change and emits
   * slot.released. Repeated cancels return the cancelled booking with no change and no event.
   */
  async cancel(id: string): Promise<BookingDto> {
    const [cancelled] = await this.prisma.booking.updateManyAndReturn({
      where: { id, status: 'active' },
      data: { status: 'cancelled', cancelledAt: new Date() },
      select: bookingSelect,
    });
    if (cancelled) {
      this.realtime.slotReleased(cancelled.slotId, cancelled.id);
      return cancelled;
    }

    // Nothing updated: either already cancelled (repeat -> 200, no change) or unknown ID.
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      select: bookingSelect,
    });
    if (!existing) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        ErrorCode.BOOKING_NOT_FOUND,
        'Booking not found.',
      );
    }
    return existing;
  }

  private async insertBooking(dto: CreateBookingDto): Promise<BookingDto> {
    try {
      return await this.prisma.booking.create({
        data: {
          slotId: dto.slotId,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
        },
        select: bookingSelect,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            ErrorCode.SLOT_UNAVAILABLE,
            'This slot already has an active booking.',
          );
        }
        if (e.code === 'P2003') {
          throw new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.SLOT_NOT_FOUND,
            'Slot not found.',
          );
        }
      }
      throw e; // unexpected -> 500 INTERNAL_ERROR via the global filter
    }
  }
}
