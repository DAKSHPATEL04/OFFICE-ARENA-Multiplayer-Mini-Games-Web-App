import type { ClientMessage, ServerMessage } from '../../shared/protocol.ts';
import type { RoomSnapshotState, RoomSummary } from '../../shared/types.ts';

export type ConnectionHealth = 'connected' | 'high-ping' | 'connecting' | 'offline';

type ServerListener = (msg: ServerMessage) => void;

export class NetworkManager {
  private ws: WebSocket | null = null;
  private listeners: Set<ServerListener> = new Set();
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private outQueue: ClientMessage[] = [];

  public status: ConnectionHealth = 'connecting';
  public pingMs = 0;
  public playerId: string | null = null;
  public currentRoom: RoomSnapshotState | null = null;
  public openRooms: RoomSummary[] = [];

  private simLagMs = 0;
  private simLossPct = 0;
  private lastJoinCode: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      this.simLagMs = Math.max(0, Number(params.get('lag') ?? 0));
      this.simLossPct = Math.max(0, Math.min(50, Number(params.get('loss') ?? 0)));
    }
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = navigator.onLine ? 'connecting' : 'offline';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.status = 'connected';
        while (this.outQueue.length > 0) {
          const m = this.outQueue.shift()!;
          this.sendImmediate(m);
        }
        this.send({ type: 'listRooms' });

        if (this.pingTimer !== null) clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => {
          this.send({ type: 'ping', t: Date.now() });
        }, 2000);

        // Auto-reconnect if we were in a room
        if (this.lastJoinCode) {
          const token = sessionStorage.getItem('oa.playerToken') ?? undefined;
          if (token) {
            this.send({ type: 'joinRoom', code: this.lastJoinCode, playerToken: token });
          }
        }
      };

      ws.onmessage = (ev) => {
        const deliver = () => {
          try {
            const msg = JSON.parse(String(ev.data)) as ServerMessage;
            this.handleServerMessage(msg);
          } catch {}
        };
        if (this.simLagMs > 0) {
          if (Math.random() * 100 < this.simLossPct) return;
          setTimeout(deliver, this.simLagMs / 2);
        } else {
          deliver();
        }
      };

      ws.onclose = () => {
        this.ws = null;
        if (this.pingTimer !== null) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        this.status = navigator.onLine ? 'connecting' : 'offline';
        if (this.reconnectTimer === null) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 1500);
        }
      };

      ws.onerror = () => {
        // Closed handler handles reconnect
      };
    } catch {
      this.status = 'offline';
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    if (msg.type === 'pong') {
      this.pingMs = Math.max(0, Date.now() - msg.t);
      this.status = this.pingMs > 160 ? 'high-ping' : 'connected';
    } else if (msg.type === 'rooms') {
      this.openRooms = msg.rooms;
    } else if (msg.type === 'roomJoined') {
      this.playerId = msg.playerId;
      this.currentRoom = msg.room;
      this.lastJoinCode = msg.room.code;
      sessionStorage.setItem('oa.playerToken', msg.playerToken);
    } else if (msg.type === 'roomUpdate') {
      this.currentRoom = msg.room;
    } else if (msg.type === 'roomClosed' || msg.type === 'kicked') {
      this.currentRoom = null;
      this.lastJoinCode = null;
    }

    for (const cb of this.listeners) {
      cb(msg);
    }
  }

  public send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (msg.type !== 'input' && msg.type !== 'ping') {
        this.outQueue.push(msg);
      }
      return;
    }
    if (this.simLagMs > 0 && msg.type === 'input') {
      if (Math.random() * 100 < this.simLossPct) return;
      setTimeout(() => this.sendImmediate(msg), this.simLagMs / 2);
    } else {
      this.sendImmediate(msg);
    }
  }

  private sendImmediate(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public clearRoomTracking(): void {
    this.lastJoinCode = null;
    this.currentRoom = null;
  }

  public subscribe(cb: ServerListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const networkManager = new NetworkManager();
