import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Seeds the fixed appointment slots.
 *
 * Idempotent: slot IDs are fixed UUIDs and each slot is upserted, so running the
 * seed again never creates duplicates and never touches existing bookings.
 * (Start times are intentionally NOT unique: several providers may offer the same time.)
 *
 * Uses the same PRISMA_TARGET switch as prisma.config.ts so the test DB can be seeded too.
 */
const url =
  process.env.PRISMA_TARGET === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;
if (!url) throw new Error('Database URL is not set (see .env.example)');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const SLOT_MINUTES = 30;
const FIRST_SLOT_START = Date.parse('2030-01-15T09:00:00.000Z');
const SLOT_COUNT = 8; // 09:00 - 13:00 UTC

// Deterministic UUID v4-shaped IDs: 11111111-1111-4111-8111-1111111111NN
const slotId = (n: number) =>
  `11111111-1111-4111-8111-1111111111${String(n).padStart(2, '0')}`;

const SEED_SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const startsAt = new Date(FIRST_SLOT_START + i * SLOT_MINUTES * 60_000);
  const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60_000);
  return { id: slotId(i + 1), startsAt, endsAt };
});

async function main() {
  await prisma.$transaction(
    SEED_SLOTS.map((slot) =>
      prisma.slot.upsert({
        where: { id: slot.id },
        create: slot,
        update: { startsAt: slot.startsAt, endsAt: slot.endsAt },
      }),
    ),
  );
  console.log(`Seeded ${SEED_SLOTS.length} slots.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
