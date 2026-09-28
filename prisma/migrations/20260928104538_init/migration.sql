-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('active', 'cancelled');

-- CreateTable
CREATE TABLE "slots" (
    "id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slots_starts_at_id_idx" ON "slots"("starts_at", "id");

-- CreateIndex
CREATE INDEX "bookings_slot_id_idx" ON "bookings"("slot_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Data integrity: a slot must end after it starts.
ALTER TABLE "slots" ADD CONSTRAINT "slots_ends_after_starts_chk" CHECK ("ends_at" > "starts_at");

-- Conflict prevention: at most ONE active booking per slot, enforced by PostgreSQL.
-- Partial index => cancelled bookings are ignored, so a slot can be re-booked after cancellation.
-- Under concurrent inserts, the second transaction blocks on the index entry and then fails
-- with a unique violation (Prisma P2002), which the API maps to 409 SLOT_UNAVAILABLE.
CREATE UNIQUE INDEX "bookings_one_active_per_slot" ON "bookings"("slot_id") WHERE "status" = 'active';