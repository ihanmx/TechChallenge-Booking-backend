import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Fixed test slots (B and C start at the same time to exercise the "then id" ordering).
export const SLOT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
export const SLOT_B = 'aaaaaaaa-0000-4000-8000-000000000002';
export const SLOT_C = 'aaaaaaaa-0000-4000-8000-000000000003';

const TEST_SLOTS = [
  { id: SLOT_A, startsAt: new Date('2030-01-15T09:00:00.000Z'), endsAt: new Date('2030-01-15T09:30:00.000Z') },
  { id: SLOT_C, startsAt: new Date('2030-01-15T10:00:00.000Z'), endsAt: new Date('2030-01-15T10:30:00.000Z') },
  { id: SLOT_B, startsAt: new Date('2030-01-15T10:00:00.000Z'), endsAt: new Date('2030-01-15T10:30:00.000Z') },
];

/** Boots the real AppModule (same pipes/filters/gateway as production) on a random port. */
export async function startTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger: false });
  await app.listen(0); // real HTTP + Socket.IO server, random free port
  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    prisma: app.get(PrismaService),
  };
}

/** Makes every test independent and repeatable: empty tables, then the fixed test slots. */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE bookings, slots');
  await prisma.slot.createMany({ data: TEST_SLOTS });
}
