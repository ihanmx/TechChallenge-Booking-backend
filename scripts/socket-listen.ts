/**
 * Frontend-free Socket.IO check: connects to the API and prints slot events.
 *
 *   npm run socket:listen                        # http://localhost:3000
 *   npm run socket:listen -- http://host:port    # custom URL
 *
 * Then book / cancel in another terminal (curl or Swagger UI at /docs) and watch the output.
 */
import { io } from 'socket.io-client';

const url = process.argv[2] ?? `http://localhost:${process.env.PORT ?? 3000}`;
const socket = io(url); // default namespace "/", path "/socket.io"

socket.on('connect', () => console.log(`connected to ${url} (id ${socket.id})`));
socket.on('connect_error', (err) => console.error(`connect_error: ${err.message}`));
socket.on('disconnect', (reason) => console.log(`disconnected: ${reason}`));

for (const event of ['slot.booked', 'slot.released']) {
  socket.on(event, (payload: unknown) =>
    console.log(`${new Date().toISOString()}  ${event}  ${JSON.stringify(payload)}`),
  );
}
