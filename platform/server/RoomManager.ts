import type { WebSocket } from 'ws';
import { GAMES } from '../../games/registry.ts';
import { PLATFORM_CONFIG } from '../shared/config.ts';
import type { GameModule } from '../shared/GameModule.ts';
import type { ClientMessage, ClientProfilePayload, ServerMessage } from '../shared/protocol.ts';
import type { RoomOptions, RoomSummary } from '../shared/types.ts';
import { SocketRateLimiter } from './rateLimiter.ts';
import { Room } from './Room.ts';

interface SocketSession {
  ws: WebSocket;
  ip: string;
  limiter: SocketRateLimiter;
  roomCode: string | null;
  playerId: string | null;
  lastPongAt: number;
}

export class RoomManager {
  private games: Map<string, GameModule> = new Map();
  private rooms: Map<string, Room> = new Map();
  private sessions: Map<WebSocket, SocketSession> = new Map();
  private ipCounts: Map<string, number> = new Map();
  private pushRoomsTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  public async init(): Promise<void> {
    for (const loader of GAMES) {
      const mod = (await loader()).default;
      this.games.set(mod.id, mod);
    }

    this.pushRoomsTimer = setInterval(() => {
      this.pushOpenRoomsToLobbyBrowsers();
    }, PLATFORM_CONFIG.timers.openRoomsPushMs);

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [ws, sess] of this.sessions.entries()) {
        if (now - sess.lastPongAt > PLATFORM_CONFIG.timers.heartbeatTimeoutMs) {
          ws.terminate();
          continue;
        }
        if (ws.readyState === 1) {
          ws.ping();
        }
      }
    }, PLATFORM_CONFIG.timers.pingIntervalMs);
  }

  public canAcceptConnection(ip: string): { ok: boolean; reason?: string } {
    if (this.sessions.size >= PLATFORM_CONFIG.limits.maxConnectionsPerServer) {
      return { ok: false, reason: 'Server connection limit reached.' };
    }
    const count = this.ipCounts.get(ip) ?? 0;
    if (count >= PLATFORM_CONFIG.limits.maxConnectionsPerIp) {
      return { ok: false, reason: 'Too many connections from this network.' };
    }
    return { ok: true };
  }

  public registerConnection(ws: WebSocket, ip: string): void {
    this.ipCounts.set(ip, (this.ipCounts.get(ip) ?? 0) + 1);
    const session: SocketSession = {
      ws,
      ip,
      limiter: new SocketRateLimiter(),
      roomCode: null,
      playerId: null,
      lastPongAt: Date.now(),
    };
    this.sessions.set(ws, session);

    ws.on('pong', () => {
      session.lastPongAt = Date.now();
    });

    ws.on('message', (data) => {
      session.lastPongAt = Date.now();
      if (Buffer.byteLength(data as Buffer) > PLATFORM_CONFIG.limits.maxMessageBytes) {
        return;
      }
      const rate = session.limiter.recordMessage();
      if (rate === 'close') {
        ws.close(4008, 'Rate limit exceeded');
        return;
      }
      if (rate === 'throttle') {
        return;
      }
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;
        this.handleMessage(session, msg);
      } catch {
        // Ignore malformed JSON
      }
    });

    ws.on('close', () => {
      this.cleanupSession(ws);
    });
  }

  private cleanupSession(ws: WebSocket): void {
    const sess = this.sessions.get(ws);
    if (!sess) return;
    this.sessions.delete(ws);

    const ipCnt = Math.max(0, (this.ipCounts.get(sess.ip) ?? 1) - 1);
    if (ipCnt === 0) this.ipCounts.delete(sess.ip);
    else this.ipCounts.set(sess.ip, ipCnt);

    if (sess.roomCode && sess.playerId) {
      const room = this.rooms.get(sess.roomCode);
      room?.handleDisconnect(sess.playerId);
    }
  }

  private handleMessage(sess: SocketSession, msg: ClientMessage): void {
    switch (msg.type) {
      case 'ping': {
        this.send(sess.ws, { type: 'pong', t: msg.t, serverTime: Date.now() });
        if (sess.roomCode && sess.playerId) {
          const room = this.rooms.get(sess.roomCode);
          const mem = room?.members.get(sess.playerId);
          if (mem) {
            mem.player.pingMs = Math.max(0, Math.min(999, Math.round(Date.now() - msg.t)));
          }
        }
        return;
      }
      case 'listGames': {
        this.send(sess.ws, {
          type: 'games',
          games: Array.from(this.games.values()).map((g) => ({ id: g.id, name: g.meta.name })),
        });
        return;
      }
      case 'listRooms': {
        this.send(sess.ws, { type: 'rooms', rooms: this.getOpenRoomsList() });
        return;
      }
      case 'createRoom': {
        const rate = sess.limiter.allowCreateRoom();
        if (!rate.ok) {
          this.send(sess.ws, {
            type: 'error',
            code: 'RATE_LIMIT',
            message: `Too many rooms created. Please wait ${rate.retryAfterSec}s.`,
            retryAfterSec: rate.retryAfterSec,
          });
          return;
        }
        this.createAndJoinRoom(sess, msg.gameId, msg.options, msg.profile, msg.gameSettings);
        return;
      }
      case 'joinRoom': {
        const rate = sess.limiter.allowJoinAttempt();
        if (!rate.ok) {
          this.send(sess.ws, {
            type: 'error',
            code: 'RATE_LIMIT',
            message: `Too many join attempts. Please wait ${rate.retryAfterSec}s.`,
            retryAfterSec: rate.retryAfterSec,
          });
          return;
        }
        this.joinExistingRoom(sess, msg.code, msg.password, msg.asSpectator, msg.playerToken, msg.profile);
        return;
      }
      case 'quickJoin': {
        this.handleQuickJoin(sess, msg.gameId);
        return;
      }
      case 'leaveRoom': {
        if (sess.roomCode && sess.playerId) {
          const room = this.rooms.get(sess.roomCode);
          room?.removePlayer(sess.playerId, 'left');
          sess.roomCode = null;
          sess.playerId = null;
        }
        return;
      }
    }

    // Room-scoped messages
    if (!sess.roomCode || !sess.playerId) return;
    const room = this.rooms.get(sess.roomCode);
    if (!room) return;

    switch (msg.type) {
      case 'closeRoom':
        room.closeByHost(sess.playerId);
        break;
      case 'setRoomOptions':
        room.handleSetRoomOptions(sess.playerId, msg.options);
        break;
      case 'setProfile':
        room.handleSetProfile(sess.playerId, msg);
        break;
      case 'setTeam':
        room.handleSetTeam(sess.playerId, msg.team);
        break;
      case 'movePlayerTeam':
        room.handleMovePlayerTeam(sess.playerId, msg.targetId, msg.team);
        break;
      case 'shuffleTeams':
        room.handleShuffleTeams(sess.playerId);
        break;
      case 'autoBalanceTeams':
        room.handleAutoBalance(sess.playerId);
        break;
      case 'setReady':
        room.handleSetReady(sess.playerId, msg.ready);
        break;
      case 'hostSettings':
        room.handleHostSettings(sess.playerId, msg.settings);
        break;
      case 'startMatch':
        room.handleStartMatch(sess.playerId, Boolean(msg.force));
        break;
      case 'cancelAutoStart':
        if (room.members.get(sess.playerId)?.player.isHost) {
          room.cancelAutoStart();
          room.broadcastRoomUpdate();
        }
        break;
      case 'loaded':
        room.handleClientLoaded(sess.playerId);
        break;
      case 'takeSeat':
        room.handleTakeSeat(sess.playerId);
        break;
      case 'joinMatch':
        room.handleJoinMatchLate(sess.playerId);
        break;
      case 'kick':
        room.handleKick(sess.playerId, msg.id);
        break;
      case 'ban':
        room.handleBan(sess.playerId, msg.id);
        break;
      case 'transferHost':
        room.handleTransferHost(sess.playerId, msg.id);
        break;
      case 'input':
        room.handleInput(sess.playerId, msg.payload);
        break;
      case 'chat':
        if (sess.limiter.allowChat()) {
          room.handleChat(sess.playerId, msg.text);
        }
        break;
      case 'rematch':
        room.handleRematchVote(sess.playerId);
        break;
      case 'backToLobby':
        room.handleBackToLobby(sess.playerId);
        break;
    }
  }

  private createAndJoinRoom(
    sess: SocketSession,
    gameId: string,
    options: Partial<RoomOptions>,
    profile?: ClientProfilePayload,
    gameSettings?: Record<string, unknown>,
  ): void {
    if (this.rooms.size >= PLATFORM_CONFIG.limits.maxRoomsPerServer) {
      this.send(sess.ws, { type: 'error', code: 'SERVER_FULL', message: 'Server room limit reached. Try joining an open room.' });
      return;
    }
    const game = this.games.get(gameId);
    if (!game) {
      this.send(sess.ws, { type: 'error', code: 'GAME_NOT_FOUND', message: 'Game module not found.' });
      return;
    }
    if (sess.roomCode && sess.playerId) {
      this.rooms.get(sess.roomCode)?.removePlayer(sess.playerId, 'left');
    }

    const code = this.generateUniqueCode();
    const room = new Room(
      code,
      game,
      options,
      profile?.nickname ?? 'Host',
      (destroyedCode) => {
        this.rooms.delete(destroyedCode);
        this.pushOpenRoomsToLobbyBrowsers();
      },
      () => this.pushOpenRoomsToLobbyBrowsers(),
      gameSettings,
    );
    this.rooms.set(code, room);

    const res = room.addOrReconnectPlayer(sess.ws, profile, {});
    if (!res.ok) {
      this.send(sess.ws, { type: 'error', code: res.code, message: res.message });
      return;
    }
    sess.roomCode = code;
    sess.playerId = res.member.player.id;

    this.send(sess.ws, {
      type: 'roomJoined',
      playerId: res.member.player.id,
      playerToken: res.member.token,
      room: room.getSnapshotState(),
      isSpectator: res.member.player.isSpectator,
    });
    this.pushOpenRoomsToLobbyBrowsers();
  }

  private joinExistingRoom(
    sess: SocketSession,
    rawCode: string,
    password?: string,
    asSpectator?: boolean,
    playerToken?: string,
    profile?: ClientProfilePayload,
  ): void {
    const code = String(rawCode ?? '').toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) {
      this.send(sess.ws, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Room not found. Double-check the 4-letter code.' });
      return;
    }

    if (sess.roomCode && sess.roomCode !== code && sess.playerId) {
      this.rooms.get(sess.roomCode)?.removePlayer(sess.playerId, 'left');
    }

    const res = room.addOrReconnectPlayer(sess.ws, profile, { password, asSpectator, playerToken });
    if (!res.ok) {
      this.send(sess.ws, {
        type: 'error',
        code: res.code,
        message: res.message,
        canSpectate: res.canSpectate,
        needsPassword: res.needsPassword,
      });
      return;
    }

    sess.roomCode = code;
    sess.playerId = res.member.player.id;
    this.send(sess.ws, {
      type: 'roomJoined',
      playerId: res.member.player.id,
      playerToken: res.member.token,
      room: room.getSnapshotState(),
      isSpectator: res.member.player.isSpectator,
    });
  }

  private handleQuickJoin(sess: SocketSession, gameId: string): void {
    const candidates = Array.from(this.rooms.values())
      .filter((r) => {
        const s = r.getSummary();
        return (
          s.gameId === gameId &&
          r.options.visibility === 'open' &&
          !s.hasPassword &&
          s.status === 'LOBBY' &&
          s.players < s.maxPlayers
        );
      })
      .sort((a, b) => b.getActivePlayers().length - a.getActivePlayers().length);

    if (candidates.length === 0) {
      this.send(sess.ws, {
        type: 'error',
        code: 'NO_OPEN_ROOMS',
        message: 'No open rooms available right now. Create one and share the code!',
      });
      return;
    }
    this.joinExistingRoom(sess, candidates[0].code);
  }

  public getOpenRoomsList(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .filter((r) => r.options.visibility === 'open')
      .map((r) => r.getSummary())
      .sort((a, b) => b.players - a.players);
  }

  private pushOpenRoomsToLobbyBrowsers(): void {
    const rooms = this.getOpenRoomsList();
    const msg = JSON.stringify({ type: 'rooms', rooms } satisfies ServerMessage);
    for (const sess of this.sessions.values()) {
      if (!sess.roomCode && sess.ws.readyState === 1) {
        sess.ws.send(msg);
      }
    }
  }

  private generateUniqueCode(): string {
    const alpha = PLATFORM_CONFIG.roomCodeAlphabet;
    for (let attempt = 0; attempt < 200; attempt++) {
      let code = '';
      for (let i = 0; i < PLATFORM_CONFIG.roomCodeLength; i++) {
        code += alpha[Math.floor(Math.random() * alpha.length)];
      }
      if (!PLATFORM_CONFIG.roomCodeBadWords.includes(code as (typeof PLATFORM_CONFIG.roomCodeBadWords)[number]) && !this.rooms.has(code)) {
        return code;
      }
    }
    return `R${Math.floor(100 + Math.random() * 899)}`;
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  public shutdown(): void {
    if (this.pushRoomsTimer) clearInterval(this.pushRoomsTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const r of this.rooms.values()) {
      r.destroy('Server restarting');
    }
  }
}
