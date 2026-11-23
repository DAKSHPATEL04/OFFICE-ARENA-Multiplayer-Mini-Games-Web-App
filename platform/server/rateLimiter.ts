import { PLATFORM_CONFIG } from '../shared/config.ts';

interface WindowCounter {
  timestamps: number[];
}

export class SocketRateLimiter {
  private creates: WindowCounter = { timestamps: [] };
  private joins: WindowCounter = { timestamps: [] };
  private msgSecWindowStart = Date.now();
  private msgSecCount = 0;
  private lastChatAt = 0;

  private checkWindow(counter: WindowCounter, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
    const now = Date.now();
    counter.timestamps = counter.timestamps.filter((t) => now - t < windowMs);
    if (counter.timestamps.length >= limit) {
      const oldest = counter.timestamps[0];
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
    }
    counter.timestamps.push(now);
    return { ok: true, retryAfterSec: 0 };
  }

  public recordMessage(): 'ok' | 'throttle' | 'close' {
    const now = Date.now();
    if (now - this.msgSecWindowStart >= 1000) {
      this.msgSecWindowStart = now;
      this.msgSecCount = 0;
    }
    this.msgSecCount += 1;
    if (this.msgSecCount > PLATFORM_CONFIG.limits.closeSocketMessagesPerSec) {
      return 'close';
    }
    if (this.msgSecCount > PLATFORM_CONFIG.limits.maxMessagesPerSec) {
      return 'throttle';
    }
    return 'ok';
  }

  public allowCreateRoom(): { ok: boolean; retryAfterSec: number } {
    return this.checkWindow(this.creates, PLATFORM_CONFIG.limits.createRoomPerMin, 60_000);
  }

  public allowJoinAttempt(): { ok: boolean; retryAfterSec: number } {
    return this.checkWindow(this.joins, PLATFORM_CONFIG.limits.joinAttemptsPerMin, 60_000);
  }

  public allowChat(): boolean {
    const now = Date.now();
    if (now - this.lastChatAt < PLATFORM_CONFIG.limits.chatCooldownMs) {
      return false;
    }
    this.lastChatAt = now;
    return true;
  }
}
