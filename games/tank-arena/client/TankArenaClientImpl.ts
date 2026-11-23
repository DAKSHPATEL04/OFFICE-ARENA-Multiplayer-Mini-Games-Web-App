import Phaser from 'phaser';
import type { ClientContext, GameClient } from '../../../platform/shared/GameModule.ts';
import { TANK } from '../shared/config.ts';
import { resolveMapId, TANK_MAPS } from '../shared/maps/maps.ts';
import type { CompactSnapshot, SimEvent } from '../shared/sim.ts';
import { tankAudio } from './TankArenaAudio.ts';
import { TankArenaScene, type TouchConfig } from './TankArenaScene.ts';

function loadTouchConfig(): TouchConfig {
  try {
    const raw = localStorage.getItem('oa.settings.controls.touch');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TouchConfig>;
      return {
        stickSize: parsed.stickSize ?? TANK.touch.stickPx,
        fireSize: parsed.fireSize ?? TANK.touch.firePx,
        opacity: parsed.opacity ?? TANK.touch.idleOpacity,
        deadZone: parsed.deadZone ?? TANK.touch.deadZone,
        floating: parsed.floating !== false,
        leftHanded: Boolean(parsed.leftHanded),
        rapidFire: parsed.rapidFire !== false,
        aimAssist: parsed.aimAssist === 'off' ? 'off' : 'light',
        autoFire: Boolean(parsed.autoFire),
        haptics: parsed.haptics !== false,
      };
    }
  } catch {}
  return {
    stickSize: TANK.touch.stickPx,
    fireSize: TANK.touch.firePx,
    opacity: TANK.touch.idleOpacity,
    deadZone: TANK.touch.deadZone,
    floating: true,
    leftHanded: false,
    rapidFire: true,
    aimAssist: 'light',
    autoFire: false,
    haptics: true,
  };
}

export class TankArenaClientImpl implements GameClient {
  private game: Phaser.Game;
  private scene: TankArenaScene;
  private ctx: ClientContext;

  constructor(ctx: ClientContext) {
    this.ctx = ctx;
    const isPractice = Boolean(ctx.settings.__practice);
    const quality = (ctx.settings.quality as 'auto' | 'high' | 'medium' | 'low') ?? 'auto';
    const touchCfg = loadTouchConfig();
    const activeCount = Math.max(2, ctx.players.filter((p) => !p.isSpectator).length);
    const resolvedMapId = resolveMapId(
      String(ctx.mapId && ctx.mapId !== 'auto' ? ctx.mapId : ctx.settings.map ?? 'auto'),
      String(ctx.settings.mode ?? 'flag'),
      activeCount,
    );
    const mapDef = TANK_MAPS[resolvedMapId];
    const canvasW = mapDef.series === 'arena-series' ? TANK.arenaSeries.canvas.w : TANK.stage.w;
    const canvasH = mapDef.series === 'arena-series' ? TANK.arenaSeries.canvas.h : TANK.stage.h;

    this.scene = new TankArenaScene(ctx, touchCfg, quality, isPractice);

    ctx.container.innerHTML = '';
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ctx.container,
      width: canvasW,
      height: canvasH,
      backgroundColor: '#0B1020',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: {
        activePointers: ctx.playMode === 'local-party' ? 4 : 2,
      },
      scene: [this.scene],
    });

    tankAudio.unlock();
    tankAudio.startMusic('game');
  }

  public applySnapshot(snapshot: unknown): void {
    this.scene.applySnapshot(snapshot as CompactSnapshot);
  }

  public applyEvent(event: unknown): void {
    this.scene.applyEvent(event as SimEvent);
  }

  public setPaused(paused: boolean): void {
    this.scene.setPaused(paused);
  }

  public setControlStyle(styleId: string): void {
    this.ctx.controlStyle = styleId;
    this.scene.setControlStyle(styleId);
  }

  public setSpectatorMode(isSpectator: boolean): void {
    this.ctx.isSpectator = isSpectator;
  }

  public triggerFire(): void {
    this.scene.triggerExternalFire();
  }

  public resize(): void {
    this.game.scale.refresh();
  }

  public destroy(): void {
    tankAudio.stopMusic();
    this.game.destroy(true);
  }
}
