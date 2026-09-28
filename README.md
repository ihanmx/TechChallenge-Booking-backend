# Appointment Booking API

NestJS + PostgreSQL (Prisma) + Socket.IO + OpenAPI.
Book fixed appointment slots; each slot can have **at most one active booking**, even under concurrent requests.

---

## 1. Prerequisites

- **Node.js 22+** (tested with 24) and npm
- **PostgreSQL 14+**, either:
  - **Docker** (easiest): `docker-compose.yml` is included, or
  - your own PostgreSQL with two empty databases (e.g. `booking` and `booking_test`)

## 2. Install and configure

```bash
cd api
npm install                 # also generates the Prisma client
cp .env.example .env        # (Windows cmd: copy .env.example .env), then fill in the placeholders
```

`.env` variables:

| Variable | Used for | Docker value |
|---|---|---|
| `DATABASE_URL` | the app, migrations, seed | `postgresql://booking:booking@localhost:5434/booking?schema=public` |
| `TEST_DATABASE_URL` | automated tests only (**wiped by the tests**) | `postgresql://booking:booking@localhost:5434/booking_test?schema=public` |
| `PORT` | HTTP + Socket.IO port | `3000` |

## 3. Database, seed, start

```bash
npm run db:up               # start PostgreSQL in Docker (port 5434, creates both databases)
npm run db:migrate:deploy   # create tables + constraints
npm run db:seed             # insert 8 fixed slots (safe to re-run)
npm run start:dev           # start the API in watch mode
```

Shortcut for the first three: `npm run setup`.
Production-style run: `npm run build && npm run start:prod`.

| URL | What |
|---|---|
| `http://localhost:3000/slots` | API |
| `http://localhost:3000/docs` | Swagger UI |
| `http://localhost:3000/openapi.json` | OpenAPI specification |
| `ws://localhost:3000/socket.io` | Socket.IO (namespace `/`) |

Other DB commands: `db:reset` (drop, migrate and seed the dev DB), `db:studio` (browse data), `db:down` (stop Docker).

---

## 4. Workflows

### Backend developer

```bash
npm run setup && npm run start:dev    # run
npm test                              # tests against the real test DB
npm run lint
```

To change the schema: edit `prisma/schema.prisma`, then run `npm run db:migrate -- --name <change>`.

### Tester (manual, no frontend)

1. Start the app (section 3), then open **http://localhost:3000/docs**.
2. In a second terminal, watch the real-time events: `npm run socket:listen`.
3. In Swagger UI, use **Try it out** and follow this flow:

| Step | Request | Expected |
|---|---|---|
| 1 | `GET /slots` | 200, 8 slots. Copy an `id` |
| 2 | `POST /bookings` with that `slotId` | 201, `status: "active"`. The listener prints `slot.booked` |
| 3 | `POST /bookings` again, same slot | 409 `SLOT_UNAVAILABLE`, no event |
| 4 | `GET /slots` | the booked slot is gone |
| 5 | `DELETE /bookings/{id}` | 200, `status: "cancelled"`. The listener prints `slot.released` |
| 6 | `DELETE /bookings/{id}` again | 200, same body, no event |
| 7 | `POST /bookings` with the same slot | 201 again: the slot was released |
| 8 | bad UUID / empty name / bad email / unknown IDs | 400 `VALIDATION_ERROR`, 404 `SLOT_NOT_FOUND` / `BOOKING_NOT_FOUND` |

The same flow with curl:

```bash
curl localhost:3000/slots
curl -X POST localhost:3000/bookings -H "Content-Type: application/json" \
  -d '{"slotId":"11111111-1111-4111-8111-111111111101","customerName":"Alex Morgan","customerEmail":"alex@example.com"}'
curl -X DELETE localhost:3000/bookings/<bookingId>
```

**Automated tests:** `npm test`. See section 6.

### Frontend developer

- **Contract:** `http://localhost:3000/openapi.json` (import it into Postman, or generate a typed client).
- **Flow:** `GET /slots`, then `POST /bookings`, then `DELETE /bookings/{id}` to cancel.
- **Errors** always look like `{"error":{"code":"SLOT_UNAVAILABLE","message":"..."}}`. Switch on `code` and show `message`.
- **No authentication.** CORS is open for Socket.IO.
- **Live updates** (keep the slot list in sync without polling):

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000');   // namespace "/", path "/socket.io"
socket.on('slot.booked',   ({ slotId }) => removeSlot(slotId));  // {slotId, bookingId, available:false}
socket.on('slot.released', () => refetchSlots());                // {slotId, bookingId, available:true}
```

Events are sent once, **after** the database change is committed. There are no events for rejected requests or repeated cancellations, and events never contain customer data. Delivery is best-effort, with no replay.

---

## 5. How double booking is prevented

**The database enforces it, not the application code.** The migration adds a **partial unique index**:

```sql
CREATE UNIQUE INDEX bookings_one_active_per_slot ON bookings(slot_id) WHERE status = 'active';
```

- `POST /bookings` does **not** "check, then insert", because two requests could both pass the check. It **just inserts**.
- When two inserts race for one slot, PostgreSQL makes the second **wait** for the first to commit, then rejects it with a unique violation. The API maps that to **409 `SLOT_UNAVAILABLE`**.
- **Cancelled bookings are outside the index**, so an old cancellation never blocks a new booking and the slot can be rebooked.
- An unknown `slotId` fails the foreign key and returns **404 `SLOT_NOT_FOUND`**. No extra query, so no race.
- **Cancel** is `UPDATE … WHERE id = ? AND status = 'active'`. Only one caller can change the row, so `slot.released` is sent once even with concurrent cancels. Repeated cancels return 200 with no change.

This holds across multiple API instances, because the guarantee lives in PostgreSQL.

---

## 6. Tests

- **Command:** `npm test`, about 4 s, 6 tests in `test/bookings.e2e-spec.ts`.
- **Database:** the real app runs on a random port against the **real PostgreSQL** in `TEST_DATABASE_URL`.
  - Before the run, migrations are applied automatically (`test/global-setup.ts`).
  - Before **each** test, the tables are truncated and 3 fixed test slots are inserted, so runs are repeatable.
  - The config **refuses to start** if `TEST_DATABASE_URL` is missing or equal to `DATABASE_URL`.

| Test | Checks |
|---|---|
| Booking | 201, trimmed fields, the slot disappears from `GET /slots`, 1 active row in the DB |
| Race: identical details | 2 simultaneous requests (`Promise.all`) give exactly one 201 and one 409, with **1 row** in the DB. Repeated 5 times |
| Race: different details | same |
| Cancel | 200, the slot is available again, rebooking gives 201, and re-cancelling the old booking doesn't touch the new one |
| Errors | every 400/404 code, including malformed JSON |
| Socket.IO | exactly `slot.booked` + `slot.released`, and nothing for the 409 or the repeated cancel |

The race test was validated by temporarily dropping the unique index: it then fails with `[201, 201]`.

---

## 7. Key decisions

- **Project structure:** one Nest module per feature (`slots`, `bookings`, `realtime`, `prisma`), plus `common/` for errors, the filter, the validation pipe and Swagger helpers.
- **Data model:** `slots` and `bookings`. Bookings are **never deleted**: cancelling sets `status = cancelled` and `cancelled_at`, so cancelled bookings stay addressable.
  - A check constraint enforces `ends_at > starts_at`.
  - Start times are **not unique**, because several providers could offer the same time.
- **Errors:** one global exception filter produces `{"error":{code,message}}` for everything. Unknown errors become 500 `INTERNAL_ERROR`; stack traces are logged on the server only.
  - Unknown routes return 404 `NOT_FOUND`.
- **Validation:** DTOs with class-validator. `customerName` and `customerEmail` are trimmed **before** validation and storage.
- **The pipe and filter are registered in `AppModule`,** so the tests run with exactly the production behaviour.
- **Events are emitted after the committed statement,** from the service, and only when the state actually changed.
- **Seed** uses fixed slot IDs with upsert, so it's safe to re-run.
- **Stack:** Prisma 7 with the `pg` driver adapter; the client is generated into `src/generated/`, which isn't committed.

## 8. Future improvements

- A Redis adapter for Socket.IO when running several API instances.
- Rate limiting, request logging with correlation IDs, and health checks.
- Pagination and filters for `GET /slots` (date range, provider).
- Providers/doctors on slots, with `@@unique([providerId, startsAt])`.
- An idempotency key on `POST /bookings`, so client retries don't produce a 409.

## 9. Time spent and unfinished parts

- **Actual time:** _⚠ fill in_
- **Unfinished parts:** none known. All required endpoints, events, docs and tests are implemented.

## 10. AI disclosure

**Tool used:** Claude Code (Anthropic), for scaffolding, implementation and documentation drafts.

**How the output was reviewed and tested:**
- I reviewed each step and asked for explanations of every file.
- I changed design decisions where needed (e.g. rejected a unique-start-time constraint, because several doctors can share a time).
- Every feature was checked against the running API and the real database: status codes, error bodies, trimming, idempotent cancel, and parallel-request races with 2 and 30 concurrent requests.
- The OpenAPI output was checked with an independent linter (Redocly).
- The race test was validated by removing the unique index and confirming the test fails.
- The automated tests (`npm test`) run against real PostgreSQL.
