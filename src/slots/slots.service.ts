import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlotDto } from './dto/slot.dto.js';

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  // Available = no ACTIVE booking. Cancelled bookings don't block a slot.
  findAvailable(): Promise<SlotDto[]> {
    return this.prisma.slot.findMany({
      where: { bookings: { none: { status: 'active' } } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: { id: true, startsAt: true, endsAt: true },
    });
  }
}
