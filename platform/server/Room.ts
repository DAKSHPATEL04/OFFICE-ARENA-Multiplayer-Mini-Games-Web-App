import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { PLAYER_COLORS, PLATFORM_CONFIG, PROFILE_ICONS } from '../shared/config.ts';
import type { GameModule, GameRoom } from '../shared/GameModule.ts';
import type { ClientProfilePayload, ServerMessage } from '../shared/protocol.ts';
import type {
  ChatMessage,
  MatchResult,
  RoomOptions,
  RoomPhase,
  RoomPlayer,
  RoomSnapshotState,
  RoomSummary,
  TeamId,
} from '../shared/types.ts';
import {
  clampSettingValue,
  filterChatText,
  hashPassword,
  sanitizeNickname,
  sanitizeRoomName,
  verifyPassword,
} from './validation.ts';

export interface ConnectedMember {
  player: RoomPlayer;
  token: string;
  ws: WebSocket | null;
  loaded: boolean;
  disconnectedTimer?: ReturnType<typeof setTimeout>;
}

export class Room {
  public readonly code: string;
  public readonly game: GameModule;
  public options: RoomOptions;
  public passwordHash = '';
  public phase: RoomPhase = 'LOBBY';
  public gameSettings: Record<string, unknown> = {};
  public members: Map<string, ConnectedMember> = new Map();
  public tokenToId: Map<string, string> = new Map();
  public kickedUntil: Map<string, number> = new Map();
  public bannedTokens: Set<string> = new Set();
  public chat: ChatMessage[] = [];
  public lastResult: MatchResult | null = null;

  private gameRoom: GameRoom | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private snapInterval: ReturnType<typeof setInterval> | null = null;
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private autoStartInterval: ReturnType<typeof setInterval> | null = null;
  private emptyDestroyTimer: ReturnType<typeof setTimeout> | null = null;

  private autoStartRemainingSec: number | null = null;
  private countdownRemainingSec: number | null = null;
  private matchStartedAt: number | null = null;
  private matchSeed = 1;
  private onDestroyed: (code: string) => void;
  private onRoomsChanged: () => void;

  constructor(
    code: string,
    game: GameModule,
    initialOptions: Partial<RoomOptions>,
    hostNickname: string,
    onDestroyed: (code: string) => void,
    onRoomsChanged: () => void,
    initialGameSettings?: Record<string, unknown>,
  ) {
    this.code = code;
    this.game = game;
    this.onDestroyed = onDestroyed;
    this.onRoomsChanged = onRoomsChanged;

    const maxP = Math.max(
      game.meta.minPlayers,
      Math.min(game.meta.maxPlayers, Number(initialOptions.maxPlayers ?? game.meta.defaultMaxPlayers)),
    );
    const pw = String(initialOptions.password ?? '').slice(0, PLATFORM_CONFIG.limits.passwordMax);
    this.passwordHash = pw.length >= PLATFORM_CONFIG.limits.passwordMin ? hashPassword(pw) : '';

    this.options = {
      name: sanitizeRoomName(initialOptions.name, hostNickname),
      visibility: initialOptions.visibility === 'open' ? 'open' : 'private',
      password: this.passwordHash ? '••••' : '',
      maxPlayers: maxP,
      allowSpectators: initialOptions.allowSpectators !== false,
      allowLateJoin: initialOptions.allowLateJoin !== false,
      startRule: initialOptions.startRule === 'auto' ? 'auto' : 'host',
    };

    for (const def of game.settingsSchema) {
      this.gameSettings[def.key] = def.defaultValue;
    }
    if (initialGameSettings) {
      for (const [key, rawVal] of Object.entries(initialGameSettings)) {
        const def = game.settingsSchema.find((s) => s.key === key);
        if (def) {
          this.gameSettings[key] = clampSettingValue(def, rawVal);
        }
      }
    }
  }

  public getActivePlayers(): ConnectedMember[] {
    return Array.from(this.members.values()).filter((m) => !m.player.isSpectator);
  }

  public getHumanPlayers(): ConnectedMember[] {
    return Array.from(this.members.values()).filter((m) => !m.player.isBot);
  }

  public getSummary(): RoomSummary {
    const active = this.getActivePlayers();
    const host = this.getHostMember();
    const spectators = Array.from(this.members.values()).filter((m) => m.player.isSpectator).length;
    return {
      code: this.code,
      name: this.options.name,
      gameId: this.game.id,
      gameName: this.game.meta.name,
      hostName: host?.player.nickname ?? 'Host',
      players: active.length,
      maxPlayers: this.options.maxPlayers,
      spectators,
      status: this.phase,
      hasPassword: Boolean(this.passwordHash),
      allowSpectators: this.options.allowSpectators,
    };
  }

  public getSnapshotState(): RoomSnapshotState {
    const lateJoinAllowed =
      this.phase === 'PLAYING' &&
      this.options.allowLateJoin &&
      Boolean(this.gameRoom?.canLateJoin ? this.gameRoom.canLateJoin(0) : true);

    return {
      code: this.code,
      gameId: this.game.id,
      phase: this.phase,
      options: { ...this.options },
      players: Array.from(this.members.values())
        .map((m) => ({ ...m.player }))
        .sort((a, b) => a.joinedAt - b.joinedAt),
      gameSettings: { ...this.gameSettings },
      chat: this.chat.slice(-40),
      autoStartRemainingSec: this.autoStartRemainingSec,
      countdownRemainingSec: this.countdownRemainingSec,
      matchStartedAt: this.matchStartedAt,
      serverTime: Date.now(),
      lateJoinAllowed,
    };
  }

  public verifyRoomPassword(password?: string): boolean {
    if (!this.passwordHash) return true;
    return verifyPassword(password ?? '', this.passwordHash);
  }

  public addOrReconnectPlayer(
    ws: WebSocket,
    profile: ClientProfilePayload | undefined,
    opts: { password?: string; asSpectator?: boolean; playerToken?: string },
  ): { ok: true; member: ConnectedMember; reconnected: boolean } | { ok: false; code: string; message: string; canSpectate?: boolean; needsPassword?: boolean } {
    // Reconnect check via token
    if (opts.playerToken) {
      if (this.bannedTokens.has(opts.playerToken)) {
        return { ok: false, code: 'BANNED', message: 'You are banned from this room.' };
      }
      const kickExp = this.kickedUntil.get(opts.playerToken);
      if (kickExp && Date.now() < kickExp) {
        return { ok: false, code: 'KICKED', message: 'You were removed by the host. Try again shortly.' };
      }
      const existingId = this.tokenToId.get(opts.playerToken);
      if (existingId && this.members.has(existingId)) {
        const mem = this.members.get(existingId)!;
        if (mem.disconnectedTimer) {
          clearTimeout(mem.disconnectedTimer);
          mem.disconnectedTimer = undefined;
        }
        mem.ws = ws;
        mem.player.isDisconnected = false;
        mem.player.disconnectExpiresAt = undefined;
        if (this.gameRoom) {
          try {
            this.gameRoom.onReconnect(mem.player.id);
          } catch (err) {
            console.error(`[Room ${this.code}] onReconnect error:`, err);
          }
        }
        if (this.emptyDestroyTimer) {
          clearTimeout(this.emptyDestroyTimer);
          this.emptyDestroyTimer = null;
        }
        this.broadcastRoomUpdate();
        return { ok: true, member: mem, reconnected: true };
      }
    }

    // Password check
    if (this.passwordHash && !this.verifyRoomPassword(opts.password)) {
      return {
        ok: false,
        code: 'WRONG_PASSWORD',
        message: opts.password ? 'Wrong password.' : 'This room requires a password.',
        needsPassword: true,
      };
    }

    const activeCount = this.getActivePlayers().length;
    const spectatorCount = Array.from(this.members.values()).filter((m) => m.player.isSpectator).length;
    let joinAsSpectator = Boolean(opts.asSpectator);

    if (this.phase !== 'LOBBY') {
      if (!joinAsSpectator) {
        if (this.options.allowSpectators && spectatorCount < this.game.meta.maxSpectators) {
          return {
            ok: false,
            code: 'MATCH_RUNNING',
            message: 'Match already running. Watch as a spectator?',
            canSpectate: true,
          };
        }
        return { ok: false, code: 'MATCH_RUNNING', message: 'Match already running and spectator seats are full.' };
      }
    } else if (activeCount >= this.options.maxPlayers && !joinAsSpectator) {
      // Try displacing a bot if fillBots added one, else full
      const botToReplace = this.findBotToReplace();
      if (botToReplace) {
        this.members.delete(botToReplace.player.id);
      } else {
        if (this.options.allowSpectators && spectatorCount < this.game.meta.maxSpectators) {
          return {
            ok: false,
            code: 'ROOM_FULL',
            message: `Room is full (${this.options.maxPlayers}/${this.options.maxPlayers}). Watch as a spectator?`,
            canSpectate: true,
          };
        }
        return { ok: false, code: 'ROOM_FULL', message: 'Room is full.' };
      }
    }

    if (joinAsSpectator && (!this.options.allowSpectators || spectatorCount >= this.game.meta.maxSpectators)) {
      return { ok: false, code: 'SPECTATORS_FULL', message: 'Spectators are not allowed or spectator list is full.' };
    }

    const existingNames = Array.from(this.members.values()).map((m) => m.player.nickname);
    const nickname = sanitizeNickname(profile?.nickname, existingNames);
    const colorId = PLAYER_COLORS.some((c) => c.id === profile?.colorId)
      ? profile!.colorId
      : PLAYER_COLORS[this.members.size % PLAYER_COLORS.length].id;
    const iconId = PROFILE_ICONS.includes(profile?.iconId as (typeof PROFILE_ICONS)[number])
      ? profile!.iconId
      : PROFILE_ICONS[0];
    const validStyle = this.validateControlStyle(profile?.controlStyle);
    const device = profile?.device ?? 'pc';

    const isFirstHuman = this.getHumanPlayers().length === 0;
    const team = this.pickBalancedTeam();
    const id = `p_${crypto.randomBytes(5).toString('hex')}`;
    const token = opts.playerToken || crypto.randomBytes(12).toString('hex');

    const player: RoomPlayer = {
      id,
      nickname,
      colorId,
      iconId,
      team,
      isHost: isFirstHuman,
      isBot: false,
      isSpectator: joinAsSpectator,
      isReady: false,
      isAway: false,
      isDisconnected: false,
      controlStyle: validStyle,
      device,
      pingMs: 0,
      rematchVoted: false,
      joinedAt: Date.now(),
    };

    const member: ConnectedMember = {
      player,
      token,
      ws,
      loaded: this.phase === 'PLAYING',
    };

    this.members.set(id, member);
    this.tokenToId.set(token, id);

    if (this.emptyDestroyTimer) {
      clearTimeout(this.emptyDestroyTimer);
      this.emptyDestroyTimer = null;
    }

    this.cancelAutoStart();
    this.broadcast({ type: 'toast', level: 'info', text: `${nickname} joined the room.` }, id);
    this.broadcastRoomUpdate();
    this.onRoomsChanged();

    return { ok: true, member, reconnected: false };
  }

  public handleDisconnect(playerId: string): void {
    const mem = this.members.get(playerId);
    if (!mem) return;
    mem.ws = null;
    mem.player.isDisconnected = true;
    mem.player.disconnectExpiresAt = Date.now() + PLATFORM_CONFIG.timers.reconnectGraceMs;

    if (this.gameRoom && !mem.player.isSpectator) {
      try {
        (this.gameRoom as { onDisconnect?: (id: string) => void }).onDisconnect?.(playerId);
      } catch (err) {
        console.error(`[Room ${this.code}] onDisconnect error:`, err);
      }
    }

    if (mem.player.isHost) {
      this.migrateHost(playerId);
    }

    mem.disconnectedTimer = setTimeout(() => {
      this.removePlayer(playerId, 'disconnected');
    }, PLATFORM_CONFIG.timers.reconnectGraceMs);

    this.broadcastRoomUpdate();
    this.checkAllHumansGone();
  }

  public removePlayer(playerId: string, reason: 'left' | 'disconnected' | 'kicked' | 'banned'): void {
    const mem = this.members.get(playerId);
    if (!mem) return;
    if (mem.disconnectedTimer) clearTimeout(mem.disconnectedTimer);
    const wasHost = mem.player.isHost;

    if (this.gameRoom && !mem.player.isSpectator) {
      try {
        this.gameRoom.onPlayerLeave(playerId);
      } catch (err) {
        console.error(`[Room ${this.code}] onPlayerLeave error:`, err);
      }
    }

    this.members.delete(playerId);
    this.tokenToId.delete(mem.token);

    if (wasHost) {
      this.migrateHost(playerId);
    }

    if (reason === 'left') {
      this.broadcast({ type: 'toast', level: 'info', text: `${mem.player.nickname} left.` });
    }

    // P28: If mid-match and only 1 human remains with no bots, return to lobby
    if (this.phase === 'PLAYING') {
      const activeHumans = Array.from(this.members.values()).filter((m) => !m.player.isBot && !m.player.isSpectator && !m.player.isDisconnected);
      const activeBots = Array.from(this.members.values()).filter((m) => m.player.isBot && !m.player.isSpectator);
      if (activeHumans.length <= 1 && activeBots.length === 0) {
        this.stopMatchLoops();
        this.phase = 'LOBBY';
        this.broadcast({ type: 'toast', level: 'warning', text: 'Waiting for more players — returned to lobby.' });
      }
    }

    this.cancelAutoStart();
    this.broadcastRoomUpdate();
    this.onRoomsChanged();
    this.checkAllHumansGone();
  }

  private checkAllHumansGone(): void {
    const connectedHumans = Array.from(this.members.values()).filter((m) => !m.player.isBot && m.ws !== null);
    if (connectedHumans.length === 0 && !this.emptyDestroyTimer) {
      this.emptyDestroyTimer = setTimeout(() => {
        this.destroy('All players left');
      }, PLATFORM_CONFIG.timers.emptyRoomGraceMs);
    }
  }

  private migrateHost(excludeId?: string): void {
    const candidates = Array.from(this.members.values())
      .filter((m) => !m.player.isBot && m.player.id !== excludeId)
      .sort((a, b) => a.player.joinedAt - b.player.joinedAt);

    const connectedFirst = candidates.find((c) => !c.player.isDisconnected) ?? candidates[0];
    if (!connectedFirst) return;

    for (const m of this.members.values()) m.player.isHost = false;
    connectedFirst.player.isHost = true;
    this.broadcast({ type: 'toast', level: 'info', text: `${connectedFirst.player.nickname} is now the host.` });
  }

  public getHostMember(): ConnectedMember | undefined {
    return Array.from(this.members.values()).find((m) => m.player.isHost);
  }

  public handleSetRoomOptions(senderId: string, patch: Partial<RoomOptions>): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || this.phase !== 'LOBBY') return;

    const activeCount = this.getActivePlayers().length;
    if (patch.maxPlayers !== undefined) {
      // P21: cannot lower below current player count
      const clamped = Math.max(
        Math.max(activeCount, this.game.meta.minPlayers),
        Math.min(this.game.meta.maxPlayers, Number(patch.maxPlayers)),
      );
      this.options.maxPlayers = clamped;
    }
    if (patch.name !== undefined) {
      this.options.name = sanitizeRoomName(patch.name, sender.player.nickname);
    }
    if (patch.visibility === 'open' || patch.visibility === 'private') {
      this.options.visibility = patch.visibility;
    }
    if (patch.allowSpectators !== undefined) {
      this.options.allowSpectators = Boolean(patch.allowSpectators);
    }
    if (patch.allowLateJoin !== undefined) {
      this.options.allowLateJoin = Boolean(patch.allowLateJoin);
    }
    if (patch.startRule === 'host' || patch.startRule === 'auto') {
      this.options.startRule = patch.startRule;
    }
    if (patch.password !== undefined) {
      const pw = String(patch.password).slice(0, PLATFORM_CONFIG.limits.passwordMax);
      this.passwordHash = pw.length >= PLATFORM_CONFIG.limits.passwordMin ? hashPassword(pw) : '';
      this.options.password = this.passwordHash ? '••••' : '';
    }

    this.clearAllReady();
    this.broadcastRoomUpdate();
    this.onRoomsChanged();
  }

  public handleHostSettings(senderId: string, patch: Record<string, unknown>): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || this.phase !== 'LOBBY') return;

    for (const [key, rawVal] of Object.entries(patch)) {
      const def = this.game.settingsSchema.find((s) => s.key === key);
      if (def) {
        this.gameSettings[key] = clampSettingValue(def, rawVal);
      }
    }

    // Ensure FFA vs Team alignment
    const modeDef = this.game.modes.find((m) => m.id === this.gameSettings.mode);
    if (modeDef?.teamType === 'ffa') {
      for (const m of this.members.values()) {
        if (!m.player.isSpectator) m.player.team = 'ffa';
      }
    } else {
      for (const m of this.members.values()) {
        if (!m.player.isSpectator && m.player.team === 'ffa') {
          m.player.team = this.pickBalancedTeam();
        }
      }
    }

    this.clearAllReady();
    this.broadcastRoomUpdate();
  }

  public handleSetProfile(
    senderId: string,
    payload: { nickname: string; colorId: string; iconId: string; controlStyle: string; device: 'pc' | 'touch' | 'pad' },
  ): void {
    const mem = this.members.get(senderId);
    if (!mem) return;
    const otherNames = Array.from(this.members.values())
      .filter((m) => m.player.id !== senderId)
      .map((m) => m.player.nickname);
    mem.player.nickname = sanitizeNickname(payload.nickname, otherNames);
    if (PLAYER_COLORS.some((c) => c.id === payload.colorId)) {
      if (mem.player.colorId !== payload.colorId) mem.player.isReady = false;
      mem.player.colorId = payload.colorId;
    }
    if (PROFILE_ICONS.includes(payload.iconId as (typeof PROFILE_ICONS)[number])) {
      mem.player.iconId = payload.iconId;
    }
    const validStyle = this.validateControlStyle(payload.controlStyle);
    if (mem.player.controlStyle !== validStyle) {
      mem.player.controlStyle = validStyle;
      if (this.phase === 'LOBBY') mem.player.isReady = false;
      if (this.gameRoom) {
        try {
          (this.gameRoom as { setControlStyle?: (id: string, style: string) => void }).setControlStyle?.(senderId, validStyle);
        } catch {}
      }
    }
    mem.player.device = payload.device;
    this.broadcastRoomUpdate();
  }

  public handleSetTeam(senderId: string, team: TeamId): void {
    const mem = this.members.get(senderId);
    if (!mem || this.phase !== 'LOBBY' || mem.player.isSpectator) return;
    if (this.isTeamMode()) {
      if (team !== 'red' && team !== 'blue') return;
      const teamCap = this.game.meta.teamSize?.max ?? 6;
      const count = this.getActivePlayers().filter((m) => m.player.team === team && m.player.id !== senderId).length;
      if (count >= teamCap) {
        this.sendTo(mem.ws, { type: 'toast', level: 'warning', text: `Team full (${teamCap}/${teamCap})` });
        return;
      }
      mem.player.team = team;
      mem.player.isReady = false;
      this.broadcastRoomUpdate();
    }
  }

  public handleMovePlayerTeam(senderId: string, targetId: string, team: TeamId): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || this.phase !== 'LOBBY') return;
    const target = this.members.get(targetId);
    if (!target || target.player.isSpectator || !this.isTeamMode()) return;
    if (team !== 'red' && team !== 'blue') return;
    const teamCap = this.game.meta.teamSize?.max ?? 6;
    const count = this.getActivePlayers().filter((m) => m.player.team === team && m.player.id !== targetId).length;
    if (count >= teamCap) return;
    target.player.team = team;
    target.player.isReady = false;
    this.broadcastRoomUpdate();
  }

  public handleShuffleTeams(senderId: string): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || this.phase !== 'LOBBY' || !this.isTeamMode()) return;
    const active = this.getActivePlayers();
    for (let i = active.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [active[i], active[j]] = [active[j], active[i]];
    }
    active.forEach((m, idx) => {
      m.player.team = idx % 2 === 0 ? 'red' : 'blue';
      m.player.isReady = false;
    });
    this.broadcastRoomUpdate();
  }

  public handleAutoBalance(senderId: string): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || this.phase !== 'LOBBY' || !this.isTeamMode()) return;
    const active = this.getActivePlayers();
    active.forEach((m, idx) => {
      m.player.team = idx % 2 === 0 ? 'red' : 'blue';
      m.player.isReady = false;
    });
    this.broadcastRoomUpdate();
  }

  public handleSetReady(senderId: string, ready: boolean): void {
    const mem = this.members.get(senderId);
    if (!mem || this.phase !== 'LOBBY' || mem.player.isSpectator) return;
    mem.player.isReady = ready;
    if (!ready) this.cancelAutoStart();
    else this.checkAutoStart();
    this.broadcastRoomUpdate();
  }

  public handleTakeSeat(senderId: string): void {
    const mem = this.members.get(senderId);
    if (!mem || !mem.player.isSpectator) return;
    if (this.phase !== 'LOBBY' && this.phase !== 'RESULTS') return;
    const activeCount = this.getActivePlayers().length;
    if (activeCount >= this.options.maxPlayers) {
      const bot = this.findBotToReplace();
      if (bot) this.members.delete(bot.player.id);
      else {
        this.sendTo(mem.ws, { type: 'toast', level: 'warning', text: 'All player seats are currently taken.' });
        return;
      }
    }
    mem.player.isSpectator = false;
    mem.player.isReady = false;
    mem.player.team = this.pickBalancedTeam();
    this.broadcast({ type: 'toast', level: 'info', text: `${mem.player.nickname} took a seat.` });
    this.broadcastRoomUpdate();
    this.onRoomsChanged();
  }

  public handleJoinMatchLate(senderId: string): void {
    const mem = this.members.get(senderId);
    if (!mem || !mem.player.isSpectator || this.phase !== 'PLAYING' || !this.gameRoom) return;
    if (!this.options.allowLateJoin) {
      this.sendTo(mem.ws, { type: 'toast', level: 'warning', text: 'Late join is disabled in this room.' });
      return;
    }
    const activeCount = this.getActivePlayers().length;
    if (activeCount >= this.options.maxPlayers) {
      const bot = this.findBotToReplace();
      if (bot) {
        this.gameRoom.onPlayerLeave(bot.player.id);
        this.members.delete(bot.player.id);
      } else {
        this.sendTo(mem.ws, { type: 'toast', level: 'warning', text: 'Match is full.' });
        return;
      }
    }
    mem.player.team = this.pickBalancedTeam();
    const ok = this.gameRoom.onLateJoin ? this.gameRoom.onLateJoin(mem.player) : false;
    if (!ok) {
      this.sendTo(mem.ws, { type: 'toast', level: 'warning', text: 'Too late in the match or sudden death active.' });
      return;
    }
    mem.player.isSpectator = false;
    this.broadcast({ type: 'toast', level: 'info', text: `${mem.player.nickname} joined the match!` });
    this.broadcastRoomUpdate();
    this.onRoomsChanged();
  }

  public handleKick(senderId: string, targetId: string): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || senderId === targetId) return;
    const target = this.members.get(targetId);
    if (!target) return;
    this.kickedUntil.set(target.token, Date.now() + PLATFORM_CONFIG.timers.kickCooldownMs);
    this.sendTo(target.ws, { type: 'kicked', reason: 'You were removed by the host.', banned: false });
    target.ws?.close(4001, 'Kicked');
    this.removePlayer(targetId, 'kicked');
  }

  public handleBan(senderId: string, targetId: string): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || senderId === targetId) return;
    const target = this.members.get(targetId);
    if (!target) return;
    this.bannedTokens.add(target.token);
    this.sendTo(target.ws, { type: 'kicked', reason: 'You were banned from this room.', banned: true });
    target.ws?.close(4002, 'Banned');
    this.removePlayer(targetId, 'banned');
  }

  public handleTransferHost(senderId: string, targetId: string): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || senderId === targetId) return;
    const target = this.members.get(targetId);
    if (!target || target.player.isBot) return;
    sender.player.isHost = false;
    target.player.isHost = true;
    this.broadcast({ type: 'toast', level: 'info', text: `${target.player.nickname} is now the host.` });
    this.broadcastRoomUpdate();
    this.onRoomsChanged();
  }

  public handleChat(senderId: string, rawText: string): void {
    const mem = this.members.get(senderId);
    if (!mem || mem.player.isSpectator) return;
    const text = filterChatText(rawText);
    if (!text) return;
    const colorDef = PLAYER_COLORS.find((c) => c.id === mem.player.colorId) ?? PLAYER_COLORS[0];
    const msg: ChatMessage = {
      id: crypto.randomBytes(4).toString('hex'),
      senderId: mem.player.id,
      senderName: mem.player.nickname,
      senderColor: colorDef.hex,
      text,
      timestamp: Date.now(),
    };
    this.chat.push(msg);
    if (this.chat.length > 50) this.chat.shift();
    this.broadcast({ type: 'chatMessage', message: msg });
  }

  public handleStartMatch(senderId: string, force = false): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || this.phase !== 'LOBBY') return;
    this.cancelAutoStart();

    // Remove previous temporary bots before filling
    for (const [id, m] of this.members.entries()) {
      if (m.player.isBot) this.members.delete(id);
    }

    const activeHumans = this.getActivePlayers().filter((m) => !m.player.isBot);
    const readyHumans = activeHumans.filter((m) => m.player.isReady || m.player.isHost);
    const unreadyHumans = activeHumans.filter((m) => !m.player.isReady && !m.player.isHost);

    if (unreadyHumans.length > 0 && !force) {
      this.sendTo(sender.ws, {
        type: 'toast',
        level: 'warning',
        text: 'Some players are not ready. Use Start anyway to launch with them watching.',
      });
      return;
    }

    // P25: unready humans spectate this match and return to their seats afterwards
    if (force) {
      for (const m of unreadyHumans) {
        m.player.watchingThisMatch = true;
        m.player.isSpectator = true;
      }
    }

    // Add bots per settings
    this.populateMatchBots(readyHumans.length);

    const activeTotal = this.getActivePlayers().length;
    if (activeTotal < this.game.meta.minPlayers) {
      this.restoreWatchers();
      this.sendTo(sender.ws, {
        type: 'toast',
        level: 'error',
        text: `Need at least ${this.game.meta.minPlayers} players (or enable bots) to start.`,
      });
      this.broadcastRoomUpdate();
      return;
    }

    // Begin LOADING -> COUNTDOWN -> PLAYING
    this.phase = 'LOADING';
    this.matchSeed = Math.floor(Math.random() * 0x7fffffff) || 1;
    for (const m of this.members.values()) {
      m.loaded = m.player.isBot || m.player.isSpectator || m.player.isDisconnected;
    }

    this.broadcast({
      type: 'loading',
      mapId: String(this.gameSettings.map ?? 'auto'),
      modeId: String(this.gameSettings.mode ?? 'flag'),
      settings: { ...this.gameSettings },
      seed: this.matchSeed,
    });
    this.broadcastRoomUpdate();
    this.onRoomsChanged();

    this.loadingTimeout = setTimeout(() => {
      this.beginCountdown();
    }, PLATFORM_CONFIG.timers.loadingMaxMs);

    this.checkAllLoaded();
  }

  public handleClientLoaded(senderId: string): void {
    if (this.phase !== 'LOADING') return;
    const mem = this.members.get(senderId);
    if (!mem) return;
    mem.loaded = true;
    this.checkAllLoaded();
  }

  private checkAllLoaded(): void {
    if (this.phase !== 'LOADING') return;
    const allLoaded = Array.from(this.members.values()).every((m) => m.loaded);
    if (allLoaded) {
      if (this.loadingTimeout) {
        clearTimeout(this.loadingTimeout);
        this.loadingTimeout = null;
      }
      this.beginCountdown();
    }
  }

  private beginCountdown(): void {
    if (this.phase !== 'LOADING') return;
    this.phase = 'COUNTDOWN';
    let sec = PLATFORM_CONFIG.timers.countdownSec;
    this.countdownRemainingSec = sec;
    this.broadcast({ type: 'countdown', sec });
    this.broadcastRoomUpdate();

    this.countdownInterval = setInterval(() => {
      sec -= 1;
      this.countdownRemainingSec = sec;
      if (sec > 0) {
        this.broadcast({ type: 'countdown', sec });
      } else {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
        this.countdownRemainingSec = null;
        this.launchMatch();
      }
    }, 1000);
  }

  private launchMatch(): void {
    try {
      const playersList = Array.from(this.members.values()).map((m) => ({ ...m.player }));
      this.gameRoom = this.game.createServerRoom({
        roomCode: this.code,
        seed: this.matchSeed,
        players: playersList,
        settings: { ...this.gameSettings },
        mode: 'online',
        emitEvent: (ev) => {
          this.broadcast({ type: 'event', t: Date.now(), payload: ev });
        },
      });

      this.phase = 'PLAYING';
      this.matchStartedAt = Date.now();
      const styles: Record<string, string> = {};
      for (const m of this.members.values()) styles[m.player.id] = m.player.controlStyle;

      this.broadcast({
        type: 'matchStart',
        mapId: String(this.gameSettings.map ?? 'auto'),
        seed: this.matchSeed,
        settings: { ...this.gameSettings },
        styles,
        phase: 'PLAYING',
        serverTime: Date.now(),
      });
      this.broadcastRoomUpdate();
      this.onRoomsChanged();

      const tickHz = Math.max(1, this.game.tickRate || 30);
      const tickMs = Math.round(1000 / tickHz);
      const dt = 1 / tickHz;

      this.tickInterval = setInterval(() => {
        try {
          if (!this.gameRoom) return;
          this.gameRoom.tick(dt);
          const evs = this.gameRoom.getEvents();
          for (const ev of evs) {
            this.broadcast({ type: 'event', t: Date.now(), payload: ev });
          }
          const result = this.gameRoom.isFinished();
          if (result) {
            this.finishMatch(result);
          }
        } catch (err) {
          console.error(`[Room ${this.code}] tick crash:`, err);
          this.stopMatchLoops();
          this.phase = 'LOBBY';
          this.broadcast({ type: 'toast', level: 'error', text: 'Match error recovered. Returned to lobby.' });
          this.broadcastRoomUpdate();
        }
      }, tickMs);

      const snapMs = Math.round(1000 / PLATFORM_CONFIG.timers.snapshotRateHz);
      this.snapInterval = setInterval(() => {
        try {
          if (!this.gameRoom) return;
          const snap = this.gameRoom.getSnapshot();
          this.broadcast({ type: 'snapshot', t: Date.now(), serverTime: Date.now(), payload: snap });
        } catch (err) {
          console.error(`[Room ${this.code}] snapshot error:`, err);
        }
      }, snapMs);
    } catch (err) {
      console.error(`[Room ${this.code}] launchMatch failed:`, err);
      this.phase = 'LOBBY';
      this.restoreWatchers();
      this.broadcast({ type: 'toast', level: 'error', text: 'Could not start match.' });
      this.broadcastRoomUpdate();
    }
  }

  private finishMatch(result: MatchResult): void {
    this.stopMatchLoops();
    this.phase = 'RESULTS';
    this.lastResult = result;
    for (const m of this.members.values()) {
      m.player.rematchVoted = false;
    }
    this.broadcast({ type: 'matchEnd', result });
    this.broadcastRoomUpdate();
    this.onRoomsChanged();
  }

  public handleInput(senderId: string, payload: unknown): void {
    if (this.phase !== 'PLAYING' || !this.gameRoom) return;
    const mem = this.members.get(senderId);
    if (!mem || mem.player.isSpectator) return;
    try {
      this.gameRoom.onInput(senderId, payload);
    } catch (err) {
      console.error(`[Room ${this.code}] onInput error:`, err);
    }
  }

  public handleRematchVote(senderId: string): void {
    if (this.phase !== 'RESULTS') return;
    const mem = this.members.get(senderId);
    if (!mem) return;
    mem.player.rematchVoted = !mem.player.rematchVoted;
    this.broadcastRoomUpdate();

    const humans = this.getHumanPlayers().filter((m) => !m.player.isSpectator);
    if (humans.length > 0 && humans.every((m) => m.player.rematchVoted)) {
      this.returnToLobby();
    }
  }

  public handleBackToLobby(senderId: string): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost || this.phase !== 'RESULTS') return;
    this.returnToLobby();
  }

  private returnToLobby(): void {
    this.stopMatchLoops();
    this.gameRoom = null;
    this.phase = 'LOBBY';
    this.restoreWatchers();
    // Remove match bots so lobby shows real seats cleanly
    for (const [id, m] of this.members.entries()) {
      if (m.player.isBot) this.members.delete(id);
      else {
        m.player.isReady = false;
        m.player.rematchVoted = false;
      }
    }
    this.broadcastRoomUpdate();
    this.onRoomsChanged();
  }

  public closeByHost(senderId: string): void {
    const sender = this.members.get(senderId);
    if (!sender?.player.isHost) return;
    this.destroy('The host closed the room.');
  }

  public destroy(reason: string): void {
    this.stopMatchLoops();
    this.cancelAutoStart();
    if (this.emptyDestroyTimer) clearTimeout(this.emptyDestroyTimer);
    for (const m of this.members.values()) {
      if (m.disconnectedTimer) clearTimeout(m.disconnectedTimer);
      if (m.ws) {
        this.sendTo(m.ws, { type: 'roomClosed', reason });
      }
    }
    this.members.clear();
    this.onDestroyed(this.code);
  }

  private stopMatchLoops(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.snapInterval) clearInterval(this.snapInterval);
    if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.tickInterval = null;
    this.snapInterval = null;
    this.loadingTimeout = null;
    this.countdownInterval = null;
  }

  private populateMatchBots(humanCount: number): void {
    const fillMode = String(this.gameSettings.fillBots ?? 'even');
    const manualBots = Number(this.gameSettings.botCount ?? 0);
    const diff = String(this.gameSettings.botDifficulty ?? 'medium');
    const availableSlots = Math.max(0, this.options.maxPlayers - humanCount);

    let desiredBots = Math.min(availableSlots, manualBots);
    if (fillMode === 'max') {
      desiredBots = availableSlots;
    } else if (fillMode === 'even') {
      if (this.isTeamMode()) {
        const redCount = this.getActivePlayers().filter((m) => m.player.team === 'red').length;
        const blueCount = this.getActivePlayers().filter((m) => m.player.team === 'blue').length;
        const diffTeams = Math.abs(redCount - blueCount);
        desiredBots = Math.max(desiredBots, Math.min(availableSlots, diffTeams));
        if (humanCount + desiredBots < this.game.meta.minPlayers) {
          desiredBots = Math.min(availableSlots, this.game.meta.minPlayers - humanCount);
        }
      } else if (humanCount + desiredBots < this.game.meta.minPlayers) {
        desiredBots = Math.min(availableSlots, this.game.meta.minPlayers - humanCount);
      }
    }

    for (let i = 0; i < desiredBots; i++) {
      const id = `bot_${i + 1}_${crypto.randomBytes(3).toString('hex')}`;
      const chosenDiff = diff === 'mixed' ? (['easy', 'medium', 'hard'] as const)[i % 3] : diff;
      const team = this.pickBalancedTeam();
      const color = PLAYER_COLORS[(humanCount + i) % PLAYER_COLORS.length];
      const botPlayer: RoomPlayer = {
        id,
        nickname: `Bot ${i + 1}`,
        colorId: color.id,
        iconId: 'bot',
        team,
        isHost: false,
        isBot: true,
        botDifficulty: chosenDiff,
        isSpectator: false,
        isReady: true,
        isAway: false,
        isDisconnected: false,
        controlStyle: 'PC_STANDARD',
        device: 'pc',
        pingMs: 0,
        rematchVoted: false,
        joinedAt: Date.now() + i,
      };
      this.members.set(id, { player: botPlayer, token: id, ws: null, loaded: true });
    }
  }

  private restoreWatchers(): void {
    for (const m of this.members.values()) {
      if (m.player.watchingThisMatch) {
        m.player.watchingThisMatch = false;
        m.player.isSpectator = false;
      }
    }
  }

  private findBotToReplace(): ConnectedMember | undefined {
    const bots = Array.from(this.members.values()).filter((m) => m.player.isBot);
    return bots[bots.length - 1];
  }

  private isTeamMode(): boolean {
    const modeDef = this.game.modes.find((m) => m.id === this.gameSettings.mode);
    return modeDef ? modeDef.teamType === 'teams' : true;
  }

  private pickBalancedTeam(): TeamId {
    if (!this.isTeamMode()) return 'ffa';
    const red = this.getActivePlayers().filter((m) => m.player.team === 'red').length;
    const blue = this.getActivePlayers().filter((m) => m.player.team === 'blue').length;
    return red <= blue ? 'red' : 'blue';
  }

  private validateControlStyle(requested?: string): string {
    const allowed = this.gameSettings.controlStylesAllowed;
    if (allowed === 'standard-only') {
      const std = this.game.controlStyles.find((s) => s.styleGroup === 'STANDARD');
      return std?.id ?? this.game.controlStyles[0]?.id ?? 'PC_STANDARD';
    }
    const match = this.game.controlStyles.find((s) => s.id === requested);
    return match ? match.id : this.game.controlStyles[0]?.id ?? 'PC_ARCADE';
  }

  private clearAllReady(): void {
    this.cancelAutoStart();
    for (const m of this.members.values()) {
      if (!m.player.isBot) m.player.isReady = false;
    }
  }

  private checkAutoStart(): void {
    if (this.options.startRule !== 'auto' || this.phase !== 'LOBBY') return;
    const humans = this.getActivePlayers().filter((m) => !m.player.isBot);
    if (humans.length === 0) return;
    const allReady = humans.every((m) => m.player.isReady || m.player.isHost);
    if (allReady && !this.autoStartInterval) {
      let sec = PLATFORM_CONFIG.timers.autoStartSec;
      this.autoStartRemainingSec = sec;
      this.autoStartInterval = setInterval(() => {
        sec -= 1;
        this.autoStartRemainingSec = sec;
        this.broadcastRoomUpdate();
        if (sec <= 0) {
          this.cancelAutoStart();
          const host = this.getHostMember();
          if (host) this.handleStartMatch(host.player.id, true);
        }
      }, 1000);
    }
  }

  public cancelAutoStart(): void {
    if (this.autoStartInterval) {
      clearInterval(this.autoStartInterval);
      this.autoStartInterval = null;
    }
    this.autoStartRemainingSec = null;
  }

  public broadcastRoomUpdate(): void {
    this.broadcast({ type: 'roomUpdate', room: this.getSnapshotState() });
  }

  public broadcast(msg: ServerMessage, excludePlayerId?: string): void {
    const raw = JSON.stringify(msg);
    for (const m of this.members.values()) {
      if (m.player.id === excludePlayerId) continue;
      if (m.ws && m.ws.readyState === 1) {
        m.ws.send(raw);
      }
    }
  }

  public sendTo(ws: WebSocket | null, msg: ServerMessage): void {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }
}
