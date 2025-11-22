import { Module } from '@nestjs/common';
import { CallServerService } from './call-server.service';
import { CallServerGateway } from './call-server.gateway';

@Module({
  providers: [CallServerService, CallServerGateway],
  exports: [CallServerService],
})
export class CallServerModule {}