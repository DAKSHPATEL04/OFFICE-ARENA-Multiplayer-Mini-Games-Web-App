import Phaser from 'phaser';
import { SettingsStore, type PcControlBindings } from '../../../platform/client/core/SettingsStore.ts';
import { PLAYER_COLORS } from '../../../platform/shared/config.ts';
import type { ClientContext } from '../../../platform/shared/GameModule.ts';
import type { TeamId } from '../../../platform/shared/types.ts';
import { TANK, type TankInputObj } from '../shared/config.ts';
import { TankBotBrain } from '../shared/bots/botBrain.ts';
import { getBrickRect, resolveMapId, TANK_MAPS } from '../shared/maps/maps.ts';
import type { MapData } from '../shared/maps/types.ts';
import {
  codeToPower,
  resolveControlGroup,
  TankArenaSim,
  type CompactSnapshot,
  type PowerType,
  type SimEvent,
} from '../shared/sim.ts';
import { tankAudio } from './TankArenaAudio.ts';

interface VisualTank {
  idx: number;
  id: string;
  nickname: string;
  colorHex: number;
  colorCss: string;
  shape: string;
  team: TeamId;
  container: Phaser.GameObjects.Container;
  hull: Phaser.GameObjects.Graphics;
  turret: Phaser.GameObjects.Graphics;
  shieldRing: Phaser.GameObjects.Graphics;
  powerRing: Phaser.GameObjects.Graphics;
  ownRing: Phaser.GameObjects.Graphics;
  nameTag: Phaser.GameObjects.Text;
  youLabel: Phaser.GameObjects.Text;
  hpBarGfx: Phaser.GameObjects.Graphics;
  carryFlag: Phaser.GameObjects.Graphics;
  targetX: number;
  targetY: number;
  targetAngle: number;
  alive: boolean;
  hp: number;
  ammo: number;
  power: PowerType | null;
  flagsMask: number;
  respawnTenths: number;
  recoilOffset: number;
  trackPhase: number;
  wasAlive: boolean;
  dustAccum: number;
}

interface VisualShell {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  radius: number;
  isFireball: boolean;
  gfx: Phaser.GameObjects.Container;
  trail: Phaser.GameObjects.Graphics;
  colorHex: number;
}

interface PowerBoxVisual {
  cont: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  lastCode: number;
}

interface ParticleItem {
  gfx: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface HudSnapshot {
  mode: string;
  timeLeftSec: number;
  suddenDeath: boolean;
  scores: { red: number; blue: number };
  myPoints: number;
  leaderPoints: number;
  ammo: number;
  ammoMax: number;
  ammoReloadPct: number;
  activePower: PowerType | null;
  respawnSec: number;
  flags: {
    red: { state: 'home' | 'carried' | 'dropped'; carrierName?: string };
    blue: { state: 'home' | 'carried' | 'dropped'; carrierName?: string };
  } | null;
  killFeed: Array<{ id: number; killer: string; victim: string; killerColor: string; victimColor: string; ts: number }>;
  scoreboard: Array<{
    id: string;
    nickname: string;
    colorId: string;
    team: TeamId;
    points: number;
    deaths: number;
    pingMs: number;
    isSelf: boolean;
  }>;
  bannerText: string | null;
  fps: number;
  debugInfo?: string;
}

export interface TouchConfig {
  stickSize: number;
  fireSize: number;
  opacity: number;
  deadZone: number;
  floating: boolean;
  leftHanded: boolean;
  rapidFire: boolean;
  aimAssist: 'off' | 'light';
  autoFire: boolean;
  haptics: boolean;
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0xffffff;
}

export class TankArenaScene extends Phaser.Scene {
  private ctx: ClientContext;
  private isPractice: boolean;
  private localSim: TankArenaSim | null = null;
  private localBots: Map<string, TankBotBrain> = new Map();
  private simAccum = 0;
  private mapData: MapData;
  private stageW: number;
  private stageH: number;
  private worldScaleFactor: number;
  private camZoom = 1;
  private pcBindings: PcControlBindings;
  private bgLoadFailed = false;

  private visualTanks: Map<number, VisualTank> = new Map();
  private visualShells: VisualShell[] = [];
  private brickSprites: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private crateSprites: Map<number, Phaser.GameObjects.Container> = new Map();
  private powerBoxSprites: Map<number, PowerBoxVisual> = new Map();
  private barrelSprites: Map<number, Phaser.GameObjects.Container> = new Map();
  private ventGfx?: Phaser.GameObjects.Graphics;
  private ventStates: Array<[number, number]> = [];
  private dropSprites: Map<number, Phaser.GameObjects.Container> = new Map();
  private flagSprites: { red?: Phaser.GameObjects.Container; blue?: Phaser.GameObjects.Container } = {};
  private particles: ParticleItem[] = [];

  private playerIdToIdx: Map<string, number> = new Map();
  private idxToPlayerId: Map<number, string> = new Map();

  // Input state
  private keysDown: Set<string> = new Set();
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private mouseStageX: number;
  private mouseStageY: number;
  private lastMouseMoveTs = 0;
  private aimRingGfx?: Phaser.GameObjects.Graphics;

  private fireSeq = 0;
  private inputSeq = 0;
  private inputSendAccum = 0;
  private rapidFireAccum = 0;
  private oneBtnDownAt: number[] = [0, 0, 0, 0];
  private oneBtnIsHolding: boolean[] = [false, false, false, false];
  private localFireSeqs: number[] = [0, 0, 0, 0];

  // Touch virtual controls
  private touchConfig: TouchConfig;
  private stickPointerId: number | null = null;
  private stickOriginX = 240;
  private stickOriginY = 620;
  private stickCurX = 240;
  private stickCurY = 620;
  private stickVector = { x: 0, y: 0, strength: 0 };
  private firePointerId: number | null = null;
  private touchGfx?: Phaser.GameObjects.Graphics;
  private localCornerStates: boolean[] = [false, false, false, false];
  private localCornerGfx: Phaser.GameObjects.Container[] = [];
  private localPartyHudTexts: Phaser.GameObjects.Text[] = [];

  // Quality, Minimap & FX
  private quality: 'high' | 'medium' | 'low' = 'high';
  private particleBudget = 300;
  private paused = false;
  private bannerText: string | null = null;
  private bannerTimer = 0;
  private killFeed: HudSnapshot['killFeed'] = [];
  private killFeedSeq = 1;
  private hudEmitAccum = 0;
  private latestSnap: CompactSnapshot | null = null;
  private minimapGfx?: Phaser.GameObjects.Graphics;

  // Debug (?debug=1 + F3)
  private isDebug = false;
  private debugOverlayVisible = false;
  private debugOverlayGfx?: Phaser.GameObjects.Graphics;
  private debugText?: Phaser.GameObjects.Text;
  private lastFps = 60;
  private lowFpsTimer = 0;

  constructor(ctx: ClientContext, touchCfg: TouchConfig, quality: 'auto' | 'high' | 'medium' | 'low', isPractice = false) {
    super('TankArenaScene');
    this.ctx = ctx;
    this.touchConfig = touchCfg;
    this.isPractice = isPractice;
    this.pcBindings = SettingsStore.getPcBindings();

    const activeCount = Math.max(2, ctx.players.filter((p) => !p.isSpectator).length);
    const resolvedId = resolveMapId(
      String(ctx.mapId && ctx.mapId !== 'auto' ? ctx.mapId : ctx.settings.map ?? 'auto'),
      String(ctx.settings.mode ?? 'flag'),
      activeCount,
    );
    this.mapData = TANK_MAPS[resolvedId];
    const stage = this.mapData.stage ?? TANK.stage;
    this.stageW = stage.w;
    this.stageH = stage.h;
    this.worldScaleFactor = this.mapData.tankScale ?? 1;
    this.camZoom = this.mapData.series === 'arena-series' ? 0.5 : 1;
    this.mouseStageX = this.stageW / 2;
    this.mouseStageY = this.stageH / 2;

    if (quality === 'low') {
      this.quality = 'low';
      this.particleBudget = 60;
    } else if (quality === 'medium') {
      this.quality = 'medium';
      this.particleBudget = 150;
    } else {
      this.quality = 'high';
      this.particleBudget = 300;
    }
    if (ctx.players.length >= 9 && this.quality === 'high') {
      this.quality = 'medium';
      this.particleBudget = 150;
    }
    if (typeof window !== 'undefined' && window.location.search.includes('debug=1')) {
      this.isDebug = true;
    }
  }

  public preload(): void {
    if (this.mapData.backgroundImage) {
      const texKey = `arena-bg-${this.mapData.id}`;
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: { key: string }) => {
        if (file.key === texKey) {
          console.warn(`[TankArena] Map background failed to load (${this.mapData.backgroundImage}); using code-drawn theme.`);
          this.bgLoadFailed = true;
        }
      });
      this.load.image(texKey, this.mapData.backgroundImage);
    }
  }

  public create(): void {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Configure camera for 3440x1920 Arena Series (1720x960 canvas at 0.5 zoom) vs 1792x828 Classic
    this.cameras.main.setBounds(0, 0, this.stageW, this.stageH);
    this.cameras.main.setZoom(this.camZoom);
    this.cameras.main.centerOn(this.stageW / 2, this.stageH / 2);

    // Boot offline sim if Solo, Local Party, or Practice Range
    if (this.ctx.playMode !== 'online' || this.isPractice) {
      this.localSim = new TankArenaSim(
        this.ctx.players,
        this.ctx.settings,
        this.ctx.seed,
        this.ctx.playMode === 'local-party',
      );
      for (const p of this.ctx.players) {
        if (p.isBot && !p.isSpectator) {
          this.localBots.set(p.id, new TankBotBrain(p.botDifficulty ?? 'medium'));
        }
      }
      if (this.isPractice) {
        this.localSim.timeLeftSec = 9999;
      }
    }

    const activePlayers = this.ctx.players.filter((p) => !p.isSpectator);
    activePlayers.forEach((p, idx) => {
      this.playerIdToIdx.set(p.id, idx);
      this.idxToPlayerId.set(idx, p.id);
    });

    this.drawArenaWorld();
    this.initParticlePool();
    this.createVisualTanks(activePlayers);
    this.setupInputs();

    if (this.ctx.playMode === 'local-party') {
      this.createLocalPartyHud();
    }

    this.aimRingGfx = this.add.graphics().setDepth(50);
    this.touchGfx = this.add.graphics().setDepth(90);

    if (this.ctx.playMode !== 'local-party' && !this.isPractice) {
      this.minimapGfx = this.add.graphics().setDepth(85);
    }

    if (this.isDebug) {
      this.debugOverlayGfx = this.add.graphics().setDepth(115).setVisible(false);
      this.drawDebugOverlay();
      this.debugText = this.add
        .text(24 / this.camZoom, 80 / this.camZoom, '', {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: `${Math.round(13 / this.camZoom)}px`,
          color: '#00E5C3',
          backgroundColor: 'rgba(11,16,32,0.85)',
          padding: { x: 8, y: 4 },
        })
        .setDepth(120);
    }

    // Release map texture on shutdown to free GPU memory cleanly
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const texKey = `arena-bg-${this.mapData.id}`;
      if (this.textures.exists(texKey)) {
        this.textures.remove(texKey);
      }
    });

    this.showBanner('START!', 1.2);
    tankAudio.playCountdown(true);

    if (this.localSim) {
      this.applySnapshot(this.localSim.getCompactSnapshot());
    }
  }

  private drawArenaWorld(): void {
    const mapData = this.localSim ? this.localSim.map : this.mapData;
    const isNight = this.ctx.settings.mapLook === 'night';
    const texKey = `arena-bg-${mapData.id}`;
    const hasArtBg = Boolean(!this.bgLoadFailed && mapData.backgroundImage && this.textures.exists(texKey));
    const s = mapData.series === 'arena-series' ? TANK.arenaSeries.worldScale : 1;

    const floorColors: Record<string, number> = {
      steel: isNight ? 0x2c3640 : 0xa9bfc0,
      sand: isNight ? 0x5c472c : 0xcfa56c,
      grass: isNight ? 0x1b4528 : 0x4b8d3c,
      river: isNight ? 0x22383d : 0x7fa3a8,
      lava: isNight ? 0x1e110f : 0x2f1d1a,
      frost: isNight ? 0x26445c : 0xa8d3ed,
      swamp: isNight ? 0x1a2c24 : 0x2e4a3d,
    };

    if (hasArtBg) {
      const tex = this.textures.get(texKey);
      const srcImg = tex.getSourceImage() as { width?: number; height?: number };
      const imgW = srcImg.width || this.stageW;
      const imgH = srcImg.height || this.stageH;
      const aspect = imgW / Math.max(1, imgH);
      const targetAspect = 16 / 9;
      if (Math.abs(aspect - targetAspect) > 0.05) {
        console.warn(`[TankArena] Map background aspect (${aspect.toFixed(2)}) differs from 16:9; preserving aspect with letterboxing.`);
      }
      const scaleFit = Math.min(this.stageW / imgW, this.stageH / imgH);
      this.add.image(this.stageW / 2, this.stageH / 2, texKey).setDisplaySize(imgW * scaleFit, imgH * scaleFit).setDepth(0);
    }

    const gFloor = this.add.graphics().setDepth(1);
    if (!hasArtBg) {
      gFloor.fillStyle(floorColors[mapData.theme] ?? 0xa9bfc0, 1);
      gFloor.fillRect(0, 0, this.stageW, this.stageH);

      // Subtle tile / stone grid lines
      const gridStep = Math.round(64 * s);
      gFloor.lineStyle(1.5 * s, isNight ? 0xffffff : 0x000000, 0.06);
      for (let x = 0; x <= this.stageW; x += gridStep) {
        gFloor.lineBetween(x, 0, x, this.stageH);
      }
      for (let y = 0; y <= this.stageH; y += gridStep) {
        gFloor.lineBetween(0, y, this.stageW, y);
      }

      // Arena Series theme terrain details
      this.drawArenaSeriesTerrain(gFloor, mapData, isNight, s);

      // Craters (decoration)
      for (const c of mapData.craters) {
        gFloor.fillStyle(0x2a2622, 0.45);
        gFloor.fillCircle(c.x, c.y, 26 * s);
      }

      // Respawn bay X-markers (Classic maps only)
      if (mapData.series !== 'arena-series' && mapData.respawnBays) {
        for (const bay of mapData.respawnBays) {
          gFloor.lineStyle(3, 0xffc83d, 0.35);
          gFloor.strokeCircle(bay.x, bay.y, 30);
          gFloor.lineBetween(bay.x - 16, bay.y - 16, bay.x + 16, bay.y + 16);
          gFloor.lineBetween(bay.x + 16, bay.y - 16, bay.x - 16, bay.y + 16);
        }
      }
    } else if (isNight) {
      gFloor.fillStyle(0x060916, 0.4);
      gFloor.fillRect(0, 0, this.stageW, this.stageH);
    }

    // Lava vent animated graphics layer
    if (mapData.eruptionVents && mapData.eruptionVents.length > 0) {
      this.ventGfx = this.add.graphics().setDepth(4);
      this.ventStates = mapData.eruptionVents.map(() => [0, 0]);
      this.drawVentsOverlay();
    }

    // Flag Pads + Capture Radius Ring
    if (this.ctx.settings.mode === 'flag' && mapData.flags) {
      const capR = mapData.captureRadius ?? 38;
      const drawPad = (x: number, y: number, color: number) => {
        gFloor.fillStyle(color, hasArtBg ? 0.28 : 0.2);
        gFloor.fillCircle(x, y, capR);
        gFloor.lineStyle(4 * s, color, 0.92);
        gFloor.strokeCircle(x, y, capR);
        gFloor.lineStyle(2 * s, 0xffffff, 0.4);
        gFloor.strokeCircle(x, y, capR * 0.55);
      };
      drawPad(mapData.flags.red.pad.x, mapData.flags.red.pad.y, 0xf23a12);
      drawPad(mapData.flags.blue.pad.x, mapData.flags.blue.pad.y, 0x3f6fe0);
    }

    // Walls & Ruins with lower-right cast shadows
    const gWalls = this.add.graphics().setDepth(10);
    const wallPalette: Record<string, { fill: number; top: number; rim: number }> = {
      lava: { fill: 0x3d2c28, top: 0x523c37, rim: 0xff6a2b },
      sand: { fill: 0x735235, top: 0x916a46, rim: 0xe8a24a },
      frost: { fill: 0x456078, top: 0x6788a6, rim: 0x8fd3ff },
      grass: { fill: 0x4e5948, top: 0x67755f, rim: 0x6cc04a },
      swamp: { fill: 0x39483e, top: 0x4c6153, rim: 0x5ad68d },
      steel: { fill: 0x363b47, top: 0x474e5e, rim: 0xb8d4d6 },
      river: { fill: 0x363b47, top: 0x474e5e, rim: 0xb8d4d6 },
    };
    const wp = wallPalette[mapData.theme] ?? wallPalette.steel;

    if (!hasArtBg) {
      // Cast shadows toward lower-right
      for (const w of mapData.pitWalls) {
        gWalls.fillStyle(0x000000, 0.34);
        gWalls.fillRect(w.x + 8 * s, w.y + 8 * s, w.w, w.h);
      }
      for (const w of mapData.pitWalls) {
        gWalls.fillStyle(wp.fill, 1);
        gWalls.fillRect(w.x, w.y, w.w, w.h);
        gWalls.fillStyle(wp.top, 0.75);
        gWalls.fillRect(w.x + 3 * s, w.y + 3 * s, Math.max(2, w.w - 6 * s), Math.max(2, w.h - 6 * s));
        gWalls.lineStyle(2.5 * s, wp.rim, 0.9);
        gWalls.strokeRect(w.x + 1.5, w.y + 1.5, Math.max(1, w.w - 3), Math.max(1, w.h - 3));
      }

      // Sealed iron gate door bars on top/bottom/left/right gates
      for (const gate of mapData.decorDetails?.sealedGates ?? []) {
        gWalls.fillStyle(0x1f252e, 0.9);
        gWalls.fillRect(gate.x + 4 * s, gate.y + 4 * s, gate.w - 8 * s, gate.h - 8 * s);
        gWalls.lineStyle(2 * s, 0x94a3b8, 0.75);
        const bars = 4;
        for (let b = 1; b <= bars; b++) {
          if (gate.w > gate.h) {
            const bx = gate.x + (gate.w * b) / (bars + 1);
            gWalls.lineBetween(bx, gate.y + 4 * s, bx, gate.y + gate.h - 4 * s);
          } else {
            const by = gate.y + (gate.h * b) / (bars + 1);
            gWalls.lineBetween(gate.x + 4 * s, by, gate.x + gate.w - 4 * s, by);
          }
        }
      }

      // Solid Stepped Center Pyramid (desert & snow)
      for (const sc of mapData.solidCircles ?? []) {
        gWalls.fillStyle(0x000000, 0.38);
        gWalls.fillCircle(sc.x + 10 * s, sc.y + 10 * s, sc.r);
        gWalls.fillStyle(wp.fill, 1);
        gWalls.fillCircle(sc.x, sc.y, sc.r);
        gWalls.lineStyle(4 * s, wp.rim, 0.95);
        gWalls.strokeCircle(sc.x, sc.y, sc.r);
        // Stepped pyramid tiers
        const tier1 = sc.r * 1.24;
        const tier2 = sc.r * 0.82;
        const tier3 = sc.r * 0.42;
        gWalls.fillStyle(wp.top, 1);
        gWalls.fillRoundedRect(sc.x - tier1 / 2, sc.y - tier1 / 2, tier1, tier1, 6 * s);
        gWalls.lineStyle(2.5 * s, wp.rim, 0.8);
        gWalls.strokeRoundedRect(sc.x - tier1 / 2, sc.y - tier1 / 2, tier1, tier1, 6 * s);

        gWalls.fillStyle(mapData.theme === 'frost' ? 0x9ad8ff : 0xc48b4f, 0.9);
        gWalls.fillRoundedRect(sc.x - tier2 / 2, sc.y - tier2 / 2, tier2, tier2, 4 * s);
        gWalls.fillStyle(wp.rim, 1);
        gWalls.fillRoundedRect(sc.x - tier3 / 2, sc.y - tier3 / 2, tier3, tier3, 3 * s);
      }
    } else {
      for (const w of mapData.pitWalls) {
        gWalls.fillStyle(0x0b1020, 0.14);
        gWalls.fillRect(w.x, w.y, w.w, w.h);
        gWalls.lineStyle(2, 0xffffff, 0.16);
        gWalls.strokeRect(w.x + 1, w.y + 1, Math.max(1, w.w - 2), Math.max(1, w.h - 2));
      }
    }

    // Striped steel barriers (Classic)
    for (const st of mapData.steelBarriers) {
      gWalls.fillStyle(0x8ea3a8, 1);
      gWalls.fillRect(st.x, st.y, st.w, st.h);
      gWalls.lineStyle(4, 0xf2c400, 1);
      gWalls.strokeRect(st.x + 2, st.y + 2, st.w - 4, st.h - 4);
      gWalls.lineStyle(6, 0x1f242d, 0.85);
      for (let offset = -st.h; offset < st.w + st.h; offset += 24) {
        const x1 = Phaser.Math.Clamp(st.x + offset, st.x + 4, st.x + st.w - 4);
        const y1 = Phaser.Math.Clamp(st.y + (offset < 0 ? -offset : 4), st.y + 4, st.y + st.h - 4);
        const x2 = Phaser.Math.Clamp(st.x + offset + 12, st.x + 4, st.x + st.w - 4);
        const y2 = Phaser.Math.Clamp(st.y + Math.min(st.h - 4, offset + 12), st.y + 4, st.y + st.h - 4);
        if (x1 !== x2 && y1 !== y2) gWalls.lineBetween(x1, y1, x2, y2);
      }
    }

    // Bricks
    mapData.bricks.forEach((b, idx) => {
      const r = getBrickRect(b);
      const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0xc98a4b).setDepth(12);
      rect.setStrokeStyle(2.5, 0x6f3e14);
      this.brickSprites.set(idx, rect);
    });

    // Crates
    const crateSize = 44 * this.worldScaleFactor;
    mapData.crates.forEach((c, idx) => {
      const cont = this.add.container(c.x, c.y).setDepth(12);
      const box = this.add.rectangle(0, 0, crateSize, crateSize, 0xb57a40);
      box.setStrokeStyle(3 * this.worldScaleFactor, 0x4d2e14);
      const diag = this.add.graphics();
      const d = 18 * this.worldScaleFactor;
      diag.lineStyle(3 * this.worldScaleFactor, 0x5c391a, 0.9);
      diag.lineBetween(-d, -d, d, d);
      diag.lineBetween(d, -d, -d, d);
      cont.add([box, diag]);
      this.crateSprites.set(idx, cont);
    });

    // Explosive Barrels (Arena Series)
    const barrelPts = this.localSim ? this.localSim.barrels : (mapData.barrels ?? []).map((b, i) => ({ id: i, x: b.x, y: b.y }));
    barrelPts.forEach((b, idx) => {
      const cont = this.add.container(b.x, b.y).setDepth(14);
      const br = TANK.arenaSeries.barrel.radius;
      const body = this.add.circle(0, 0, br, 0xd93829);
      body.setStrokeStyle(4, 0x260c09);
      const stripe = this.add.rectangle(0, 0, br * 1.4, br * 0.42, 0xffc83d);
      const hazard = this.add.circle(0, 0, br * 0.25, 0x260c09);
      cont.add([body, stripe, hazard]);
      this.barrelSprites.set(idx, cont);
    });

    // Power pads (3 distinct types: Shield, Speed 2x, Fireball Unlimited)
    const powerCoords = this.localSim
      ? this.localSim.powerBoxes.map((b) => ({ x: b.x, y: b.y, power: b.power }))
      : mapData.powerBoxes.map((p, idx) => ({
          x: p.x,
          y: p.y,
          power: (['shield', 'speed', 'unlimited'] as PowerType[])[idx % 3],
        }));

    const padSize = 52 * this.worldScaleFactor;
    powerCoords.forEach((p, idx) => {
      const cont = this.add.container(p.x, p.y).setDepth(15);
      const bg = this.add.rectangle(0, 0, padSize, padSize, 0x00e5c3, 0.28);
      bg.setStrokeStyle(3.5 * this.worldScaleFactor, 0x00e5c3);
      const badge = this.add
        .text(0, -4 * this.worldScaleFactor, '⚡', {
          fontSize: `${Math.round(24 * this.worldScaleFactor)}px`,
        })
        .setOrigin(0.5);
      const sub = this.add
        .text(0, 17 * this.worldScaleFactor, '2× SPD', {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: `${Math.round(9.5 * this.worldScaleFactor)}px`,
          color: '#FFFFFF',
          stroke: '#0B1020',
          strokeThickness: 3 * this.worldScaleFactor,
        })
        .setOrigin(0.5);
      cont.add([bg, badge, sub]);
      const item: PowerBoxVisual = { cont, bg, badge, sub, lastCode: -1 };
      const initCode = p.power === 'speed' ? 1 : p.power === 'shield' ? 2 : 3;
      this.stylePowerBoxVisual(item, initCode);
      this.tweens.add({ targets: cont, scaleX: 1.09, scaleY: 1.09, duration: 750, yoyo: true, repeat: -1 });
      this.powerBoxSprites.set(idx, item);
    });

    // Bushes (above tanks for stealth cover)
    const gBush = this.add.graphics().setDepth(35);
    if (mapData.bushZones && mapData.bushZones.length > 0) {
      for (const bz of mapData.bushZones) {
        const bushMain = mapData.theme === 'swamp' ? 0x245e3d : 0x27733e;
        const bushHi = mapData.theme === 'swamp' ? 0x3b8c5a : 0x45a85d;
        gBush.fillStyle(0x000000, 0.22);
        gBush.fillCircle(bz.x + 8, bz.y + 8, bz.r);
        gBush.fillStyle(bushMain, 0.84);
        gBush.fillCircle(bz.x, bz.y, bz.r);
        gBush.fillStyle(bushHi, 0.86);
        gBush.fillCircle(bz.x - bz.r * 0.28, bz.y - bz.r * 0.22, bz.r * 0.56);
        gBush.fillCircle(bz.x + bz.r * 0.32, bz.y + bz.r * 0.16, bz.r * 0.52);
        gBush.fillCircle(bz.x + bz.r * 0.05, bz.y - bz.r * 0.34, bz.r * 0.44);
        gBush.lineStyle(3.5, 0x164224, 0.9);
        gBush.strokeCircle(bz.x, bz.y, bz.r);
      }
    } else {
      for (const bush of mapData.bushes) {
        gBush.fillStyle(0x276b41, 0.85);
        gBush.fillCircle(bush.x, bush.y, 26);
        gBush.fillStyle(0x37945b, 0.85);
        gBush.fillCircle(bush.x - 8, bush.y - 6, 15);
        gBush.fillCircle(bush.x + 10, bush.y + 4, 14);
        gBush.lineStyle(2, 0x164026, 0.9);
        gBush.strokeCircle(bush.x, bush.y, 26);
      }
    }

    // Flags
    if (this.ctx.settings.mode === 'flag' && mapData.flags) {
      const mkFlag = (x: number, y: number, color: number) => {
        const c = this.add.container(x, y).setDepth(32);
        const pole = this.add.rectangle(0, -10 * this.worldScaleFactor, 4 * this.worldScaleFactor, 36 * this.worldScaleFactor, 0xf4f6ff);
        const fs = this.worldScaleFactor;
        const cloth = this.add.triangle(13 * fs, -22 * fs, 0, -11 * fs, 26 * fs, 0, 0, 11 * fs, color);
        cloth.setStrokeStyle(2.5, 0x0b1020);
        c.add([pole, cloth]);
        return c;
      };
      this.flagSprites.red = mkFlag(mapData.flags.red.flag.x, mapData.flags.red.flag.y, 0xf23a12);
      this.flagSprites.blue = mkFlag(mapData.flags.blue.flag.x, mapData.flags.blue.flag.y, 0x3f6fe0);
    }
  }

  private drawArenaSeriesTerrain(g: Phaser.GameObjects.Graphics, mapData: MapData, isNight: boolean, s: number): void {
    if (mapData.series !== 'arena-series') return;

    // 1. Subtle track paths connecting gates & midfield
    g.lineStyle(18 * s, isNight ? 0x000000 : 0x2b221a, 0.08);
    g.lineBetween(180 * s, 384 * s, 1196 * s, 384 * s);
    g.lineBetween(688 * s, 96 * s, 688 * s, 672 * s);

    // 2. Corner Lava Decor (around platforms on Lava Crater; platforms stay 100% safe!)
    for (const c of mapData.decorDetails?.cornerLavaDecor ?? []) {
      g.fillStyle(0xff5014, 0.45);
      g.fillCircle(c.x, c.y, c.r * 1.15);
      g.fillStyle(0xff9f33, 0.72);
      g.fillCircle(c.x, c.y, c.r * 0.65);
    }

    // 3. Lava Hazard Cracks (8 dmg/s)
    for (const hz of mapData.hazardZones ?? []) {
      g.fillStyle(0x8a1f0a, 0.78);
      g.fillCircle(hz.x, hz.y, hz.r);
      g.fillStyle(0xff5b1a, 0.72);
      g.fillCircle(hz.x, hz.y, hz.r * 0.72);
      g.fillStyle(0xffcc4d, 0.85);
      g.fillCircle(hz.x - hz.r * 0.14, hz.y + hz.r * 0.1, hz.r * 0.34);
      g.lineStyle(3 * s, 0xff9f43, 0.9);
      g.strokeCircle(hz.x, hz.y, hz.r);
    }

    // 4. Rocky Path / Swamp Mud Slow Zones
    for (const sz of mapData.speedZones ?? []) {
      if (sz.kind === 'mud') {
        g.fillStyle(0x3a2e1c, 0.75);
        g.fillCircle(sz.x, sz.y, sz.r);
        g.fillStyle(0x4b3f22, 0.65);
        g.fillCircle(sz.x + sz.r * 0.18, sz.y - sz.r * 0.15, sz.r * 0.55);
        g.lineStyle(2.5 * s, 0x5ad68d, 0.45);
        g.strokeCircle(sz.x, sz.y, sz.r);
      } else {
        g.fillStyle(0x8c6d4f, 0.42);
        g.fillCircle(sz.x, sz.y, sz.r);
        g.fillStyle(0x5d4531, 0.65);
        // Pebble cluster marks
        for (let k = 0; k < 5; k++) {
          const ang = k * 1.25;
          g.fillCircle(sz.x + Math.cos(ang) * sz.r * 0.45, sz.y + Math.sin(ang) * sz.r * 0.45, 5.5 * s);
        }
      }
    }

    // 5. Ice Arena Glaze (Snow Ruins)
    if (mapData.iceWorld?.enabled) {
      g.lineStyle(3 * s, 0xffffff, 0.25);
      for (let x = 320 * s; x <= 1080 * s; x += 190 * s) {
        g.lineBetween(x - 45 * s, 190 * s, x + 45 * s, 145 * s);
        g.lineBetween(x - 45 * s, 575 * s, x + 45 * s, 530 * s);
      }
    }

    // 6. Swamp decorative glowing mushrooms & reeds near corners/walls
    if (mapData.theme === 'swamp') {
      const shrooms = [
        { x: 350 * s, y: 80 * s },
        { x: 1020 * s, y: 80 * s },
        { x: 350 * s, y: 690 * s },
        { x: 1020 * s, y: 690 * s },
        { x: 430 * s, y: 205 * s },
        { x: 940 * s, y: 560 * s },
      ];
      for (const m of shrooms) {
        g.fillStyle(0x5ad68d, 0.35);
        g.fillCircle(m.x, m.y, 18 * s);
        g.fillStyle(0x7cf5b2, 0.9);
        g.fillCircle(m.x, m.y, 7 * s);
      }
    }

    // 7. Gate Alcoves (safe floor)
    for (const alc of mapData.decorDetails?.gateAlcoves ?? []) {
      g.fillStyle(0xffffff, 0.14);
      g.fillRect(alc.x, alc.y, alc.w, alc.h);
      g.lineStyle(2 * s, 0xffffff, 0.25);
      g.strokeRect(alc.x, alc.y, alc.w, alc.h);
    }

    // 8. 4 Circular Corner Stone Platforms (Safe normal-grip spawn pads!)
    const platFill =
      mapData.theme === 'lava'
        ? 0x4c3631
        : mapData.theme === 'frost'
          ? 0xcbe7f7
          : mapData.theme === 'swamp'
            ? 0x566c5e
            : mapData.theme === 'grass'
              ? 0x89927f
              : 0xd9ba89;
    const platTrim =
      mapData.theme === 'lava'
        ? 0xff7b39
        : mapData.theme === 'frost'
          ? 0x4ea3d9
          : mapData.theme === 'swamp'
            ? 0x5ad68d
            : mapData.theme === 'grass'
              ? 0xbec7b2
              : 0x8c6742;

    for (const plat of mapData.platforms ?? []) {
      g.fillStyle(0x000000, 0.25);
      g.fillCircle(plat.x + 6 * s, plat.y + 6 * s, plat.r);
      g.fillStyle(platFill, 1);
      g.fillCircle(plat.x, plat.y, plat.r);
      g.lineStyle(4 * s, platTrim, 0.88);
      g.strokeCircle(plat.x, plat.y, plat.r);
      g.lineStyle(2 * s, 0xffffff, 0.25);
      g.strokeCircle(plat.x, plat.y, plat.r * 0.65);
      g.strokeCircle(plat.x, plat.y, plat.r * 0.3);
    }
  }

  private drawVentsOverlay(): void {
    if (!this.ventGfx || !this.mapData.eruptionVents) return;
    this.ventGfx.clear();
    const vents = this.mapData.eruptionVents;
    for (let i = 0; i < vents.length; i++) {
      const v = vents[i];
      const [state, phaseTenths] = this.ventStates[i] ?? [0, 0];
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.015 + phaseTenths);
      if (state === 2) {
        this.ventGfx.fillStyle(0xff4d1a, 0.85);
        this.ventGfx.fillCircle(v.x, v.y, v.r * 1.12);
        this.ventGfx.fillStyle(0xffe066, 0.92);
        this.ventGfx.fillCircle(v.x, v.y, v.r * 0.65);
        this.ventGfx.lineStyle(6, 0xffffff, 0.9);
        this.ventGfx.strokeCircle(v.x, v.y, v.r * 1.2);
      } else if (state === 1) {
        // 1s glow warning before eruption
        this.ventGfx.fillStyle(0xff7722, 0.4 + pulse * 0.4);
        this.ventGfx.fillCircle(v.x, v.y, v.r);
        this.ventGfx.lineStyle(6, 0xffd166, 0.6 + pulse * 0.4);
        this.ventGfx.strokeCircle(v.x, v.y, v.r * (0.88 + pulse * 0.15));
      } else {
        this.ventGfx.fillStyle(0x2a1410, 0.72);
        this.ventGfx.fillCircle(v.x, v.y, v.r);
        this.ventGfx.fillStyle(0xff6a2b, 0.35 + pulse * 0.15);
        this.ventGfx.fillCircle(v.x, v.y, v.r * 0.45);
        this.ventGfx.lineStyle(4, 0xff6a2b, 0.55);
        this.ventGfx.strokeCircle(v.x, v.y, v.r);
      }
    }
  }

  private drawDebugOverlay(): void {
    if (!this.debugOverlayGfx) return;
    const g = this.debugOverlayGfx;
    g.clear();
    if (!this.debugOverlayVisible) {
      g.setVisible(false);
      return;
    }
    g.setVisible(true);

    // Collision rects
    g.lineStyle(3, 0xff3b30, 0.95);
    g.fillStyle(0xff3b30, 0.12);
    for (const r of [...this.mapData.pitWalls, ...this.mapData.steelBarriers]) {
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
    // Solid circles (center pyramid)
    g.lineStyle(4, 0xff9500, 0.95);
    for (const sc of this.mapData.solidCircles ?? []) {
      g.fillStyle(0xff9500, 0.16);
      g.fillCircle(sc.x, sc.y, sc.r);
      g.strokeCircle(sc.x, sc.y, sc.r);
    }
    // Platforms
    g.lineStyle(3, 0x34c759, 0.8);
    for (const p of this.mapData.platforms ?? []) {
      g.strokeCircle(p.x, p.y, p.r);
    }
    // Theme zones (hazards, vents, speedZones, bushes)
    for (const hz of this.mapData.hazardZones ?? []) {
      g.lineStyle(3, 0xff6a2b, 0.9);
      g.strokeCircle(hz.x, hz.y, hz.r);
    }
    for (const v of this.mapData.eruptionVents ?? []) {
      g.lineStyle(4, 0xffd60a, 0.95);
      g.strokeCircle(v.x, v.y, v.r);
    }
    for (const sz of this.mapData.speedZones ?? []) {
      g.lineStyle(3, 0xaf52de, 0.85);
      g.strokeCircle(sz.x, sz.y, sz.r);
    }
    for (const bz of this.mapData.bushZones ?? []) {
      g.lineStyle(3, 0x30d158, 0.9);
      g.strokeCircle(bz.x, bz.y, bz.r);
    }
    // Spawns (Red / Blue / FFA)
    for (const sp of this.mapData.startSpawns.red) {
      g.fillStyle(0xff453a, 0.9);
      g.fillCircle(sp.x, sp.y, 12);
    }
    for (const sp of this.mapData.startSpawns.blue) {
      g.fillStyle(0x0a84ff, 0.9);
      g.fillCircle(sp.x, sp.y, 12);
    }
    // Power pads
    for (const pb of this.mapData.powerBoxes) {
      g.lineStyle(3, 0x00e5c3, 0.95);
      g.strokeCircle(pb.x, pb.y, 26);
    }
    // Flag capture rings
    if (this.mapData.flags) {
      const capR = this.mapData.captureRadius ?? 54;
      g.lineStyle(3, 0xff453a, 0.9);
      g.strokeCircle(this.mapData.flags.red.pad.x, this.mapData.flags.red.pad.y, capR);
      g.lineStyle(3, 0x0a84ff, 0.9);
      g.strokeCircle(this.mapData.flags.blue.pad.x, this.mapData.flags.blue.pad.y, capR);
    }
  }

  private stylePowerBoxVisual(item: PowerBoxVisual, code: number): void {
    if (item.lastCode === code) return;
    item.lastCode = code;
    if (code === 2) {
      // Shield Power
      item.bg.setFillStyle(0x00b8ff, 0.3);
      item.bg.setStrokeStyle(3.5 * this.worldScaleFactor, 0x7ce8ff);
      item.badge.setText('🛡️');
      item.sub.setText('SHIELD');
      item.sub.setColor('#7CE8FF');
    } else if (code === 3) {
      // Fireball Unlimited Power
      item.bg.setFillStyle(0xff6a2b, 0.34);
      item.bg.setStrokeStyle(3.5 * this.worldScaleFactor, 0xffd166);
      item.badge.setText('🔥');
      item.sub.setText('FIREBALL');
      item.sub.setColor('#FFD166');
    } else {
      // Speed 2x Power
      item.bg.setFillStyle(0x00e5c3, 0.3);
      item.bg.setStrokeStyle(3.5 * this.worldScaleFactor, 0x5cf7dc);
      item.badge.setText('⚡');
      item.sub.setText('2× SPD');
      item.sub.setColor('#5CF7DC');
    }
  }

  private createVisualTanks(players: ClientContext['players']): void {
    const s = this.worldScaleFactor * (TANK.radius / 24);
    players.forEach((p, idx) => {
      const colorDef = PLAYER_COLORS.find((c) => c.id === p.colorId) ?? PLAYER_COLORS[0];
      const colorHex = hexToNum(colorDef.hex);

      const container = this.add.container(-400, -400).setDepth(25).setScale(s);
      const ownRing = this.add.graphics();
      if (p.id === this.ctx.localPlayerId && this.ctx.playMode !== 'local-party') {
        ownRing.lineStyle(2.5, 0x00e5c3, 0.85);
        ownRing.strokeCircle(0, 0, 34);
      }

      const shieldRing = this.add.graphics();
      const powerRing = this.add.graphics();

      const hull = this.add.graphics();
      this.drawTankHull(hull, colorHex, colorDef.shape);

      const turret = this.add.graphics();
      this.drawTankTurret(turret, colorHex);

      const carryFlag = this.add.graphics();

      const nameTag = this.add
        .text(0, -40 * s, p.nickname, {
          fontFamily: 'Nunito, sans-serif',
          fontSize: `${Math.round(14 * s)}px`,
          fontStyle: 'bold',
          color: '#F4F6FF',
          stroke: p.team === 'red' ? '#8A1A06' : p.team === 'blue' ? '#19358A' : '#0B1020',
          strokeThickness: 4 * s,
        })
        .setOrigin(0.5)
        .setDepth(40);

      const youLabel = this.add
        .text(0, -60 * s, 'YOU ▼', {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: `${Math.round(14 * s)}px`,
          color: '#00E5C3',
          stroke: '#0B1020',
          strokeThickness: 4 * s,
        })
        .setOrigin(0.5)
        .setDepth(42)
        .setVisible(p.id === this.ctx.localPlayerId && this.ctx.playMode !== 'local-party');

      if (youLabel.visible) {
        this.time.delayedCall(3000, () => {
          youLabel.setVisible(false);
        });
      }

      const hpBarGfx = this.add.graphics().setDepth(41);

      container.add([ownRing, shieldRing, powerRing, hull, turret, carryFlag]);

      this.visualTanks.set(idx, {
        idx,
        id: p.id,
        nickname: p.nickname,
        colorHex,
        colorCss: colorDef.hex,
        shape: colorDef.shape,
        team: p.team,
        container,
        hull,
        turret,
        shieldRing,
        powerRing,
        ownRing,
        nameTag,
        youLabel,
        hpBarGfx,
        carryFlag,
        targetX: -400,
        targetY: -400,
        targetAngle: 0,
        alive: true,
        hp: 100,
        ammo: 5,
        power: null,
        flagsMask: 1,
        respawnTenths: 0,
        recoilOffset: 0,
        trackPhase: 0,
        wasAlive: true,
        dustAccum: 0,
      });
    });
  }

  private drawTankHull(g: Phaser.GameObjects.Graphics, colorHex: number, _shape: string): void {
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-22, -18, 48, 42, 8);
    g.fillStyle(0x232734, 1);
    g.fillRoundedRect(-25, -24, 50, 10, 4);
    g.fillRoundedRect(-25, 14, 50, 10, 4);
    g.lineStyle(2, 0x0b1020, 1);
    g.strokeRoundedRect(-25, -24, 50, 10, 4);
    g.strokeRoundedRect(-25, 14, 50, 10, 4);
    g.fillStyle(colorHex, 1);
    g.fillRoundedRect(-22, -17, 44, 34, 7);
    g.lineStyle(2.5, 0x0b1020, 1);
    g.strokeRoundedRect(-22, -17, 44, 34, 7);
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(10, -10, 8, 20, 3);
  }

  private drawTankTurret(g: Phaser.GameObjects.Graphics, colorHex: number): void {
    g.clear();
    g.fillStyle(0xdbe2f4, 1);
    g.fillRoundedRect(4, -4.5, 28, 9, 3);
    g.lineStyle(2.2, 0x0b1020, 1);
    g.strokeRoundedRect(4, -4.5, 28, 9, 3);
    g.fillStyle(colorHex, 1);
    g.fillCircle(0, 0, 12);
    g.lineStyle(2.5, 0x0b1020, 1);
    g.strokeCircle(0, 0, 12);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(-3, -3, 4);
  }

  private initParticlePool(): void {
    for (let i = 0; i < 180; i++) {
      const rect = this.add.rectangle(-100, -100, 8 * this.worldScaleFactor, 8 * this.worldScaleFactor, 0xffffff).setDepth(38).setVisible(false);
      this.particles.push({ gfx: rect, vx: 0, vy: 0, vr: 0, life: 0, maxLife: 1, active: false });
    }
  }

  private spawnParticles(x: number, y: number, count: number, color: number, speed: number, life: number, size = 7): void {
    if (this.ctx.settings.particles === false) return;
    const scaleCount = this.quality === 'low' ? Math.ceil(count * 0.35) : this.quality === 'medium' ? Math.ceil(count * 0.65) : count;
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * this.worldScaleFactor * (0.4 + Math.random() * 0.7);
      p.active = true;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.vr = (Math.random() - 0.5) * 8;
      p.life = life;
      p.maxLife = life;
      p.gfx.setPosition(x, y);
      p.gfx.setScale((size * this.worldScaleFactor) / 8);
      if ('setFillStyle' in p.gfx) p.gfx.setFillStyle(color, 1);
      p.gfx.setAlpha(1).setVisible(true);
      spawned += 1;
      if (spawned >= scaleCount) break;
    }
  }

  private isBindingActive(code: string): boolean {
    if (!code) return false;
    if (code === 'MouseLeft') return this.mouseDownLeft;
    if (code === 'MouseRight') return this.mouseDownRight;
    return this.keysDown.has(code);
  }

  private setupInputs(): void {
    this.input.mouse?.disableContextMenu();
    this.pcBindings = SettingsStore.getPcBindings();

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.isDebug && e.code === 'F3') {
        e.preventDefault();
        this.debugOverlayVisible = !this.debugOverlayVisible;
        this.drawDebugOverlay();
        return;
      }
      if (this.paused) return;
      this.pcBindings = SettingsStore.getPcBindings();
      const boundKeys = [
        'Space',
        ...(this.ctx.controlStyle === 'PC_CUSTOM'
          ? [
              this.pcBindings.forward,
              this.pcBindings.reverse,
              this.pcBindings.turnLeft,
              this.pcBindings.turnRight,
              this.pcBindings.fire,
            ]
          : ['KeyW', 'KeyS', 'KeyA', 'KeyD']),
      ];
      if (boundKeys.includes(e.code)) {
        e.preventDefault();
      }
      this.keysDown.add(e.code);

      if (!e.repeat && !this.ctx.isSpectator && this.ctx.playMode !== 'local-party') {
        if (this.ctx.controlStyle === 'PC_CUSTOM' && e.code === this.pcBindings.fire) {
          tankAudio.unlock();
          this.triggerFireShot();
        } else if (
          (this.ctx.controlStyle === 'PC_STANDARD' || this.ctx.controlStyle === 'PC_MOUSE_STEER') &&
          e.code === 'Space'
        ) {
          tankAudio.unlock();
          this.triggerFireShot();
        }
      }

      if (this.ctx.playMode === 'local-party') {
        const localKeys = ['KeyQ', 'KeyP', 'KeyZ', 'KeyM'];
        const slot = localKeys.indexOf(e.code);
        if (slot !== -1 && !e.repeat) {
          this.handleOneButtonDown(slot);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
      if (this.ctx.playMode === 'local-party') {
        const localKeys = ['KeyQ', 'KeyP', 'KeyZ', 'KeyM'];
        const slot = localKeys.indexOf(e.code);
        if (slot !== -1) {
          this.handleOneButtonUp(slot);
        }
      }
    };

    const onBlur = () => {
      this.keysDown.clear();
      this.mouseDownLeft = false;
      this.mouseDownRight = false;
      this.stickPointerId = null;
      this.firePointerId = null;
      this.stickVector = { x: 0, y: 0, strength: 0 };
      this.localCornerStates = [false, false, false, false];
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onBlur);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onBlur);
    });

    // Pointer Events using worldX/worldY so camera zoom (0.5 vs 1) maps accurately
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.ctx.isSpectator) return;
      tankAudio.unlock();
      this.pcBindings = SettingsStore.getPcBindings();

      if (this.ctx.playMode === 'local-party') {
        const slot = this.hitTestLocalCorner(pointer.worldX, pointer.worldY);
        if (slot !== -1) {
          this.localCornerStates[slot] = true;
          this.handleOneButtonDown(slot);
        }
        return;
      }

      if (pointer.wasTouch) {
        this.handleTouchDown(pointer);
      } else {
        this.mouseStageX = pointer.worldX;
        this.mouseStageY = pointer.worldY;
        if (pointer.rightButtonDown()) {
          this.mouseDownRight = true;
          if (this.ctx.controlStyle === 'PC_CUSTOM' && this.pcBindings.fire === 'MouseRight') {
            this.triggerFireShot();
          }
        } else {
          this.mouseDownLeft = true;
          if (this.ctx.controlStyle === 'PC_CUSTOM') {
            if (this.pcBindings.fire === 'MouseLeft') {
              this.triggerFireShot();
            }
          } else {
            this.triggerFireShot();
          }
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        this.handleTouchMove(pointer);
      } else {
        this.mouseStageX = pointer.worldX;
        this.mouseStageY = pointer.worldY;
        this.lastMouseMoveTs = performance.now();
        this.input.setDefaultCursor('default');
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.ctx.playMode === 'local-party') {
        for (let i = 0; i < 4; i++) {
          if (this.localCornerStates[i]) {
            this.localCornerStates[i] = false;
            this.handleOneButtonUp(i);
          }
        }
        return;
      }

      if (pointer.wasTouch) {
        this.handleTouchUp(pointer);
      } else {
        if (!pointer.leftButtonDown()) this.mouseDownLeft = false;
        if (!pointer.rightButtonDown()) this.mouseDownRight = false;
      }
    });
  }

  private handleOneButtonDown(slot: number): void {
    this.oneBtnDownAt[slot] = performance.now();
    this.oneBtnIsHolding[slot] = false;
  }

  private handleOneButtonUp(slot: number): void {
    const heldMs = performance.now() - this.oneBtnDownAt[slot];
    if (heldMs <= TANK.tapTimeSec * 1000) {
      this.localFireSeqs[slot] += 1;
    }
    this.oneBtnDownAt[slot] = 0;
    this.oneBtnIsHolding[slot] = false;
  }

  private hitTestLocalCorner(wx: number, wy: number): number {
    const padX = Math.round(this.stageW * 0.08);
    const padY = Math.round(this.stageH * 0.14);
    const hitR = 105 / this.camZoom;
    const corners = [
      { x: padX, y: padY },
      { x: this.stageW - padX, y: padY },
      { x: padX, y: this.stageH - padY },
      { x: this.stageW - padX, y: this.stageH - padY },
    ];
    for (let i = 0; i < corners.length; i++) {
      if (Math.hypot(wx - corners[i].x, wy - corners[i].y) <= hitR) {
        return i;
      }
    }
    return -1;
  }

  private handleTouchDown(pointer: Phaser.Input.Pointer): void {
    const wx = pointer.worldX;
    const wy = pointer.worldY;
    const isLeftSide = wx < this.stageW * 0.5;
    const stickSideIsLeft = !this.touchConfig.leftHanded;

    if (this.ctx.controlStyle === 'TOUCH_ONE_THUMB') {
      this.handleOneButtonDown(0);
      this.stickPointerId = pointer.id;
      this.stickOriginX = wx;
      this.stickOriginY = wy;
      return;
    }

    if ((stickSideIsLeft && isLeftSide) || (!stickSideIsLeft && !isLeftSide)) {
      if (this.stickPointerId === null) {
        this.stickPointerId = pointer.id;
        if (this.touchConfig.floating) {
          this.stickOriginX = wx;
          this.stickOriginY = wy;
        } else {
          this.stickOriginX = stickSideIsLeft ? 220 / this.camZoom : this.stageW - 220 / this.camZoom;
          this.stickOriginY = this.stageH - 170 / this.camZoom;
        }
        this.stickCurX = wx;
        this.stickCurY = wy;
        this.updateStickVector();
      }
    } else if (this.firePointerId === null) {
      this.firePointerId = pointer.id;
      this.triggerFireShot();
    }
  }

  private handleTouchMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.stickPointerId) {
      this.stickCurX = pointer.worldX;
      this.stickCurY = pointer.worldY;
      this.updateStickVector();
    }
  }

  private handleTouchUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.stickPointerId) {
      this.stickPointerId = null;
      this.stickVector = { x: 0, y: 0, strength: 0 };
      if (this.ctx.controlStyle === 'TOUCH_ONE_THUMB') {
        this.handleOneButtonUp(0);
      }
    }
    if (pointer.id === this.firePointerId) {
      this.firePointerId = null;
    }
  }

  private updateStickVector(): void {
    const dx = this.stickCurX - this.stickOriginX;
    const dy = this.stickCurY - this.stickOriginY;
    const dist = Math.hypot(dx, dy);
    const maxDrag = (TANK.touch.stickMax * 1.4) / this.camZoom;
    const norm = Math.min(1, dist / maxDrag);
    if (norm < this.touchConfig.deadZone) {
      this.stickVector = { x: 0, y: 0, strength: 0 };
    } else {
      this.stickVector = {
        x: dx / (dist || 1),
        y: dy / (dist || 1),
        strength: norm,
      };
    }
  }

  private triggerFireShot(): void {
    this.fireSeq += 1;
    if (this.touchConfig.haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  }

  private createLocalPartyHud(): void {
    const padX = Math.round(this.stageW * 0.08);
    const padY = Math.round(this.stageH * 0.14);
    const inv = 1 / this.camZoom;
    const corners = [
      { x: padX, y: padY, rot: Math.PI },
      { x: this.stageW - padX, y: padY, rot: Math.PI },
      { x: padX, y: this.stageH - padY, rot: 0 },
      { x: this.stageW - padX, y: this.stageH - padY, rot: 0 },
    ];
    const localPlayers = this.ctx.localPlayers ?? [];
    localPlayers.forEach((lp, i) => {
      const pos = corners[i];
      if (!pos) return;
      const colorDef = PLAYER_COLORS.find((c) => c.id === lp.colorId) ?? PLAYER_COLORS[i];
      const colorHex = hexToNum(colorDef.hex);

      const cont = this.add.container(pos.x, pos.y).setDepth(80).setScale(inv);
      const circle = this.add.circle(0, 0, 88, colorHex, 0.35);
      circle.setStrokeStyle(5, colorHex, 0.9);
      const label = this.add
        .text(0, 0, `${lp.nickname}\nHOLD/TAP`, {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: '18px',
          align: 'center',
          color: '#FFFFFF',
        })
        .setOrigin(0.5)
        .setRotation(pos.rot);
      cont.add([circle, label]);
      this.localCornerGfx.push(cont);

      const respText = this.add
        .text(pos.x + (i % 2 === 0 ? 115 * inv : -115 * inv), pos.y, '', {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: `${Math.round(32 * inv)}px`,
          color: '#FFC83D',
          backgroundColor: 'rgba(11,16,32,0.75)',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(82)
        .setRotation(pos.rot);
      this.localPartyHudTexts.push(respText);
    });
  }

  public update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.lastFps = Math.round(this.game.loop.actualFps || 60);

    if (this.lastFps < 40) {
      this.lowFpsTimer += dt;
      if (this.lowFpsTimer >= 5 && this.quality !== 'low') {
        this.quality = 'low';
        this.particleBudget = 60;
      }
    } else {
      this.lowFpsTimer = 0;
    }

    if (this.paused) return;

    if (this.lastMouseMoveTs > 0 && performance.now() - this.lastMouseMoveTs > 2000) {
      this.input.setDefaultCursor('none');
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
      }
    }

    const spaceHeld = this.keysDown.has('Space');
    const styleGroup = resolveControlGroup(this.ctx.controlStyle);
    const customFireHeld = this.ctx.controlStyle === 'PC_CUSTOM' && this.isBindingActive(this.pcBindings.fire);
    const selfIdx = this.playerIdToIdx.get(this.ctx.localPlayerId);
    const selfVis = selfIdx !== undefined ? this.visualTanks.get(selfIdx) : undefined;
    const hasUnlimitedFireball = Boolean(selfVis && (selfVis.flagsMask & 16) !== 0);
    const shouldRapidFire =
      this.ctx.controlStyle === 'PC_CUSTOM'
        ? customFireHeld
        : (styleGroup === 'ARCADE' && hasUnlimitedFireball && this.mouseDownLeft) ||
          (styleGroup === 'STANDARD' && (spaceHeld || this.mouseDownLeft)) ||
          (styleGroup === 'STEER' && (this.mouseDownLeft || spaceHeld || this.firePointerId !== null));

    const fireCooldown = hasUnlimitedFireball ? TANK.powers.unlimited.cooldownSec : TANK.ammo.cooldownSec;
    if (!this.ctx.isSpectator && (this.touchConfig.rapidFire || hasUnlimitedFireball) && shouldRapidFire) {
      this.rapidFireAccum += dt;
      if (this.rapidFireAccum >= fireCooldown) {
        this.rapidFireAccum = 0;
        this.triggerFireShot();
      }
    } else {
      this.rapidFireAccum = 0;
    }

    if (this.localSim) {
      this.simAccum += dt;
      const fixedDt = 1 / TANK.tickRate;
      while (this.simAccum >= fixedDt) {
        this.simAccum -= fixedDt;

        if (this.ctx.playMode === 'local-party' && this.ctx.localPlayers) {
          this.ctx.localPlayers.forEach((lp, slot) => {
            const held = this.oneBtnDownAt[slot] > 0 && performance.now() - this.oneBtnDownAt[slot] >= TANK.holdDelaySec * 1000;
            this.localSim!.applyInput(lp.id, {
              seq: this.localSim!.tickCount,
              throttle: held ? 1 : 0,
              turn: 0,
              heading: null,
              fire: this.localFireSeqs[slot],
            });
          });
        } else if (!this.ctx.isSpectator) {
          this.localSim.applyInput(this.ctx.localPlayerId, this.buildLocalTankInput());
        }

        for (const [botId, brain] of this.localBots.entries()) {
          const inp = brain.think(this.localSim, botId, fixedDt);
          this.localSim.applyInput(botId, inp);
        }

        this.localSim.tick(fixedDt);
        const evs = this.localSim.drainEvents();
        for (const ev of evs) this.applyEvent(ev);

        if (this.isPractice) {
          this.localSim.timeLeftSec = 9999;
        }

        if (this.localSim.finishedResult && this.ctx.onLocalMatchEnd) {
          tankAudio.playWin();
          this.ctx.onLocalMatchEnd(this.localSim.finishedResult);
          this.paused = true;
          break;
        }
      }
      this.applySnapshot(this.localSim.getCompactSnapshot());
    } else if (!this.ctx.isSpectator) {
      this.inputSendAccum += dt;
      if (this.inputSendAccum >= 1 / 30) {
        this.inputSendAccum = 0;
        const inp = this.buildLocalTankInput();
        this.ctx.onSendInput([inp.seq, inp.throttle, inp.turn, inp.heading, inp.fire]);
      }
    }

    this.drawVentsOverlay();
    this.updateVisualTanks(dt);
    this.updateVisualShells(dt);
    this.updateParticles(dt);
    this.drawAimAndTouchOverlays();
    this.drawLiveMinimap();

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08 && this.ctx.onHudUpdate) {
      this.hudEmitAccum = 0;
      this.emitHudState();
    }
  }

  private drawLiveMinimap(): void {
    if (!this.minimapGfx) return;
    const g = this.minimapGfx;
    g.clear();
    const inv = 1 / this.camZoom;
    const mw = 196 * inv;
    const mh = mw * (this.stageH / this.stageW);
    const mx = this.stageW / 2 - mw / 2;
    const my = this.stageH - mh - 14 * inv;
    const sx = mw / this.stageW;
    const sy = mh / this.stageH;

    // Flat 2D panel & crisp border
    g.fillStyle(0x0b111e, 0.88);
    g.fillRect(mx, my, mw, mh);
    g.lineStyle(1.5 * inv, 0x475569, 0.95);
    g.strokeRect(mx, my, mw, mh);

    // Flat map walls
    g.fillStyle(0x64748b, 0.52);
    for (const w of this.mapData.pitWalls) {
      g.fillRect(mx + w.x * sx, my + w.y * sy, Math.max(1, w.w * sx), Math.max(1, w.h * sy));
    }
    for (const sc of this.mapData.solidCircles ?? []) {
      g.fillCircle(mx + sc.x * sx, my + sc.y * sy, Math.max(2, sc.r * sx));
    }

    // Flat flag markers
    if (this.latestSnap?.flags) {
      g.fillStyle(0xef4444, 1);
      g.fillCircle(mx + this.latestSnap.flags.r[1] * sx, my + this.latestSnap.flags.r[2] * sy, 3.5 * inv);
      g.fillStyle(0x3b82f6, 1);
      g.fillCircle(mx + this.latestSnap.flags.b[1] * sx, my + this.latestSnap.flags.b[2] * sy, 3.5 * inv);
    }

    // Flat player dots (preserving stealth reveal behavior)
    const selfIdx = this.playerIdToIdx.get(this.ctx.localPlayerId);
    const selfVis = selfIdx !== undefined ? this.visualTanks.get(selfIdx) : undefined;
    const revealDist = TANK.arenaSeries.bush.revealRadius * this.worldScaleFactor;

    for (const vt of this.visualTanks.values()) {
      if (!vt.alive) continue;
      const isStealthed = (vt.flagsMask & 256) !== 0;
      const isEnemy = this.ctx.settings.mode === 'ffa' || (selfVis && vt.team !== selfVis.team);
      if (isStealthed && isEnemy && selfVis && vt.id !== selfVis.id) {
        if (Math.hypot(vt.container.x - selfVis.container.x, vt.container.y - selfVis.container.y) > revealDist) {
          continue;
        }
      }
      const isLocal = vt.id === this.ctx.localPlayerId;
      const dotR = (isLocal ? 4 : 3) * inv;
      const dotX = mx + vt.container.x * sx;
      const dotY = my + vt.container.y * sy;
      g.fillStyle(isLocal ? 0x2dd4bf : vt.colorHex, 1);
      g.fillCircle(dotX, dotY, dotR);
      if (isLocal) {
        g.lineStyle(1 * inv, 0x0b111e, 0.9);
        g.strokeCircle(dotX, dotY, dotR);
      }
    }
  }

  private buildLocalTankInput(): TankInputObj {
    this.inputSeq += 1;
    const style = this.ctx.controlStyle;
    const group = resolveControlGroup(style);
    const selfIdx = this.playerIdToIdx.get(this.ctx.localPlayerId);
    const selfVis = selfIdx !== undefined ? this.visualTanks.get(selfIdx) : undefined;

    let throttle = 0;
    let turn = 0;
    let heading: number | null = null;

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    let padHeading: number | null = null;
    let padThrottle = 0;
    if (pad) {
      const lx = pad.axes[0] ?? 0;
      const ly = pad.axes[1] ?? 0;
      const mag = Math.hypot(lx, ly);
      if (mag > 0.2) {
        padHeading = ((Math.atan2(ly, lx) * 180) / Math.PI + 360) % 360;
        padThrottle = Math.min(1, mag);
      }
      if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) {
        if (this.rapidFireAccum === 0) this.triggerFireShot();
      }
    }

    if (group === 'ARCADE') {
      if (style === 'TOUCH_ONE_THUMB') {
        const held = this.oneBtnDownAt[0] > 0 && performance.now() - this.oneBtnDownAt[0] >= TANK.holdDelaySec * 1000;
        throttle = held ? 1 : 0;
      } else {
        // Pure Space-only drive (tank auto-rotates when released, reverses spin on Mouse Click fire)
        throttle = this.keysDown.has('Space') ? 1 : 0;
      }
      return { seq: this.inputSeq, throttle, turn: 0, heading: null, fire: this.localFireSeqs[0] || this.fireSeq };
    }

    if (style === 'PC_CUSTOM') {
      const b = this.pcBindings;
      if (this.isBindingActive(b.forward)) throttle += 1;
      if (this.isBindingActive(b.reverse)) throttle -= 1;
      if (this.isBindingActive(b.turnLeft)) turn -= 1;
      if (this.isBindingActive(b.turnRight)) turn += 1;
      return { seq: this.inputSeq, throttle, turn, heading: null, fire: this.fireSeq };
    }

    if (group === 'STANDARD') {
      if (this.keysDown.has('KeyW')) throttle += 1;
      if (this.keysDown.has('KeyS')) throttle -= 1;
      if (this.keysDown.has('KeyA')) turn -= 1;
      if (this.keysDown.has('KeyD')) turn += 1;
      return { seq: this.inputSeq, throttle, turn, heading: null, fire: this.fireSeq };
    }

    if (this.stickVector.strength > 0) {
      heading = ((Math.atan2(this.stickVector.y, this.stickVector.x) * 180) / Math.PI + 360) % 360;
      throttle = this.stickVector.strength;
    } else if (padHeading !== null) {
      heading = padHeading;
      throttle = padThrottle;
    } else if (style === 'PC_MOUSE_STEER' && selfVis) {
      heading = ((Math.atan2(this.mouseStageY - selfVis.container.y, this.mouseStageX - selfVis.container.x) * 180) / Math.PI + 360) % 360;
      if (this.mouseDownRight || this.keysDown.has('KeyW')) throttle = 1;
    } else {
      let dx = 0;
      let dy = 0;
      if (this.keysDown.has('KeyW')) dy -= 1;
      if (this.keysDown.has('KeyS')) dy += 1;
      if (this.keysDown.has('KeyA')) dx -= 1;
      if (this.keysDown.has('KeyD')) dx += 1;
      if (dx !== 0 || dy !== 0) {
        heading = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        throttle = 1;
      }
    }

    if (heading !== null && this.touchConfig.aimAssist === 'light' && selfVis && this.ctx.settings.aimAssistAllowed !== false) {
      let bestAngle = heading;
      let bestDiff: number = TANK.aimAssist.coneDeg;
      const rangePx = TANK.aimAssist.rangePx * this.worldScaleFactor;
      for (const other of this.visualTanks.values()) {
        if (!other.alive || other.id === selfVis.id) continue;
        if (this.ctx.settings.mode !== 'ffa' && other.team === selfVis.team) continue;
        const dist = Math.hypot(other.container.x - selfVis.container.x, other.container.y - selfVis.container.y);
        if (dist > rangePx) continue;
        const angTo = ((Math.atan2(other.container.y - selfVis.container.y, other.container.x - selfVis.container.x) * 180) / Math.PI + 360) % 360;
        const diff = (((angTo - heading + 540) % 360) - 180);
        if (Math.abs(diff) < bestDiff) {
          bestDiff = Math.abs(diff);
          const nudge = Math.sign(diff) * Math.min(TANK.aimAssist.nudgeDeg, Math.abs(diff));
          bestAngle = (heading + nudge + 360) % 360;
        }
      }
      heading = bestAngle;
    }

    return { seq: this.inputSeq, throttle, turn: 0, heading, fire: this.fireSeq };
  }

  public applySnapshot(snap: CompactSnapshot): void {
    this.latestSnap = snap;
    if (!this.scene || !this.scene.isActive()) return;

    for (const row of snap.tanks) {
      const [idx, x, y, angle, flags, ammo, powerCode, hp, respawnTenths] = row;
      const vt = this.visualTanks.get(idx);
      if (!vt) continue;

      vt.targetX = x;
      vt.targetY = y;
      vt.targetAngle = angle;
      vt.flagsMask = flags;
      vt.alive = (flags & 1) !== 0;
      vt.ammo = ammo;
      vt.power = codeToPower(powerCode);
      vt.hp = hp;
      vt.respawnTenths = respawnTenths;

      if (vt.container.x < 0 && vt.alive) {
        vt.container.setPosition(x, y);
        vt.container.setAngle(angle);
      }
    }

    snap.boxes.forEach((code, idx) => {
      const item = this.powerBoxSprites.get(idx);
      if (!item) return;
      if (code > 0) {
        item.cont.setVisible(true);
        this.stylePowerBoxVisual(item, code);
      } else {
        item.cont.setVisible(false);
      }
    });

    if (snap.barrels) {
      snap.barrels.forEach((alive, idx) => {
        const sprite = this.barrelSprites.get(idx);
        if (sprite) sprite.setVisible(alive === 1);
      });
    }

    if (snap.vents) {
      this.ventStates = snap.vents;
    }

    const activeDropIds = new Set<number>();
    for (const [id, x, y, powerCode] of snap.drops) {
      activeDropIds.add(id);
      if (!this.dropSprites.has(id)) {
        const cont = this.add.container(x, y).setDepth(16).setScale(this.worldScaleFactor);
        const dropColor = powerCode === 2 ? 0x00b8ff : powerCode === 3 ? 0xff6a2b : 0x00e5c3;
        const dropBorder = powerCode === 2 ? 0x7ce8ff : powerCode === 3 ? 0xffd166 : 0x5cf7dc;
        const bg = this.add.circle(0, 0, 20, dropColor, 0.35);
        bg.setStrokeStyle(3, dropBorder);
        const icon = this.add.text(0, 0, powerCode === 1 ? '⚡' : powerCode === 2 ? '🛡️' : '🔥', { fontSize: '20px' }).setOrigin(0.5);
        cont.add([bg, icon]);
        this.dropSprites.set(id, cont);
      }
    }
    for (const [id, cont] of this.dropSprites.entries()) {
      if (!activeDropIds.has(id)) {
        cont.destroy();
        this.dropSprites.delete(id);
      }
    }

    if (snap.flags) {
      const updFlag = (sprite: Phaser.GameObjects.Container | undefined, tuple: [number, number, number, number]) => {
        if (!sprite) return;
        const [stateCode, fx, fy] = tuple;
        sprite.setVisible(stateCode !== 1);
        sprite.setPosition(fx, fy);
        sprite.setAlpha(stateCode === 2 ? 0.5 + 0.5 * Math.sin(this.time.now * 0.012) : 1);
      };
      updFlag(this.flagSprites.red, snap.flags.r);
      updFlag(this.flagSprites.blue, snap.flags.b);
    }
  }

  public applyEvent(ev: SimEvent): void {
    if (!this.scene || !this.scene.isActive()) return;
    const d = ev.data;

    switch (ev.type) {
      case 'shot': {
        const sx = Number(d.x);
        const sy = Number(d.y);
        const angle = Number(d.angle);
        const ownerIdx = Number(d.ownerIdx);
        const shellId = Number(d.shellId) || 0;
        const isFireball = Boolean(d.isFireball);
        const colorDef = PLAYER_COLORS.find((c) => c.id === d.colorId) ?? PLAYER_COLORS[0];
        const colorHex = hexToNum(colorDef.hex);

        const rad = (angle * Math.PI) / 180;
        const shellR = isFireball
          ? Math.round(TANK.shell.fireballRadius * (this.worldScaleFactor > 1 ? 1.45 : 1.15))
          : Math.round(TANK.shell.radius * (this.worldScaleFactor > 1 ? 1.35 : 1));
        const shellSpd = Math.round((isFireball ? TANK.shell.fireballSpeed : TANK.shell.speed) * this.worldScaleFactor);
        const shellLife = this.worldScaleFactor > 1 ? 2.2 : TANK.shell.lifeSec;

        const gfx = this.add.container(sx, sy).setDepth(28);
        if (isFireball) {
          // Big blazing Fireball Power shot
          const aura = this.add.circle(0, 0, shellR * 1.95, 0xff5500, 0.45);
          const body = this.add.circle(0, 0, shellR * 1.25, 0xff9f1c, 1);
          body.setStrokeStyle(3 * this.worldScaleFactor, 0xffd166);
          const core = this.add.circle(0, 0, shellR * 0.65, 0xffffff, 1);
          gfx.add([aura, body, core]);
        } else {
          // Crisp default Tank Missile Fire
          gfx.setAngle(angle);
          const tailGlow = this.add.circle(-shellR * 1.35, 0, shellR * 0.55, 0xffc83d, 0.9);
          const body = this.add.rectangle(-shellR * 0.2, 0, shellR * 2.1, shellR * 0.95, 0xe2e8f0);
          body.setStrokeStyle(2 * this.worldScaleFactor, 0x0b1020);
          const band = this.add.rectangle(-shellR * 0.45, 0, shellR * 0.7, shellR * 0.9, colorHex);
          const nose = this.add.triangle(shellR * 1.15, 0, -shellR * 0.35, -shellR * 0.52, shellR * 0.7, 0, -shellR * 0.35, shellR * 0.52, colorHex);
          nose.setStrokeStyle(1.8 * this.worldScaleFactor, 0x0b1020);
          gfx.add([tailGlow, body, band, nose]);
        }

        const trail = this.add.graphics().setDepth(27);
        this.visualShells.push({
          id: shellId,
          x: sx,
          y: sy,
          vx: Math.cos(rad) * shellSpd,
          vy: Math.sin(rad) * shellSpd,
          life: shellLife,
          radius: shellR,
          isFireball,
          gfx,
          trail,
          colorHex,
        });

        const vt = this.visualTanks.get(ownerIdx);
        if (vt) {
          vt.recoilOffset = isFireball ? 11 : 8;
        }
        const flashR = (isFireball ? 18 : 11) * this.worldScaleFactor;
        const flash = this.add.circle(sx, sy, flashR, isFireball ? 0xff9f1c : 0xffe066, 0.85).setDepth(32);
        flash.setStrokeStyle(2.5 * this.worldScaleFactor, isFireball ? 0xff5500 : 0xffb703);
        this.tweens.add({
          targets: flash,
          scale: isFireball ? 2.2 : 1.7,
          alpha: 0,
          duration: isFireball ? 140 : 100,
          onComplete: () => flash.destroy(),
        });
        this.spawnParticles(sx, sy, isFireball ? 10 : 5, isFireball ? 0xff7b00 : 0xffc83d, isFireball ? 210 : 150, 0.2, isFireball ? 10 : 6);
        const isOwn = vt?.id === this.ctx.localPlayerId;
        if (isOwn && this.ctx.settings.screenShake !== false && this.quality !== 'low') {
          this.cameras.main.shake(60, 0.002);
        }
        tankAudio.playFire(sx, isOwn);
        break;
      }
      case 'dryClick': {
        if (d.playerId === this.ctx.localPlayerId) {
          tankAudio.playDryClick();
        }
        break;
      }
      case 'brickHit': {
        const br = this.brickSprites.get(Number(d.id));
        if (br) br.setFillStyle(0x8d5827);
        tankAudio.playBrickHit(Number(d.x) || this.stageW / 2);
        break;
      }
      case 'brickBreak': {
        const br = this.brickSprites.get(Number(d.id));
        if (br) {
          br.destroy();
          this.brickSprites.delete(Number(d.id));
        }
        this.spawnParticles(Number(d.x), Number(d.y), 8, 0xc98a4b, 190, 0.45, 9);
        tankAudio.playBrickHit(Number(d.x));
        break;
      }
      case 'crateBreak': {
        const cr = this.crateSprites.get(Number(d.id));
        if (cr) {
          cr.destroy();
          this.crateSprites.delete(Number(d.id));
        }
        this.despawnVisualShell(Number(d.shellId) || 0, Number(d.x), Number(d.y));
        this.spawnParticles(Number(d.x), Number(d.y), 8, 0xb57a40, 170, 0.4, 8);
        tankAudio.playCrateBreak(Number(d.x));
        break;
      }
      case 'barrelExplode': {
        const x = Number(d.x);
        const y = Number(d.y);
        const r = Number(d.r) || TANK.arenaSeries.barrel.blastRadius;
        this.despawnVisualShell(0, x, y);
        this.spawnParticles(x, y, 22, 0xff6a2b, 260, 0.65, 11);
        this.spawnParticles(x, y, 10, 0xffc83d, 200, 0.45, 9);
        const ring = this.add.circle(x, y, r * 0.25, 0xff6a2b, 0.25).setDepth(36);
        ring.setStrokeStyle(5, 0xffc83d);
        this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
        if (this.ctx.settings.screenShake !== false && this.quality !== 'low') {
          this.cameras.main.shake(120, 0.005);
        }
        tankAudio.playExplosion(x, false);
        break;
      }
      case 'ventErupt': {
        const x = Number(d.x);
        const y = Number(d.y);
        const r = Number(d.r) || 105;
        this.spawnParticles(x, y, 18, 0xff5500, 220, 0.55, 10);
        const ring = this.add.circle(x, y, r * 0.4, 0xff9f43, 0.25).setDepth(34);
        ring.setStrokeStyle(5, 0xffd166);
        this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
        break;
      }
      case 'shellWall': {
        this.despawnVisualShell(Number(d.shellId) || 0, Number(d.x), Number(d.y));
        this.spawnParticles(Number(d.x), Number(d.y), 7, 0xffc83d, 180, 0.26, 7);
        tankAudio.playSteelPing(Number(d.x));
        break;
      }
      case 'shieldPop': {
        if (d.shellId) this.despawnVisualShell(Number(d.shellId), Number(d.x), Number(d.y));
        const sx = Number(d.x);
        const sy = Number(d.y);
        const sVis = this.worldScaleFactor * (TANK.radius / 24);
        const shieldWave = this.add.circle(sx, sy, 36 * sVis, 0x00b8ff, 0.26).setDepth(33);
        shieldWave.setStrokeStyle(4 * sVis, 0x7ce8ff);
        this.tweens.add({
          targets: shieldWave,
          scale: 1.45,
          alpha: 0,
          duration: 210,
          onComplete: () => shieldWave.destroy(),
        });
        this.spawnParticles(sx, sy, 12, 0x7ce8ff, 210, 0.32, 7);
        tankAudio.playShieldPop(sx);
        break;
      }
      case 'powerPickup': {
        this.spawnParticles(Number(d.x), Number(d.y), 12, 0x00e5c3, 180, 0.45, 7);
        tankAudio.playPowerPickup(Number(d.x));
        break;
      }
      case 'tankHit': {
        const hx = Number(d.x);
        const hy = Number(d.y);
        if (d.shellId) this.despawnVisualShell(Number(d.shellId), hx, hy);
        this.spawnParticles(hx, hy, 10, 0xffc83d, 175, 0.25, 6);
        tankAudio.playBrickHit(hx || this.stageW / 2);
        if (d.playerId === this.ctx.localPlayerId && this.ctx.settings.screenShake !== false && this.quality !== 'low') {
          this.cameras.main.shake(80, 0.003);
        }
        break;
      }
      case 'tankKill': {
        const x = Number(d.x);
        const y = Number(d.y);
        this.despawnVisualShell(0, x, y);
        this.spawnParticles(x, y, 22, 0xff8a3d, 260, 0.65, 11);
        this.spawnParticles(x, y, 10, 0xff4d6d, 210, 0.45, 9);

        const ring = this.add.circle(x, y, 16 * this.worldScaleFactor, 0xffc83d, 0.2).setDepth(36);
        ring.setStrokeStyle(4 * this.worldScaleFactor, 0xff8a3d);
        this.tweens.add({
          targets: ring,
          scale: 3.4,
          alpha: 0,
          duration: 300,
          onComplete: () => ring.destroy(),
        });

        const isOwn = d.victimId === this.ctx.localPlayerId || d.killerId === this.ctx.localPlayerId;
        if (isOwn && this.ctx.settings.screenShake !== false && this.quality !== 'low') {
          this.cameras.main.shake(140, 0.006);
        }
        tankAudio.playExplosion(x, isOwn);

        if (d.killerName) {
          this.killFeed.unshift({
            id: this.killFeedSeq++,
            killer: String(d.killerName),
            victim: String(d.victimName),
            killerColor: String(d.killerColor ?? 'red'),
            victimColor: String(d.victimColor ?? 'blue'),
            ts: Date.now(),
          });
          if (this.killFeed.length > 4) this.killFeed.pop();
        }
        break;
      }
      case 'respawn': {
        const x = Number(d.x);
        const y = Number(d.y);
        const beam = this.add.circle(x, y, 36 * this.worldScaleFactor, 0x00e5c3, 0.35).setDepth(24);
        this.tweens.add({
          targets: beam,
          scale: 0.2,
          alpha: 0,
          duration: 400,
          onComplete: () => beam.destroy(),
        });
        break;
      }
      case 'flagPickup': {
        tankAudio.playFlagPickup();
        break;
      }
      case 'flagDrop': {
        break;
      }
      case 'flagReturn': {
        tankAudio.playFlagReturn();
        break;
      }
      case 'flagCapture': {
        this.showBanner('FLAG CAPTURED!', 1.5);
        this.spawnParticles(this.stageW / 2, 180 * this.worldScaleFactor, 35, 0xffc83d, 300, 1.1, 9);
        tankAudio.playFlagCapture();
        break;
      }
      case 'suddenDeath': {
        this.showBanner('SUDDEN DEATH!', 2.0);
        break;
      }
    }
  }

  private updateVisualTanks(dt: number): void {
    const smooth = Math.min(1, dt * 16);
    const crowded = this.visualTanks.size > 8;
    const selfIdx = this.playerIdToIdx.get(this.ctx.localPlayerId);
    const selfVis = selfIdx !== undefined ? this.visualTanks.get(selfIdx) : undefined;
    const revealDist = TANK.arenaSeries.bush.revealRadius * this.worldScaleFactor;

    for (const vt of this.visualTanks.values()) {
      if (!vt.alive) {
        vt.container.setVisible(false);
        vt.nameTag.setVisible(false);
        vt.hpBarGfx.setVisible(false);
        vt.wasAlive = false;
        vt.hpBarGfx.clear();
        continue;
      }

      if (!vt.wasAlive) {
        vt.container.setPosition(vt.targetX, vt.targetY);
        vt.container.setAngle(vt.targetAngle);
        vt.wasAlive = true;
      } else {
        const dx = vt.targetX - vt.container.x;
        const dy = vt.targetY - vt.container.y;
        vt.container.x += dx * smooth;
        vt.container.y += dy * smooth;

        const curAng = vt.container.angle;
        const diff = (((vt.targetAngle - curAng + 540) % 360) - 180);
        vt.container.angle = curAng + diff * smooth;

        if (Math.hypot(dx, dy) > 1.5 && this.quality !== 'low') {
          vt.dustAccum += dt;
          if (vt.dustAccum > 0.14) {
            vt.dustAccum = 0;
            this.spawnParticles(vt.container.x, vt.container.y, 1, 0xd9c7a3, 35, 0.25, 5);
          }
        }
      }

      // Bush stealth hiding check for remote enemies (> 300 world px away)
      const isStealthed = (vt.flagsMask & 256) !== 0;
      const isEnemy = this.ctx.settings.mode === 'ffa' || (selfVis && vt.team !== selfVis.team);
      let hiddenInBush = false;
      if (!this.ctx.isSpectator && selfVis && vt.id !== selfVis.id && isEnemy && isStealthed) {
        const dist = Math.hypot(vt.container.x - selfVis.container.x, vt.container.y - selfVis.container.y);
        if (dist > revealDist) hiddenInBush = true;
      }

      vt.container.setVisible(!hiddenInBush);
      vt.nameTag.setVisible(!hiddenInBush);
      vt.hpBarGfx.setVisible(!hiddenInBush);
      if (hiddenInBush) {
        vt.hpBarGfx.clear();
        continue;
      }

      if (vt.recoilOffset > 0) {
        vt.recoilOffset = Math.max(0, vt.recoilOffset - dt * 55);
        vt.turret.setPosition(-vt.recoilOffset, 0);
      } else {
        vt.turret.setPosition(0, 0);
      }

      const hasSpawnShield = (vt.flagsMask & 2) !== 0;
      const hasShieldPower = (vt.flagsMask & 4) !== 0;
      const hasSpeedPower = (vt.flagsMask & 8) !== 0;
      const hasUnlimited = (vt.flagsMask & 16) !== 0;
      const carryingFlag = (vt.flagsMask & 32) !== 0;

      const baseAlpha = isStealthed ? 0.45 : 1;
      vt.container.setAlpha(hasSpawnShield ? (Math.sin(this.time.now * 0.025) > 0 ? baseAlpha : 0.3) : baseAlpha);

      vt.shieldRing.clear();
      if (hasShieldPower) {
        const pulse = 0.78 + 0.22 * Math.sin(this.time.now * 0.012);
        vt.shieldRing.fillStyle(0x00b8ff, 0.18 * pulse);
        vt.shieldRing.fillCircle(0, 0, 36);
        vt.shieldRing.lineStyle(4, 0x7ce8ff, 0.95 * pulse);
        vt.shieldRing.strokeCircle(0, 0, 36);
        vt.shieldRing.lineStyle(2, 0xffffff, 0.55 * pulse);
        vt.shieldRing.strokeCircle(0, 0, 31);
      }

      vt.powerRing.clear();
      if (hasSpeedPower) {
        vt.powerRing.lineStyle(3, 0x00e5c3, 0.9);
        vt.powerRing.strokeCircle(0, 0, 31);
        if (this.quality !== 'low' && Math.random() < 0.35) {
          this.spawnParticles(vt.container.x, vt.container.y, 1, 0x00e5c3, 60, 0.22, 6);
        }
      } else if (hasUnlimited) {
        const firePulse = 0.75 + 0.25 * Math.sin(this.time.now * 0.016);
        vt.powerRing.lineStyle(3.5, 0xff6a2b, 0.92 * firePulse);
        vt.powerRing.strokeCircle(0, 0, 32);
        vt.powerRing.lineStyle(2, 0xffd166, 0.75 * firePulse);
        vt.powerRing.strokeCircle(0, 0, 28);
      }

      vt.carryFlag.clear();
      if (carryingFlag) {
        const enemyColor = vt.team === 'red' ? 0x3f6fe0 : 0xf23a12;
        vt.carryFlag.lineStyle(3, 0x00e5c3, 0.85);
        vt.carryFlag.strokeCircle(0, 0, 38);
        vt.carryFlag.fillStyle(enemyColor, 1);
        vt.carryFlag.fillTriangle(-6, -24, 14, -16, -6, -8);
      }

      vt.hpBarGfx.clear();
      const dmgPct = Number(this.ctx.settings.damagePct ?? 100);
      const s = this.worldScaleFactor * (TANK.radius / 24);
      if (vt.hp < 100 || dmgPct < 100) {
        const barW = 46 * s;
        const barH = 6 * s;
        const bx = vt.container.x - barW / 2;
        const by = vt.container.y - 31 * s;
        const ratio = Math.max(0, Math.min(1, vt.hp / 100));
        const fillCol = ratio > 0.6 ? 0x22c55e : ratio > 0.3 ? 0xf59e0b : 0xef4444;
        vt.hpBarGfx.fillStyle(0x0b111e, 0.92);
        vt.hpBarGfx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
        vt.hpBarGfx.lineStyle(1 * s, 0x334155, 0.9);
        vt.hpBarGfx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);
        if (ratio > 0) {
          vt.hpBarGfx.fillStyle(fillCol, 1);
          vt.hpBarGfx.fillRect(bx, by, Math.max(2, barW * ratio), barH);
        }
      }

      vt.nameTag.setPosition(vt.container.x, vt.container.y - 44 * s);
      if (vt.youLabel.visible) {
        vt.youLabel.setPosition(vt.container.x, vt.container.y - 64 * s);
      }
      if (crowded && selfVis && vt.id !== selfVis.id && vt.team !== selfVis.team) {
        const dist = Math.hypot(vt.container.x - selfVis.container.x, vt.container.y - selfVis.container.y);
        vt.nameTag.setAlpha(dist > 500 * s ? 0.4 : 0.9);
      } else {
        vt.nameTag.setAlpha(isStealthed ? 0.6 : 1);
      }
    }

    if (this.ctx.playMode === 'local-party' && this.ctx.localPlayers) {
      this.ctx.localPlayers.forEach((lp, i) => {
        const idx = this.playerIdToIdx.get(lp.id);
        const vt = idx !== undefined ? this.visualTanks.get(idx) : undefined;
        const txt = this.localPartyHudTexts[i];
        if (txt && vt) {
          txt.setText(vt.alive ? '' : String(Math.max(1, Math.ceil(vt.respawnTenths / 10))));
          txt.setVisible(!vt.alive);
        }
      });
    }
  }

  private despawnVisualShell(shellId: number, x: number, y: number): void {
    let idx = shellId > 0 ? this.visualShells.findIndex((s) => s.id === shellId) : -1;
    if (idx === -1 && Number.isFinite(x) && Number.isFinite(y)) {
      let bestDist = 110 * this.worldScaleFactor;
      for (let i = 0; i < this.visualShells.length; i++) {
        const d = Math.hypot(this.visualShells[i].x - x, this.visualShells[i].y - y);
        if (d < bestDist) {
          bestDist = d;
          idx = i;
        }
      }
    }
    if (idx !== -1) {
      const sh = this.visualShells[idx];
      sh.gfx.destroy();
      sh.trail.destroy();
      this.visualShells.splice(idx, 1);
    }
  }

  private updateVisualShells(dt: number): void {
    for (let i = this.visualShells.length - 1; i >= 0; i--) {
      const sh = this.visualShells[i];
      sh.life -= dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.gfx.setPosition(sh.x, sh.y);

      sh.trail.clear();
      if (sh.isFireball) {
        const tailX = sh.x - sh.vx * 0.065;
        const tailY = sh.y - sh.vy * 0.065;
        sh.trail.lineStyle(sh.radius * 1.45, 0xff5500, 0.55);
        sh.trail.lineBetween(tailX, tailY, sh.x, sh.y);
        sh.trail.lineStyle(sh.radius * 0.75, 0xfff3b0, 0.9);
        sh.trail.lineBetween(sh.x - sh.vx * 0.035, sh.y - sh.vy * 0.035, sh.x, sh.y);
      } else {
        const tailX = sh.x - sh.vx * 0.038;
        const tailY = sh.y - sh.vy * 0.038;
        sh.trail.lineStyle(sh.radius * 0.7, 0xf8fafc, 0.5);
        sh.trail.lineBetween(tailX, tailY, sh.x, sh.y);
      }

      if (
        sh.life <= 0 ||
        sh.x < 0 ||
        sh.x > this.stageW ||
        sh.y < 0 ||
        sh.y > this.stageH
      ) {
        sh.gfx.destroy();
        sh.trail.destroy();
        this.visualShells.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.gfx.setVisible(false);
        continue;
      }
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.gfx.rotation += p.vr * dt;
      p.gfx.setAlpha(p.life / p.maxLife);
    }
  }

  private drawAimAndTouchOverlays(): void {
    const inv = 1 / this.camZoom;
    if (this.aimRingGfx) {
      this.aimRingGfx.clear();
      if (!this.ctx.isSpectator && this.ctx.playMode !== 'local-party') {
        const selfIdx = this.playerIdToIdx.get(this.ctx.localPlayerId);
        const selfVis = selfIdx !== undefined ? this.visualTanks.get(selfIdx) : undefined;
        if (selfVis && selfVis.alive) {
          if (this.ctx.controlStyle === 'PC_MOUSE_STEER') {
            this.aimRingGfx.lineStyle(1.5 * inv, 0x00e5c3, 0.45);
            this.aimRingGfx.lineBetween(selfVis.container.x, selfVis.container.y, this.mouseStageX, this.mouseStageY);
            this.aimRingGfx.lineStyle(2.5 * inv, 0x00e5c3, 0.85);
            this.aimRingGfx.strokeCircle(this.mouseStageX, this.mouseStageY, 14 * inv);
          }
        }
      }
    }

    if (this.touchGfx) {
      this.touchGfx.clear();
      if (this.stickPointerId !== null) {
        const outerR = this.touchConfig.stickSize * 0.7 * inv;
        const innerR = 32 * inv;
        const alpha = Math.max(0.25, Math.min(0.95, this.touchConfig.opacity));
        this.touchGfx.fillStyle(0x0b111e, alpha * 0.32);
        this.touchGfx.fillCircle(this.stickOriginX, this.stickOriginY, outerR);
        this.touchGfx.lineStyle(2 * inv, 0xffffff, alpha * 0.75);
        this.touchGfx.strokeCircle(this.stickOriginX, this.stickOriginY, outerR);
        this.touchGfx.fillStyle(0xf8fafc, Math.min(0.82, alpha * 0.85));
        this.touchGfx.fillCircle(this.stickCurX, this.stickCurY, innerR);
        this.touchGfx.lineStyle(1.5 * inv, 0x0b111e, 0.55);
        this.touchGfx.strokeCircle(this.stickCurX, this.stickCurY, innerR);
      }
    }
  }

  private showBanner(text: string, sec: number): void {
    this.bannerText = text;
    this.bannerTimer = sec;
  }

  private emitHudState(): void {
    if (!this.ctx.onHudUpdate) return;
    const snap = this.latestSnap;
    const selfIdx = this.playerIdToIdx.get(this.ctx.localPlayerId);
    const selfVis = selfIdx !== undefined ? this.visualTanks.get(selfIdx) : undefined;
    const selfSim = this.localSim?.tanks.get(this.ctx.localPlayerId);

    const now = Date.now();
    this.killFeed = this.killFeed.filter((k) => now - k.ts < 3000);

    const scoreboard = Array.from(this.visualTanks.values()).map((vt) => {
      const sTank = this.localSim?.tanks.get(vt.id);
      return {
        id: vt.id,
        nickname: vt.nickname,
        colorId: this.ctx.players.find((p) => p.id === vt.id)?.colorId ?? 'red',
        team: vt.team,
        points: sTank?.points ?? 0,
        deaths: sTank?.deaths ?? 0,
        pingMs: sTank?.pingMs ?? 0,
        isSelf: vt.id === this.ctx.localPlayerId,
      };
    });

    const leaderPoints = scoreboard.reduce((m, s) => Math.max(m, s.points), 0);

    const hud: HudSnapshot = {
      mode: String(this.ctx.settings.mode ?? 'flag'),
      timeLeftSec: snap?.timeLeft ?? 180,
      suddenDeath: snap?.suddenDeath ?? false,
      scores: { red: snap?.scores[0] ?? 0, blue: snap?.scores[1] ?? 0 },
      myPoints: selfSim?.points ?? 0,
      leaderPoints,
      ammo: selfVis?.ammo ?? 5,
      ammoMax: Number(this.ctx.settings.ammoMax ?? TANK.ammo.max),
      ammoReloadPct: selfSim ? selfSim.ammoTimer / Math.max(0.1, this.localSim!.settings.ammoReturnSec) : 0,
      activePower: selfVis?.power ?? null,
      respawnSec: selfVis && !selfVis.alive ? Math.max(1, Math.ceil(selfVis.respawnTenths / 10)) : 0,
      flags: snap?.flags
        ? {
            red: {
              state: snap.flags.r[0] === 0 ? 'home' : snap.flags.r[0] === 1 ? 'carried' : 'dropped',
              carrierName: snap.flags.r[3] >= 0 ? this.visualTanks.get(snap.flags.r[3])?.nickname : undefined,
            },
            blue: {
              state: snap.flags.b[0] === 0 ? 'home' : snap.flags.b[0] === 1 ? 'carried' : 'dropped',
              carrierName: snap.flags.b[3] >= 0 ? this.visualTanks.get(snap.flags.b[3])?.nickname : undefined,
            },
          }
        : null,
      killFeed: [...this.killFeed],
      scoreboard,
      bannerText: this.bannerText,
      fps: this.lastFps,
    };

    if (this.debugText) {
      this.debugText.setText(
        `FPS: ${this.lastFps} | Map: ${this.mapData.id} (${this.stageW}x${this.stageH}) | Tanks: ${this.visualTanks.size} | F3: Overlay ${this.debugOverlayVisible ? 'ON' : 'OFF'}`,
      );
    }

    this.ctx.onHudUpdate(hud);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public setControlStyle(styleId: string): void {
    this.ctx.controlStyle = styleId;
    this.pcBindings = SettingsStore.getPcBindings();
  }

  public setTouchConfig(cfg: Partial<TouchConfig>): void {
    this.touchConfig = { ...this.touchConfig, ...cfg };
  }

  public triggerExternalFire(): void {
    this.triggerFireShot();
  }
}
