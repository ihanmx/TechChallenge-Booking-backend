import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway], // so BookingsModule can inject it to emit events
})
export class RealtimeModule {}
