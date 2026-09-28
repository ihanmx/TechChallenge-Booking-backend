import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SlotEvent, SlotEventPayload } from './slot-events.js';

// Runs on the same HTTP server as the API: default namespace "/", path "/socket.io".
// No auth, rooms or client->server events: the server only broadcasts to everyone.
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  // Services call these only AFTER the database change has committed.
  slotBooked(slotId: string, bookingId: string) {
    this.broadcast(SlotEvent.BOOKED, { slotId, bookingId, available: false });
  }

  slotReleased(slotId: string, bookingId: string) {
    this.broadcast(SlotEvent.RELEASED, { slotId, bookingId, available: true });
  }

  private broadcast(event: string, payload: SlotEventPayload) {
    this.server.emit(event, payload); // server.emit = every connected client
  }
}
