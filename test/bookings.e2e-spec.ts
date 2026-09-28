import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase, SLOT_A, SLOT_B, SLOT_C, startTestApp } from './helpers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Appointment booking API (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;

  const api = () => request(baseUrl);
  const book = (slotId: string, customerName = 'Alex Morgan', customerEmail = 'alex@example.com') =>
    api().post('/bookings').send({ slotId, customerName, customerEmail });
  const availableIds = async () =>
    ((await api().get('/slots').expect(200)).body.slots as { id: string }[]).map((s) => s.id);
  const activeBookings = (slotId: string) =>
    prisma.booking.count({ where: { slotId, status: 'active' } });

  beforeAll(async () => {
    ({ app, baseUrl, prisma } = await startTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------- required test 1
  it('books a slot (201) and removes it from availability', async () => {
    expect(await availableIds()).toEqual([SLOT_A, SLOT_B, SLOT_C]); // startsAt, then id

    const res = await book(SLOT_A, '  Alex Morgan  ', '  alex@example.com ').expect(201);

    expect(res.body).toEqual({
      booking: {
        id: expect.stringMatching(UUID),
        slotId: SLOT_A,
        customerName: 'Alex Morgan', // trimmed
        customerEmail: 'alex@example.com', // trimmed
        status: 'active',
      },
    });
    expect(await availableIds()).toEqual([SLOT_B, SLOT_C]);
    expect(await activeBookings(SLOT_A)).toBe(1);
  });

  // ---------------------------------------------------------------- required test 2
  describe('two overlapping requests for one slot', () => {
    const ROUNDS = 5; // repeat the race to make a lucky pass unlikely

    it.each([
      ['identical customer details', ['Alex Morgan', 'alex@example.com'], ['Alex Morgan', 'alex@example.com']],
      ['different customer details', ['Alex Morgan', 'alex@example.com'], ['Sam Lee', 'sam@example.com']],
    ])('with %s: exactly one 201, one 409, one active booking', async (_, first, second) => {
      for (let round = 0; round < ROUNDS; round++) {
        await resetDatabase(prisma);

        // Both requests are in flight at the same time (no await between them).
        const responses = await Promise.all([
          book(SLOT_A, first[0], first[1]),
          book(SLOT_A, second[0], second[1]),
        ]);

        expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
        const winner = responses.find((r) => r.status === 201)!;
        const loser = responses.find((r) => r.status === 409)!;
        expect(loser.body).toEqual({
          error: { code: 'SLOT_UNAVAILABLE', message: expect.any(String) },
        });

        const rows = await prisma.booking.findMany({ where: { slotId: SLOT_A } });
        expect(rows).toHaveLength(1); // the losing insert left nothing behind
        expect(rows[0]).toMatchObject({ id: winner.body.booking.id, status: 'active' });
      }
    });
  });

  // ---------------------------------------------------------------- required test 3
  it('cancels (200), restores availability and allows a new booking', async () => {
    const first = (await book(SLOT_A).expect(201)).body.booking;

    const cancelled = await api().delete(`/bookings/${first.id}`).expect(200);
    expect(cancelled.body).toEqual({ booking: { ...first, status: 'cancelled' } });
    expect(await availableIds()).toContain(SLOT_A);

    const second = (await book(SLOT_A, 'Sam Lee', 'sam@example.com').expect(201)).body.booking;
    expect(second.id).not.toBe(first.id);
    expect(await availableIds()).not.toContain(SLOT_A);

    // Repeated cancel of the OLD booking: same 200 body, and the new booking is untouched.
    const repeat = await api().delete(`/bookings/${first.id}`).expect(200);
    expect(repeat.body).toEqual(cancelled.body);
    expect(await activeBookings(SLOT_A)).toBe(1);
    expect((await prisma.booking.findUnique({ where: { id: second.id } }))?.status).toBe('active');
  });

  // ---------------------------------------------------------------- error contract
  it('returns the specified error codes', async () => {
    const expectError = (res: request.Response, status: number, code: string) => {
      expect(res.status).toBe(status);
      expect(res.body).toEqual({ error: { code, message: expect.stringMatching(/\S/) } });
    };

    expectError(await book('not-a-uuid'), 400, 'VALIDATION_ERROR');
    expectError(await book(SLOT_A, '   '), 400, 'VALIDATION_ERROR');
    expectError(await book(SLOT_A, 'Alex', 'not-an-email'), 400, 'VALIDATION_ERROR');
    expectError(await api().post('/bookings').send({}), 400, 'VALIDATION_ERROR');
    expectError(
      await api().post('/bookings').set('Content-Type', 'application/json').send('{"slotId":'),
      400,
      'VALIDATION_ERROR',
    );
    expectError(await book('99999999-9999-4999-8999-999999999999'), 404, 'SLOT_NOT_FOUND');
    expectError(await api().delete('/bookings/not-a-uuid'), 400, 'VALIDATION_ERROR');
    expectError(
      await api().delete('/bookings/99999999-9999-4999-8999-999999999999'),
      404,
      'BOOKING_NOT_FOUND',
    );
  });

  // ---------------------------------------------------------------- Socket.IO
  it('broadcasts slot.booked / slot.released only for real changes', async () => {
    const socket: Socket = io(baseUrl, { transports: ['websocket'] });
    const events: { event: string; payload: unknown }[] = [];
    socket.onAny((event, payload) => events.push({ event, payload }));
    await new Promise<void>((resolve) => socket.on('connect', resolve));

    try {
      const booking = (await book(SLOT_A).expect(201)).body.booking;
      await book(SLOT_A).expect(409); // rejected -> no event
      await api().delete(`/bookings/${booking.id}`).expect(200);
      await api().delete(`/bookings/${booking.id}`).expect(200); // repeat -> no event
      await new Promise((r) => setTimeout(r, 300)); // let any stray events arrive

      expect(events).toEqual([
        { event: 'slot.booked', payload: { slotId: SLOT_A, bookingId: booking.id, available: false } },
        { event: 'slot.released', payload: { slotId: SLOT_A, bookingId: booking.id, available: true } },
      ]);
    } finally {
      socket.disconnect();
    }
  });
});
