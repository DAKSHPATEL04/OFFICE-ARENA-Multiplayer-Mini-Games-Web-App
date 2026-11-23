import type {
  ClientContext,
  GameClient,
  GameModule,
  GameRoom,
  RoomContext,
} from '../../platform/shared/GameModule.ts';
import { PLATFORM_API } from '../../platform/shared/config.ts';
import type { MatchResult, RoomPlayer } from '../../platform/shared/types.ts';

interface TargetState {
  id: number;
  x: number;
  y: number;
  r: number;
  color: string;
}

interface TemplateSnapshot {
  timeLeft: number;
  scores: Record<string, number>;
  target: TargetState;
}

class TemplateServerRoom implements GameRoom {
  private ctx: RoomContext;
  private players: Map<string, RoomPlayer> = new Map();
  private scores: Record<string, number> = {};
  private timeLeft = 30;
  private target: TargetState = { id: 1, x: 400, y: 260, r: 34, color: '#00E5C3' };
  private finished: MatchResult | null = null;
  private events: unknown[] = [];

  constructor(ctx: RoomContext) {
    this.ctx = ctx;
    for (const p of ctx.players) {
      if (!p.isSpectator) {
        this.players.set(p.id, p);
        this.scores[p.id] = 0;
      }
    }
    this.timeLeft = Number(ctx.settings.durationSec ?? 30);
  }

  onPlayerJoin(p: RoomPlayer): void {
    if (p.isSpectator) return;
    this.players.set(p.id, p);
    if (this.scores[p.id] === undefined) this.scores[p.id] = 0;
  }

  onPlayerLeave(playerId: string): void {
    this.players.delete(playerId);
  }

  onReconnect(): void {}

  onInput(playerId: string, payload: unknown): void {
    if (this.finished) return;
    const p = payload as { hitTargetId?: number };
    if (p && p.hitTargetId === this.target.id) {
      this.scores[playerId] = (this.scores[playerId] ?? 0) + 1;
      const colors = ['#00E5C3', '#7C5CFF', '#FFC83D', '#FF4D6D'];
      const nextId = this.target.id + 1;
      this.target = {
        id: nextId,
        x: 120 + ((nextId * 197) % 660),
        y: 100 + ((nextId * 131) % 320),
        r: 34,
        color: colors[nextId % colors.length],
      };
      this.events.push({ type: 'hit', by: playerId, nextTarget: this.target });
      if (this.scores[playerId] >= Number(this.ctx.settings.targetScore ?? 10)) {
        this.finish();
      }
    }
  }

  tick(dt: number): void {
    if (this.finished) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.finish();
    }
  }

  private finish(): void {
    const stats = Array.from(this.players.values()).map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      colorId: p.colorId,
      team: p.team,
      isBot: p.isBot,
      points: this.scores[p.id] ?? 0,
      deaths: 0,
      shotsFired: this.scores[p.id] ?? 0,
      hits: this.scores[p.id] ?? 0,
      accuracy: 100,
      flagsPicked: 0,
      captures: 0,
      returns: 0,
      powersCollected: 0,
      pingMs: p.pingMs,
      mvpScore: this.scores[p.id] ?? 0,
    }));
    stats.sort((a, b) => b.points - a.points);
    const top = stats[0];
    this.finished = {
      winnerTeam: 'ffa',
      winnerLabel: top ? `${top.nickname} Wins!` : 'Match Complete',
      durationSec: Math.round(Number(this.ctx.settings.durationSec ?? 30) - this.timeLeft),
      teamScores: { red: 0, blue: 0 },
      stats,
      awards: top
        ? [{ id: 'mvp', title: 'Fastest Click', playerId: top.playerId, nickname: top.nickname, detail: `${top.points} hits` }]
        : [],
    };
  }

  getSnapshot(): unknown {
    return {
      timeLeft: Math.round(this.timeLeft * 10) / 10,
      scores: { ...this.scores },
      target: this.target,
    };
  }

  getEvents(): unknown[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  isFinished(): MatchResult | null {
    return this.finished;
  }
}

class TemplateClientScene implements GameClient {
  private ctx: ClientContext;
  private canvas: HTMLCanvasElement;
  private c2d: CanvasRenderingContext2D;
  private snap: TemplateSnapshot = {
    timeLeft: 30,
    scores: {},
    target: { id: 1, x: 400, y: 260, r: 34, color: '#00E5C3' },
  };
  private localRoom: TemplateServerRoom | null = null;
  private timerId: number | null = null;
  private paused = false;

  constructor(ctx: ClientContext) {
    this.ctx = ctx;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 900;
    this.canvas.height = 520;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.objectFit = 'contain';
    this.canvas.style.cursor = 'crosshair';
    ctx.container.innerHTML = '';
    ctx.container.appendChild(this.canvas);
    this.c2d = this.canvas.getContext('2d')!;

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);

    if (ctx.playMode !== 'online') {
      this.localRoom = new TemplateServerRoom({
        roomCode: 'SOLO',
        seed: ctx.seed,
        players: ctx.players,
        settings: ctx.settings,
        mode: ctx.playMode,
        emitEvent: () => {},
      });
      this.timerId = window.setInterval(() => {
        if (this.paused || !this.localRoom) return;
        this.localRoom.tick(1 / 20);
        this.snap = this.localRoom.getSnapshot() as TemplateSnapshot;
        this.draw();
        const res = this.localRoom.isFinished();
        if (res && ctx.onLocalMatchEnd) {
          ctx.onLocalMatchEnd(res);
          if (this.timerId !== null) clearInterval(this.timerId);
        }
      }, 50);
    }

    this.draw();
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (this.paused || this.ctx.isSpectator) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const t = this.snap.target;
    if (Math.hypot(px - t.x, py - t.y) <= t.r + 12) {
      const payload = { hitTargetId: t.id };
      if (this.localRoom) {
        this.localRoom.onInput(this.ctx.localPlayerId, payload);
        this.snap = this.localRoom.getSnapshot() as TemplateSnapshot;
        this.draw();
      } else {
        this.ctx.onSendInput(payload);
      }
    }
  };

  private draw(): void {
    const g = this.c2d;
    g.fillStyle = '#0F162C';
    g.fillRect(0, 0, 900, 520);

    // Blueprint grid
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    for (let x = 0; x <= 900; x += 45) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 520);
      g.stroke();
    }
    for (let y = 0; y <= 520; y += 45) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(900, y);
      g.stroke();
    }

    const t = this.snap.target;
    g.beginPath();
    g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    g.fillStyle = t.color;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#FFFFFF';
    g.stroke();

    g.beginPath();
    g.arc(t.x, t.y, t.r * 0.45, 0, Math.PI * 2);
    g.fillStyle = '#0B1020';
    g.fill();

    // HUD
    g.fillStyle = '#F4F6FF';
    g.font = '700 22px Fredoka, sans-serif';
    const myScore = this.snap.scores[this.ctx.localPlayerId] ?? 0;
    g.fillText(`Score: ${myScore}`, 28, 42);
    g.fillText(`Time: ${this.snap.timeLeft.toFixed(1)}s`, 740, 42);
  }

  applySnapshot(snapshot: unknown): void {
    this.snap = snapshot as TemplateSnapshot;
    this.draw();
  }
  applyEvent(): void {}
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  setControlStyle(): void {}
  setSpectatorMode(): void {}
  resize(): void {}
  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    if (this.timerId !== null) clearInterval(this.timerId);
  }
}

export const templateGameModule: GameModule = {
  id: 'target-sprint',
  requires: PLATFORM_API,
  isTemplate: true,
  isNew: true,
  meta: {
    name: 'Target Sprint',
    tagline: 'Fast-paced target reflex sprint for 1 to 12 players',
    description: 'Click or tap glowing targets faster than your friends in quick 30-second reflex rounds.',
    icon: '/src/assets/images/template_game_banner_1795319703750.jpg',
    banner: '/src/assets/images/template_game_banner_1795319703750.jpg',
    tags: ['quick', 'party', 'action'],
    minPlayers: 1,
    maxPlayers: 12,
    defaultMaxPlayers: 6,
    maxSpectators: 20,
    maxLocalPlayers: 1,
    avgMinutes: 1,
    supports: { online: true, localParty: false, solo: true },
    devices: { keyboardMouse: true, touch: true, gamepad: false },
  },
  modes: [
    {
      id: 'sprint',
      name: 'Target Sprint',
      planText: 'Tap or click the glowing target faster than everyone else!',
      tip: 'First player to reach the target score wins.',
      teamType: 'ffa',
      minPlayers: 1,
      maxPlayers: 12,
    },
  ],
  settingsSchema: [
    {
      key: 'durationSec',
      label: 'Round Time (sec)',
      group: 'match',
      type: 'number',
      defaultValue: 30,
      min: 15,
      max: 120,
      step: 5,
      unit: 's',
    },
    {
      key: 'targetScore',
      label: 'Target Hits to Win',
      group: 'match',
      type: 'number',
      defaultValue: 10,
      min: 5,
      max: 30,
      step: 1,
    },
  ],
  controlStyles: [
    {
      id: 'POINTER_TAP',
      name: 'Point & Tap',
      shortLabel: 'Tap',
      devices: ['pc', 'touch'],
      styleGroup: 'STEER',
      summaryLines: ['Click or tap directly on the target ring'],
      recommended: true,
      demoType: 'steer',
    },
  ],
  controls: {
    pc: [{ input: 'Left Click', action: 'Hit Target' }],
    touch: [{ input: 'Tap Target', action: 'Hit Target' }],
    pad: [],
  },
  howTo: {
    goal: 'Tap targets as fast as they appear to outscore your coworkers.',
    inviteSteps: ['Create a room, share the 4-letter code, and race!'],
    steps: [{ title: 'Spot & Click', body: 'Click each glowing ring before anyone else.' }],
    tips: ['Works identically online and solo through the GameModule interface.'],
  },
  results: {
    columns: [
      { key: 'points', label: 'Hits', align: 'right' },
      { key: 'accuracy', label: 'Accuracy', align: 'right' },
    ],
  },
  assets: [],
  tickRate: 20,
  createServerRoom(ctx: RoomContext): GameRoom {
    return new TemplateServerRoom(ctx);
  },
  createClientScene(ctx: ClientContext): GameClient {
    return new TemplateClientScene(ctx);
  },
};

export default templateGameModule;
