import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket, DefaultEventsMap } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = { sub: string; email: string };

// What we store on each socket after authenticating it.
interface SocketData {
  userId: string;
}

// A Socket whose `data` is typed (so client.data.userId is a string, not `any`).
type AppSocket = Socket<
  DefaultEventsMap, // 1. events the client can RECEIVE
  DefaultEventsMap, // 2. events the client can SEND
  DefaultEventsMap, // 3. server-to-server events
  SocketData // 4. the shape of client.data  ← the only one we care about
>;
//marks class as a websocket gateway, which will listen for incoming websocket connections and messages (the socket equivalent of a controller)
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server; //give me server instance

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AppSocket) {
    //there is no guards for websockets, so we have to manually check if the user is authenticated. We do this by checking if the client has a valid JWT token in the handshake auth data. If the token is valid, we store the userId in the client data for later use. If the token is invalid, we disconnect the client.
    try {
      // Accept the token from the handshake auth (the app's real path),
      // OR a ?token= query param (easy to send from Postman / a browser).
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error('No token');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      //assign the userId to the client data so we can identify the user later
      client.data.userId = payload.sub; // remember who this socket belongs to
      this.logger.log(`Socket connected: ${client.id} (user ${payload.sub})`);
    } catch {
      this.logger.warn(`Rejected socket ${client.id}: invalid/missing token`);
      client.disconnect();
    }
  }
  // Client asks to watch a board -> we authorize, then join the room.

  //similar to post request to /boards/:boardId/watch, but over websockets. The client sends a message with the boardId they want to watch, and we check if they are allowed to watch that board. If they are allowed, we join them to a room for that board, so they will receive updates for that board. If they are not allowed, we send an error message back to the client.
  @SubscribeMessage('join_board')
  async joinBoard(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { boardId: string },
  ) {
    //during connection
    const userId = client.data.userId;
    const allowed = await this.userCanAccessBoard(userId, data.boardId);
    if (!allowed) {
      client.emit('error', { message: 'Not allowed to join this board' });
      return;
    }

    await client.join(`board:${data.boardId}`);
    //sends response to client
    client.emit('joined_board', { boardId: data.boardId });
  }

  @SubscribeMessage('leave_board')
  async leaveBoard(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { boardId: string },
  ) {
    await client.leave(`board:${data.boardId}`);
  }

  //services call this to broadcast changes to a board

  emitToBoard(boardId: string, event: string, data: unknown) {
    //sends only to clients in the room
    this.server.to(`board:${boardId}`).emit(event, data);
  }

  // Tenant check: is this user a member of the org that owns this board?
  private async userCanAccessBoard(
    userId: string,
    boardId: string,
  ): Promise<boolean> {
    const board = await this.prisma.board.findFirst({
      where: {
        id: boardId,
        project: { organization: { memberships: { some: { userId } } } },
      },
      select: { id: true },
    });
    return board !== null;
  }
}

// Code	Who receives it
// client.emit(...)	only this one client (the sender) — like a private reply
// server.emit(...)	everyone connected to the whole server
// server.to('board:X').emit(...)	everyone in room board:X (what emitToBoard uses)
// client.to('board:X').emit(...)	everyone in board:X except this client
