import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions, Server } from 'socket.io';

//IoAdapter is the default WebSocket adapter
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  //The base IoAdapter needs a reference to your Nest app to work. So our constructor takes app and passes it straight up to the parent with super(app)
  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    //the pub is for send and sub for listen
    //this create public client that point to radis ex:redis://localhost:6379
    const pubClient = createClient({ url });
    //this is the sub client that will listen to the messages from the pub client. The pub client will publish messages to the sub client. The sub client will then broadcast the messages to all connected clients.
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }
  //plugging radis with socket io
  createIOServer(port: number, options?: ServerOptions): Server {
    // super.createIOServer is typed `any` by NestJS — narrow it to Server so
    // the .adapter() call and return are type-safe (no "unsafe any" lint errors).
    const server = super.createIOServer(port, options) as Server;

    server.adapter(this.adapterConstructor);
    return server;
  }
}
