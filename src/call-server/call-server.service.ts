import { Injectable } from '@nestjs/common';

@Injectable()
export class CallServerService {
  private activeCalls = new Map();

  getActiveCalls() {
    return Array.from(this.activeCalls.entries());
  }

  getCallStats(roomId: string) {
    return this.activeCalls.get(roomId);
  }
}