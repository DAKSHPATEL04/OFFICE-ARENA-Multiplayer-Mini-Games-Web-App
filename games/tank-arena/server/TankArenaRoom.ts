import type { GameRoom, RoomContext } from '../../../platform/shared/GameModule.ts';
import type { MatchResult, RoomPlayer } from '../../../platform/shared/types.ts';
import { TankBotBrain } from '../shared/bots/botBrain.ts';
import { TANK } from '../shared/config.ts';
import { TankArenaSim } from '../shared/sim.ts';

export class TankArenaRoom implements GameRoom {
  private readonly sim: TankArenaSim;
  private readonly bots: Map<string, TankBotBrain> = new Map();
  private readonly ctx: RoomContext;
  private botRoundRobin = 0;

  constructor(ctx: RoomContext) {
    this.ctx = ctx;
    this.sim = new TankArenaSim(ctx.players, ctx.settings, ctx.seed, ctx.mode === 'local-party');

    for (const p of ctx.players) {
      if (p.isBot && !p.isSpectator) {
        this.bots.set(p.id, new TankBotBrain(p.botDifficulty ?? 'medium'));
      }
    }
  }

  public onPlayerJoin(player: RoomPlayer): void {
    if (player.isSpectator) return;
    if (!this.sim.tanks.has(player.id)) {
      this.sim.addTank(player, undefined, false);
      if (player.isBot) {
        this.bots.set(player.id, new TankBotBrain(player.botDifficulty ?? 'medium'));
      }
    }
  }

  public onPlayerLeave(playerId: string): void {
    this.bots.delete(playerId);
    this.sim.removeTank(playerId, true);
  }

  public onReconnect(playerId: string): void {
    this.sim.setDisconnected(playerId, false);
  }

  public onDisconnect(playerId: string): void {
    this.sim.setDisconnected(playerId, true);
  }

  public onLateJoin(player: RoomPlayer): boolean {
    if (!this.sim.canLateJoin()) return false;
    if (this.sim.tanks.has(player.id)) return true;
    this.sim.addTank(player, undefined, true);
    return true;
  }

  public canLateJoin(): boolean {
    return this.sim.canLateJoin();
  }

  public onInput(playerId: string, payload: unknown): void {
    this.sim.applyInput(playerId, payload);
  }

  public setControlStyle(playerId: string, styleId: string): void {
    this.sim.setControlStyle(playerId, styleId);
  }

  public tick(dt: number): void {
    // Think for bots within budget (up to 2ms/tick)
    const botIds = Array.from(this.bots.keys());
    const startMs = performance.now();
    for (let i = 0; i < botIds.length; i++) {
      const idx = (this.botRoundRobin + i) % botIds.length;
      const botId = botIds[idx];
      const brain = this.bots.get(botId);
      if (brain) {
        const input = brain.think(this.sim, botId, dt);
        this.sim.applyInput(botId, input);
      }
      if (performance.now() - startMs > 2.0 && i >= 2) {
        this.botRoundRobin = (idx + 1) % botIds.length;
        break;
      }
    }

    this.sim.tick(dt);

    // Emit any events (like AFK -> spectator) back to RoomContext if needed
    const events = this.sim.drainEvents();
    for (const ev of events) {
      if (ev.type === 'afkSpectator' && this.ctx.onPlayerRemoved) {
        // Handled by server room if configured
      }
      this.ctx.emitEvent(ev);
    }
  }

  public getSnapshot(): unknown {
    return this.sim.getCompactSnapshot();
  }

  public getEvents(): unknown[] {
    return this.sim.drainEvents();
  }

  public isFinished(): MatchResult | null {
    return this.sim.finishedResult;
  }

  public getTickRate(): number {
    return TANK.tickRate;
  }
}
