import type { MatchAward, MatchResult, PlayerMatchStat, RoomPlayer, TeamId } from '../../../platform/shared/types.ts';
import { SeededRandom } from '../../../platform/shared/seededRandom.ts';
import {
  clampNum,
  normalizeInput,
  resolveAutoScale,
  TANK,
  type TankControlStyleGroup,
  type TankInputObj,
} from './config.ts';
import {
  circleIntersectsCircle,
  circleIntersectsRect,
  getBrickRect,
  resolveMapId,
  TANK_MAPS,
  validateMap,
} from './maps/maps.ts';
import type { Circle, EruptionVent, MapData, Rect } from './maps/types.ts';
import { buildSpawnPools, pickBestSpawnIndex, type SpawnPools } from './spawnPool.ts';

export type TankModeId = 'flag' | 'team-fight' | 'ffa';
export type PowerType = 'speed' | 'shield' | 'unlimited';

export interface SimTank {
  id: string;
  idx: number;
  nickname: string;
  colorId: string;
  team: TeamId;
  isBot: boolean;
  botDifficulty: string;
  styleGroup: TankControlStyleGroup;
  controlStyleId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  ammo: number;
  ammoTimer: number;
  cooldownTimer: number;
  respawnTimer: number;
  spawnWaitTimer: number;
  spawnShieldTimer: number;
  recoilRemainingDeg: number;
  recoilTimer: number;
  recoilDir: 1 | -1;
  activePower: PowerType | null;
  powerTimer: number;
  lastFireSeq: number;
  lastInputTick: number;
  lastSpawnIdx: number | null;
  isAfk: boolean;
  isDisconnected: boolean;
  joinedLateTagTimer: number;
  // Arena Series environmental state
  inBush: boolean;
  stealth: boolean;
  fireRevealTimer: number;
  hazardAccum: number;
  knockVx: number;
  knockVy: number;
  // Stats
  points: number;
  deaths: number;
  shotsFired: number;
  hits: number;
  flagsPicked: number;
  captures: number;
  returns: number;
  powersCollected: number;
  pingMs: number;
}

export interface SimShell {
  id: number;
  ownerId: string;
  ownerIdx: number;
  team: TeamId;
  colorId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  lifeLeft: number;
  ricochetsLeft: number;
  isFireball: boolean;
}

export interface SimBrick {
  id: number;
  rect: Rect;
  hp: number; // 2 -> 1 -> 0
  vertical: boolean;
}

export interface SimCrate {
  id: number;
  x: number;
  y: number;
  alive: boolean;
  droppedPower: PowerType | null;
  droppedPowerTimer: number;
}

export interface SimPowerBox {
  id: number;
  x: number;
  y: number;
  power: PowerType;
  active: boolean;
  respawnTimer: number;
}

export interface SimBarrel {
  id: number;
  x: number;
  y: number;
  alive: boolean;
  respawnTimer: number;
}

export interface SimVentState {
  def: EruptionVent;
  phaseSec: number;
  state: 0 | 1 | 2; // 0 = idle, 1 = warn glow, 2 = erupting
  eruptedThisCycle: boolean;
}

export interface SimFlag {
  team: 'red' | 'blue';
  state: 'home' | 'carried' | 'dropped';
  homeX: number;
  homeY: number;
  padX: number;
  padY: number;
  x: number;
  y: number;
  carrierId: string | null;
  returnTimer: number;
}

export interface SimSettings {
  mode: TankModeId;
  mapId: MapData['id'];
  timeLimitSec: number;
  targetScore: number;
  hitsToDestroy: number;
  damagePct: number;
  ammoMax: number;
  ammoReturnSec: number;
  tankSpeedPct: number;
  shellRicochets: number;
  bricksBreakable: boolean;
  powerBoxesMode: 'off' | 'few' | 'normal' | 'many';
  allowedPowers: PowerType[];
  friendlyFire: boolean;
  strictFlagHome: boolean;
  flagReturnSec: number;
  carrierSpeedPct: number;
  recoilEnabled: boolean;
  recoilAngleDeg: number;
  arcadeTurnAssist: boolean;
  afkRemoval: boolean;
  controlStylesAllowed: 'all' | 'standard-only';
  aimAssistAllowed: boolean;
}

export interface SimEvent {
  t: number;
  type:
    | 'shot'
    | 'dryClick'
    | 'brickHit'
    | 'brickBreak'
    | 'crateBreak'
    | 'barrelExplode'
    | 'ventErupt'
    | 'shellWall'
    | 'tankHit'
    | 'tankKill'
    | 'respawn'
    | 'powerPickup'
    | 'shieldPop'
    | 'flagPickup'
    | 'flagDrop'
    | 'flagReturn'
    | 'flagCapture'
    | 'suddenDeath'
    | 'afkSpectator'
    | 'lateJoin';
  data: Record<string, unknown>;
}

export interface CompactSnapshot {
  tick: number;
  timeLeft: number;
  suddenDeath: boolean;
  scores: [number, number];
  /** [idx, x, y, angle, flagsBitmask(256=bushStealth), ammo, powerCode, hp, respawnTenths] */
  tanks: Array<[number, number, number, number, number, number, number, number, number]>;
  /** red & blue flag: [stateCode(0=home,1=carried,2=dropped), x, y, carrierIdx] */
  flags: {
    r: [number, number, number, number];
    b: [number, number, number, number];
  } | null;
  /** 0 = hidden/respawning, 1 = speed, 2 = shield, 3 = unlimited (fireball) */
  boxes: number[];
  /** crate power drops: [id, x, y, powerCode] */
  drops: Array<[number, number, number, number]>;
  /** barrel states: 1 = active, 0 = exploded */
  barrels?: number[];
  /** eruption vents: [state(0=idle,1=warn,2=erupt), phaseTenths] */
  vents?: Array<[number, number]>;
}

function powerToCode(p: PowerType | null): number {
  if (p === 'speed') return 1;
  if (p === 'shield') return 2;
  if (p === 'unlimited') return 3;
  return 0;
}

export function codeToPower(code: number): PowerType | null {
  if (code === 1) return 'speed';
  if (code === 2) return 'shield';
  if (code === 3) return 'unlimited';
  return null;
}

export function resolveControlGroup(styleId: string): TankControlStyleGroup {
  if (styleId.includes('STANDARD') || styleId === 'PC_STANDARD' || styleId === 'TOUCH_TANK_PAD') {
    return 'STANDARD';
  }
  if (styleId.includes('STEER') || styleId === 'PC_MOUSE_STEER' || styleId === 'PAD_STEER' || styleId === 'STEER_TWIN_THUMB') {
    return 'STEER';
  }
  return 'ARCADE';
}

function shortestAngleDiff(fromDeg: number, toDeg: number): number {
  let diff = ((toDeg - fromDeg + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

export class TankArenaSim {
  public readonly map: MapData;
  public readonly stageW: number;
  public readonly stageH: number;
  public readonly worldScaleFactor: number;
  public readonly tankRadius: number;
  public readonly shellRadius: number;
  public readonly shellSpeed: number;
  public readonly fireballRadius: number;
  public readonly fireballSpeed: number;
  public readonly shellLifeSec: number;
  public readonly captureRadius: number;
  public readonly settings: SimSettings;
  public readonly rng: SeededRandom;
  public readonly spawnPools: SpawnPools;
  public readonly tanks: Map<string, SimTank> = new Map();
  public readonly tankOrder: SimTank[] = [];
  public readonly inputs: Map<string, TankInputObj> = new Map();
  public readonly shells: SimShell[] = [];
  public readonly bricks: SimBrick[] = [];
  public readonly crates: SimCrate[] = [];
  public readonly powerBoxes: SimPowerBox[] = [];
  public readonly barrels: SimBarrel[] = [];
  public readonly vents: SimVentState[] = [];
  public flags: { red: SimFlag; blue: SimFlag } | null = null;

  public tickCount = 0;
  public elapsedSec = 0;
  public timeLeftSec = 180;
  public inSuddenDeath = false;
  public teamScores = { red: 0, blue: 0 };
  public finishedResult: MatchResult | null = null;
  public pendingEvents: SimEvent[] = [];

  private nextShellId = 1;
  private startTimeScalePlayerCount: number;
  private removedStats: PlayerMatchStat[] = [];

  constructor(
    players: RoomPlayer[],
    rawSettings: Record<string, unknown>,
    seed: number,
    isLocalParty = false,
  ) {
    this.rng = new SeededRandom(seed);
    const activePlayers = players.filter((p) => !p.isSpectator);
    this.startTimeScalePlayerCount = Math.max(2, activePlayers.length);

    const mode = (['flag', 'team-fight', 'ffa'].includes(String(rawSettings.mode))
      ? String(rawSettings.mode)
      : 'flag') as TankModeId;

    const mapId = resolveMapId(String(rawSettings.map ?? 'auto'), mode, this.startTimeScalePlayerCount);
    this.map = TANK_MAPS[mapId];

    const stage = this.map.stage ?? TANK.stage;
    this.stageW = stage.w;
    this.stageH = stage.h;
    this.worldScaleFactor = this.map.tankScale ?? 1;
    this.tankRadius = Math.round(TANK.radius * this.worldScaleFactor);
    this.shellRadius = Math.round(TANK.shell.radius * (this.worldScaleFactor > 1 ? 1.35 : 1));
    this.shellSpeed = Math.round(TANK.shell.speed * this.worldScaleFactor);
    this.fireballRadius = Math.round(TANK.shell.fireballRadius * (this.worldScaleFactor > 1 ? 1.45 : 1.15));
    this.fireballSpeed = Math.round(TANK.shell.fireballSpeed * this.worldScaleFactor);
    this.shellLifeSec = this.worldScaleFactor > 1 ? 2.2 : TANK.shell.lifeSec;
    this.captureRadius = this.map.captureRadius ?? TANK.radius + 30;

    const mapErrors = validateMap(this.map);
    if (mapErrors.length > 0) {
      console.error('[TankArena] Map validation issues:', mapErrors);
    }

    const auto = resolveAutoScale(this.startTimeScalePlayerCount);
    const rawTime = rawSettings.timeLimit;
    const timeLimitSec =
      rawTime === 'auto' || rawTime === undefined
        ? auto.timeSec
        : clampNum(Number(rawTime) || auto.timeSec, 60, 600);

    const rawPoints = mode === 'flag' ? rawSettings.capturesToWin : rawSettings.pointsToWin;
    const targetScore =
      rawPoints === 'auto' || rawPoints === undefined
        ? mode === 'flag'
          ? auto.captures
          : auto.points
        : clampNum(Number(rawPoints) || (mode === 'flag' ? auto.captures : auto.points), 1, 30);

    const allowedPowersRaw = Array.isArray(rawSettings.allowedPowers)
      ? (rawSettings.allowedPowers as PowerType[]).filter((p) => ['speed', 'shield', 'unlimited'].includes(p))
      : (['speed', 'shield', 'unlimited'] as PowerType[]);

    const powerBoxesMode = (['off', 'few', 'normal', 'many'].includes(String(rawSettings.powerBoxes))
      ? String(rawSettings.powerBoxes)
      : 'normal') as SimSettings['powerBoxesMode'];

    const rawDamagePct = rawSettings.damagePct;
    const damagePct =
      rawDamagePct !== undefined
        ? clampNum(Number(rawDamagePct) || 100, 10, 100)
        : Number(rawSettings.hitsToDestroy ?? 1) === 2
          ? 50
          : 100;

    this.settings = {
      mode,
      mapId,
      timeLimitSec,
      targetScore,
      hitsToDestroy: Math.ceil(100 / damagePct),
      damagePct,
      ammoMax: clampNum(Number(rawSettings.ammoMax ?? TANK.ammo.max), 3, 8),
      ammoReturnSec: clampNum(Number(rawSettings.ammoReturnSec ?? TANK.ammo.returnSec), 0.8, 3.0),
      tankSpeedPct: clampNum(Number(rawSettings.tankSpeedPct ?? 100), 80, 130),
      shellRicochets: clampNum(Number(rawSettings.shellRicochets ?? 0), 0, 2),
      bricksBreakable: rawSettings.bricksBreakable !== false,
      powerBoxesMode,
      allowedPowers: allowedPowersRaw.length > 0 ? allowedPowersRaw : ['speed', 'shield', 'unlimited'],
      friendlyFire: mode === 'ffa' ? true : Boolean(rawSettings.friendlyFire ?? false),
      strictFlagHome: this.map.strictFlagHomeDefault ? true : Boolean(rawSettings.strictFlagHome ?? false),
      flagReturnSec: clampNum(Number(rawSettings.flagReturnSec ?? TANK.flagReturnSec), 5, 20),
      carrierSpeedPct: clampNum(Number(rawSettings.carrierSpeedPct ?? TANK.carrierSpeedPct), 70, 100),
      recoilEnabled: rawSettings.recoilEnabled !== false,
      recoilAngleDeg: clampNum(Number(rawSettings.recoilAngleDeg ?? TANK.recoil.angleDeg), 15, 45),
      arcadeTurnAssist: isLocalParty ? false : rawSettings.arcadeTurnAssist !== false,
      afkRemoval: rawSettings.afkRemoval !== false,
      controlStylesAllowed: rawSettings.controlStylesAllowed === 'standard-only' ? 'standard-only' : 'all',
      aimAssistAllowed: rawSettings.aimAssistAllowed !== false,
    };

    this.timeLeftSec = this.settings.timeLimitSec;
    this.spawnPools = buildSpawnPools(this.map, seed);

    // Initialize bricks
    this.map.bricks.forEach((b, i) => {
      this.bricks.push({
        id: i,
        rect: getBrickRect(b),
        hp: 2,
        vertical: Boolean(b.vertical),
      });
    });

    // Initialize crates
    this.map.crates.forEach((c, i) => {
      this.crates.push({
        id: i,
        x: c.x,
        y: c.y,
        alive: true,
        droppedPower: null,
        droppedPowerTimer: 0,
      });
    });

    // Initialize explosive barrels (Arena Series)
    (this.map.barrels ?? []).forEach((b, i) => {
      this.barrels.push({
        id: i,
        x: b.x,
        y: b.y,
        alive: true,
        respawnTimer: 0,
      });
    });

    // Initialize eruption vents
    (this.map.eruptionVents ?? []).forEach((v) => {
      this.vents.push({
        def: v,
        phaseSec: 0,
        state: 0,
        eruptedThisCycle: false,
      });
    });

    // Initialize power boxes based on powerBoxesMode (balanced across Shield, Speed 2x, Fireball)
    if (this.settings.powerBoxesMode !== 'off') {
      const boxes = [...this.map.powerBoxes];
      if (this.settings.powerBoxesMode === 'many' && boxes.length < 4) {
        boxes.push({ x: this.stageW / 2, y: 120 * this.worldScaleFactor }, { x: this.stageW / 2, y: this.stageH - 120 * this.worldScaleFactor });
      }
      const orderedPowers: PowerType[] = (['shield', 'speed', 'unlimited'] as PowerType[]).filter((p) =>
        this.settings.allowedPowers.includes(p),
      );
      const pool = orderedPowers.length > 0 ? orderedPowers : (['shield', 'speed', 'unlimited'] as PowerType[]);
      const limit =
        this.settings.powerBoxesMode === 'few'
          ? Math.min(3, boxes.length)
          : this.settings.powerBoxesMode === 'normal'
            ? Math.min(boxes.length, this.map.series === 'arena-series' ? 6 : boxes.length)
            : boxes.length;
      for (let i = 0; i < limit; i++) {
        this.powerBoxes.push({
          id: i,
          x: boxes[i].x,
          y: boxes[i].y,
          power: pool[i % pool.length],
          active: true,
          respawnTimer: 0,
        });
      }
    }

    // Initialize flags if Flag mode and map has flags
    if (this.settings.mode === 'flag' && this.map.flags) {
      this.flags = {
        red: {
          team: 'red',
          state: 'home',
          homeX: this.map.flags.red.flag.x,
          homeY: this.map.flags.red.flag.y,
          padX: this.map.flags.red.pad.x,
          padY: this.map.flags.red.pad.y,
          x: this.map.flags.red.flag.x,
          y: this.map.flags.red.flag.y,
          carrierId: null,
          returnTimer: 0,
        },
        blue: {
          team: 'blue',
          state: 'home',
          homeX: this.map.flags.blue.flag.x,
          homeY: this.map.flags.blue.flag.y,
          padX: this.map.flags.blue.pad.x,
          padY: this.map.flags.blue.pad.y,
          x: this.map.flags.blue.flag.x,
          y: this.map.flags.blue.flag.y,
          carrierId: null,
          returnTimer: 0,
        },
      };
    }

    // Spawn initial active players
    activePlayers.forEach((p, i) => {
      this.addTank(p, i, false);
    });
  }

  public addTank(player: RoomPlayer, forcedIdx?: number, isLateJoin = false): SimTank {
    const idx = forcedIdx ?? this.tankOrder.length;
    const team: TeamId = this.settings.mode === 'ffa' ? 'ffa' : player.team === 'blue' ? 'blue' : 'red';
    const pool = team === 'ffa' ? this.spawnPools.ffa : this.spawnPools[team];
    const spawnIdx =
      idx < pool.length
        ? idx
        : pickBestSpawnIndex(pool, this.tankOrder, player.id, team, null, TANK.spawnPool.tankClearPx * this.worldScaleFactor);
    const pt = pool[spawnIdx % pool.length] ?? { x: this.stageW / 2, y: this.stageH / 2, angle: 0 };

    const styleId =
      this.settings.controlStylesAllowed === 'standard-only' ? 'PC_STANDARD' : player.controlStyle;

    const tank: SimTank = {
      id: player.id,
      idx,
      nickname: player.nickname,
      colorId: player.colorId,
      team,
      isBot: player.isBot,
      botDifficulty: player.botDifficulty ?? 'medium',
      styleGroup: player.isBot ? 'STEER' : resolveControlGroup(styleId),
      controlStyleId: styleId,
      x: pt.x,
      y: pt.y,
      vx: 0,
      vy: 0,
      speed: 0,
      angle: pt.angle,
      alive: true,
      hp: 100,
      maxHp: 100,
      ammo: this.settings.ammoMax,
      ammoTimer: 0,
      cooldownTimer: 0,
      respawnTimer: 0,
      spawnWaitTimer: 0,
      spawnShieldTimer: TANK.spawnShieldSec,
      recoilRemainingDeg: 0,
      recoilTimer: 0,
      recoilDir: 1,
      activePower: null,
      powerTimer: 0,
      lastFireSeq: 0,
      lastInputTick: this.tickCount,
      lastSpawnIdx: spawnIdx,
      isAfk: false,
      isDisconnected: false,
      joinedLateTagTimer: isLateJoin ? 3 : 0,
      inBush: false,
      stealth: false,
      fireRevealTimer: 0,
      hazardAccum: 0,
      knockVx: 0,
      knockVy: 0,
      points: 0,
      deaths: 0,
      shotsFired: 0,
      hits: 0,
      flagsPicked: 0,
      captures: 0,
      returns: 0,
      powersCollected: 0,
      pingMs: player.pingMs,
    };

    this.tanks.set(tank.id, tank);
    this.tankOrder.push(tank);
    this.inputs.set(tank.id, { seq: 0, throttle: 0, turn: 0, heading: null, fire: 0 });
    return tank;
  }

  public removeTank(playerId: string, keepStat = true): void {
    const tank = this.tanks.get(playerId);
    if (!tank) return;
    this.dropCarriedFlag(tank);
    if (keepStat) {
      this.removedStats.push(this.buildStatForTank(tank, true));
    }
    this.tanks.delete(playerId);
    const ordIdx = this.tankOrder.findIndex((t) => t.id === playerId);
    if (ordIdx !== -1) this.tankOrder.splice(ordIdx, 1);
    this.inputs.delete(playerId);
  }

  public setDisconnected(playerId: string, disconnected: boolean): void {
    const tank = this.tanks.get(playerId);
    if (!tank) return;
    tank.isDisconnected = disconnected;
    if (disconnected) {
      this.dropCarriedFlag(tank);
      this.inputs.set(playerId, { seq: 0, throttle: 0, turn: 0, heading: null, fire: tank.lastFireSeq });
    }
  }

  public setControlStyle(playerId: string, styleId: string): void {
    const tank = this.tanks.get(playerId);
    if (!tank) return;
    const validStyle = this.settings.controlStylesAllowed === 'standard-only' ? 'PC_STANDARD' : styleId;
    tank.controlStyleId = validStyle;
    tank.styleGroup = resolveControlGroup(validStyle);
  }

  public canLateJoin(): boolean {
    if (this.finishedResult || this.inSuddenDeath) return false;
    const pctElapsed = (this.elapsedSec / Math.max(1, this.settings.timeLimitSec)) * 100;
    return pctElapsed <= TANK.lateJoinUntilPct;
  }

  public applyInput(playerId: string, rawPayload: unknown): void {
    const tank = this.tanks.get(playerId);
    if (!tank || tank.isDisconnected) return;
    const inp = normalizeInput(rawPayload);
    const prev = this.inputs.get(playerId);
    if (prev && inp.seq !== 0 && inp.seq < prev.seq) return;
    if (inp.throttle !== 0 || inp.turn !== 0 || inp.fire !== (prev?.fire ?? 0) || inp.heading !== null) {
      tank.lastInputTick = this.tickCount;
      if (tank.isAfk) tank.isAfk = false;
    }
    this.inputs.set(playerId, inp);
  }

  public tick(dt: number = 1 / TANK.tickRate): void {
    if (this.finishedResult) return;

    this.tickCount += 1;
    this.elapsedSec += dt;

    // Timer & Sudden Death
    this.timeLeftSec = Math.max(0, this.timeLeftSec - dt);
    if (this.timeLeftSec <= 0 && !this.inSuddenDeath) {
      this.handleTimeUp();
      if (this.finishedResult) return;
    } else if (this.inSuddenDeath && this.timeLeftSec <= 0) {
      this.finishMatch('draw', 'Draw');
      return;
    }

    const solidRects = this.getSolidRects();
    const solidCircles = this.map.solidCircles ?? [];
    const deathsThisTick: Array<{ victim: SimTank; killer: SimTank | null }> = [];

    // Update crate dropped powers
    for (const c of this.crates) {
      if (c.droppedPower) {
        c.droppedPowerTimer -= dt;
        if (c.droppedPowerTimer <= 0) {
          c.droppedPower = null;
        }
      }
    }

    // Update explosive barrels respawn
    for (const barrel of this.barrels) {
      if (!barrel.alive) {
        barrel.respawnTimer -= dt;
        if (barrel.respawnTimer <= 0) {
          barrel.alive = true;
          barrel.respawnTimer = 0;
        }
      }
    }

    // Update power boxes (cycle between Shield, Speed 2x, and Fireball when respawning)
    for (const box of this.powerBoxes) {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.respawnTimer = 0;
          const ordered: PowerType[] = (['shield', 'speed', 'unlimited'] as PowerType[]).filter((p) =>
            this.settings.allowedPowers.includes(p),
          );
          if (ordered.length > 0) {
            const curIdx = ordered.indexOf(box.power);
            box.power = ordered[(curIdx + 1) % ordered.length];
          }
        }
      }
    }

    // Update flags return timers
    if (this.flags) {
      for (const teamKey of ['red', 'blue'] as const) {
        const flag = this.flags[teamKey];
        if (flag.state === 'dropped') {
          flag.returnTimer -= dt;
          if (flag.returnTimer <= 0) {
            this.returnFlagHome(flag, null);
          }
        }
      }
    }

    // Update eruption vents (6s cycle: 1s glow warning -> erupt dmg + knockback)
    for (const vent of this.vents) {
      vent.phaseSec += dt;
      if (vent.phaseSec >= vent.def.cycleSec) {
        vent.phaseSec -= vent.def.cycleSec;
        vent.eruptedThisCycle = false;
      }
      const warnStart = vent.def.cycleSec - vent.def.warnSec - vent.def.eruptSec;
      const eruptStart = vent.def.cycleSec - vent.def.eruptSec;
      if (vent.phaseSec >= eruptStart) {
        vent.state = 2;
        if (!vent.eruptedThisCycle) {
          vent.eruptedThisCycle = true;
          this.triggerVentEruption(vent, deathsThisTick);
        }
      } else if (vent.phaseSec >= warnStart) {
        vent.state = 1;
      } else {
        vent.state = 0;
      }
    }

    // Update tanks
    for (const tank of this.tankOrder) {
      if (tank.joinedLateTagTimer > 0) {
        tank.joinedLateTagTimer = Math.max(0, tank.joinedLateTagTimer - dt);
      }

      if (!tank.isBot && !tank.isDisconnected && this.settings.afkRemoval) {
        const idleSec = (this.tickCount - tank.lastInputTick) / TANK.tickRate;
        if (idleSec >= TANK.afk.warnSec && !tank.isAfk) {
          tank.isAfk = true;
        }
        if (idleSec >= TANK.afk.specSec) {
          this.dropCarriedFlag(tank);
          this.emit('afkSpectator', { playerId: tank.id, nickname: tank.nickname });
        }
      }

      if (!tank.alive) {
        tank.respawnTimer -= dt;
        if (tank.respawnTimer <= 0) {
          this.tryRespawnTank(tank, dt);
        }
        continue;
      }

      if (tank.ammo < this.settings.ammoMax) {
        tank.ammoTimer += dt;
        if (tank.ammoTimer >= this.settings.ammoReturnSec) {
          tank.ammoTimer -= this.settings.ammoReturnSec;
          tank.ammo += 1;
        }
      } else {
        tank.ammoTimer = 0;
      }

      if (tank.cooldownTimer > 0) tank.cooldownTimer = Math.max(0, tank.cooldownTimer - dt);
      if (tank.spawnShieldTimer > 0) tank.spawnShieldTimer = Math.max(0, tank.spawnShieldTimer - dt);
      if (tank.fireRevealTimer > 0) tank.fireRevealTimer = Math.max(0, tank.fireRevealTimer - dt);

      if (tank.activePower) {
        tank.powerTimer -= dt;
        if (tank.powerTimer <= 0) {
          tank.activePower = null;
          tank.powerTimer = 0;
        }
      }

      const inp = this.inputs.get(tank.id) ?? { seq: 0, throttle: 0, turn: 0, heading: null, fire: tank.lastFireSeq };

      // Process recoil turn (ARCADE)
      if (tank.recoilTimer > 0) {
        const stepFrac = Math.min(dt, tank.recoilTimer) / TANK.recoil.durationSec;
        const deltaDeg = tank.recoilDir * this.settings.recoilAngleDeg * stepFrac;
        tank.angle = (tank.angle + deltaDeg + 360) % 360;
        tank.recoilTimer = Math.max(0, tank.recoilTimer - dt);
      }

      // Movement & Rotation per style + Ice + Speed Zones + Knockback
      this.stepTankMovement(tank, inp, dt, solidRects, solidCircles);

      // Update Bush Stealth status
      tank.inBush = this.isPointInBush(tank.x, tank.y);
      tank.stealth = tank.alive && tank.inBush && tank.fireRevealTimer <= 0 && !this.isCarryingFlag(tank);

      // Lava hazard damage (8 dmg/s)
      this.applyLavaHazardDamage(tank, dt, deathsThisTick);

      // Fire handling
      if (tank.alive && inp.fire > tank.lastFireSeq) {
        tank.lastFireSeq = inp.fire;
        this.tryFireTank(tank);
      }
    }

    // Tank vs Tank separation
    this.resolveTankVsTank(solidRects, solidCircles);

    // Pickups & Flags
    for (const tank of this.tankOrder) {
      if (!tank.alive || tank.isDisconnected) continue;
      this.checkTankPickups(tank);
      this.checkTankFlags(tank);
    }

    // Update shells & detect kills + barrel explosions
    this.stepShells(dt, solidRects, solidCircles, deathsThisTick);

    // Apply kills & scoring
    if (deathsThisTick.length > 0) {
      this.processDeaths(deathsThisTick);
    }

    // Check win limits
    this.checkWinConditions();
  }

  private triggerVentEruption(
    vent: SimVentState,
    deathsThisTick: Array<{ victim: SimTank; killer: SimTank | null }>,
  ): void {
    this.emit('ventErupt', { x: vent.def.x, y: vent.def.y, r: vent.def.r });
    const hitR = vent.def.r + this.tankRadius * 0.7;
    for (const tank of this.tankOrder) {
      if (!tank.alive || tank.isDisconnected) continue;
      const dx = tank.x - vent.def.x;
      const dy = tank.y - vent.def.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= hitR * hitR) {
        const dist = Math.sqrt(distSq) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        tank.knockVx += nx * vent.def.knockback;
        tank.knockVy += ny * vent.def.knockback;

        if (tank.spawnShieldTimer > 0 || tank.activePower === 'shield') {
          this.emit('shieldPop', { playerId: tank.id, x: Math.round(tank.x), y: Math.round(tank.y), spawn: tank.spawnShieldTimer > 0 });
          continue;
        }
        tank.hp = Math.max(0, tank.hp - vent.def.damage);
        if (tank.hp <= 0) {
          deathsThisTick.push({ victim: tank, killer: null });
        } else {
          this.emit('tankHit', {
            playerId: tank.id,
            playerIdx: tank.idx,
            x: Math.round(tank.x),
            y: Math.round(tank.y),
            hp: tank.hp,
            maxHp: tank.maxHp,
            damage: vent.def.damage,
          });
        }
      }
    }
  }

  private applyLavaHazardDamage(
    tank: SimTank,
    dt: number,
    deathsThisTick: Array<{ victim: SimTank; killer: SimTank | null }>,
  ): void {
    const hazards = this.map.hazardZones;
    if (!hazards || hazards.length === 0 || !tank.alive) return;
    let activeDps = 0;
    for (const hz of hazards) {
      const dx = tank.x - hz.x;
      const dy = tank.y - hz.y;
      const r = hz.r + this.tankRadius * 0.35;
      if (dx * dx + dy * dy <= r * r) {
        activeDps = Math.max(activeDps, hz.dps);
      }
    }
    if (activeDps <= 0) {
      tank.hazardAccum = 0;
      return;
    }
    if (tank.spawnShieldTimer > 0 || tank.activePower === 'shield') return;

    tank.hazardAccum += activeDps * dt;
    if (tank.hazardAccum >= 1) {
      const whole = Math.floor(tank.hazardAccum);
      tank.hazardAccum -= whole;
      tank.hp = Math.max(0, tank.hp - whole);
      if (tank.hp <= 0) {
        deathsThisTick.push({ victim: tank, killer: null });
      }
    }
  }

  private isPointInBush(x: number, y: number): boolean {
    const bushes = this.map.bushZones;
    if (!bushes || bushes.length === 0) return false;
    for (const b of bushes) {
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) return true;
    }
    return false;
  }

  private isOnIce(x: number, y: number): boolean {
    const ice = this.map.iceWorld;
    if (!ice?.enabled) return false;
    for (const sc of ice.safeCircles) {
      const dx = x - sc.x;
      const dy = y - sc.y;
      if (dx * dx + dy * dy <= sc.r * sc.r) return false;
    }
    for (const sr of ice.safeRects) {
      if (x >= sr.x && x <= sr.x + sr.w && y >= sr.y && y <= sr.y + sr.h) return false;
    }
    return true;
  }

  private getTerrainSpeedMult(x: number, y: number): number {
    const zones = this.map.speedZones;
    if (!zones || zones.length === 0) return 1;
    let mult = 1;
    for (const z of zones) {
      const dx = x - z.x;
      const dy = y - z.y;
      if (dx * dx + dy * dy <= z.r * z.r) {
        mult = Math.min(mult, z.mult);
      }
    }
    return mult;
  }

  private stepTankMovement(
    tank: SimTank,
    inp: TankInputObj,
    dt: number,
    solidRects: Rect[],
    solidCircles: Circle[],
  ): void {
    const terrainMult = this.getTerrainSpeedMult(tank.x, tank.y);
    const onIce = this.isOnIce(tank.x, tank.y);
    const baseSpeed = TANK.speed * this.worldScaleFactor * (this.settings.tankSpeedPct / 100) * terrainMult;
    const powerSpeedMult = tank.activePower === 'speed' ? TANK.powers.speed.mult : 1;
    const isCarryingFlag = this.isCarryingFlag(tank);
    const carrierMult = isCarryingFlag ? this.settings.carrierSpeedPct / 100 : 1;
    const maxForward = baseSpeed * powerSpeedMult * carrierMult;
    const maxReverse =
      TANK.reverseSpeed * this.worldScaleFactor * (this.settings.tankSpeedPct / 100) * terrainMult * powerSpeedMult * carrierMult;

    const steerRateScale = onIce ? 1 - (this.map.iceWorld?.steerLag ?? 0.22) : 1;
    let targetSpeed = 0;

    if (tank.isDisconnected) {
      targetSpeed = 0;
    } else if (tank.styleGroup === 'ARCADE') {
      if (inp.throttle > 0.1) {
        // Hold Space (or drive button): pause auto-rotation and move forward in facing direction
        targetSpeed = maxForward;
      } else {
        // Idle: tank rotates continuously on its own in current spin direction
        targetSpeed = 0;
        tank.angle = (tank.angle + tank.recoilDir * TANK.turnRate.arcadeSpin * steerRateScale * dt + 360) % 360;
      }
    } else if (tank.styleGroup === 'STANDARD') {
      if (inp.throttle > 0.05) {
        targetSpeed = maxForward * clampNum(inp.throttle, 0, 1);
      } else if (inp.throttle < -0.05) {
        targetSpeed = -maxReverse * clampNum(Math.abs(inp.throttle), 0, 1);
      }
      if (Math.abs(inp.turn) > 0.05) {
        tank.angle = (tank.angle + inp.turn * TANK.turnRate.standard * steerRateScale * dt + 360) % 360;
      }
    } else {
      let speedScale = clampNum(inp.throttle, 0, 1);
      if (inp.heading !== null) {
        const diff = shortestAngleDiff(tank.angle, inp.heading);
        const maxTurn = TANK.turnRate.steer * steerRateScale * dt;
        if (Math.abs(diff) <= maxTurn) {
          tank.angle = inp.heading;
        } else {
          tank.angle = (tank.angle + Math.sign(diff) * maxTurn + 360) % 360;
        }
        if (Math.abs(diff) > TANK.steerPivotAngle) {
          speedScale *= TANK.steerPivotSpeedScale;
        }
      }
      targetSpeed = maxForward * speedScale;
    }

    const rad = (tank.angle * Math.PI) / 180;
    const desiredVx = Math.cos(rad) * targetSpeed;
    const desiredVy = Math.sin(rad) * targetSpeed;

    if (onIce) {
      // Ice physics: low friction slide preserving momentum + gentle thrust alignment
      const friction = this.map.iceWorld?.friction ?? 0.3;
      const blend = Math.min(1, friction * dt * 6.5);
      tank.vx += (desiredVx - tank.vx) * blend;
      tank.vy += (desiredVy - tank.vy) * blend;
      tank.speed = Math.hypot(tank.vx, tank.vy);
    } else {
      const accelRate = maxForward / TANK.accelSec;
      const brakeRate = maxForward / TANK.brakeSec;
      if (tank.speed < targetSpeed) {
        tank.speed = Math.min(targetSpeed, tank.speed + accelRate * dt);
      } else if (tank.speed > targetSpeed) {
        tank.speed = Math.max(targetSpeed, tank.speed - brakeRate * dt);
      }
      tank.vx = Math.cos(rad) * tank.speed;
      tank.vy = Math.sin(rad) * tank.speed;
    }

    // Decay any environmental knockback
    if (Math.abs(tank.knockVx) > 1 || Math.abs(tank.knockVy) > 1) {
      tank.x += tank.knockVx * dt;
      tank.y += tank.knockVy * dt;
      const decay = Math.max(0, 1 - dt * 5.5);
      tank.knockVx *= decay;
      tank.knockVy *= decay;
    } else {
      tank.knockVx = 0;
      tank.knockVy = 0;
    }

    tank.x += tank.vx * dt;
    tank.y += tank.vy * dt;

    this.resolveCircleWorld(tank, solidRects, solidCircles);
  }

  private resolveCircleWorld(tank: { x: number; y: number }, solidRects: Rect[], solidCircles: Circle[] = []): void {
    const r = this.tankRadius;
    tank.x = clampNum(tank.x, r, this.stageW - r);
    tank.y = clampNum(tank.y, r, this.stageH - r);

    for (let pass = 0; pass < 2; pass++) {
      for (const rect of solidRects) {
        const nearestX = clampNum(tank.x, rect.x, rect.x + rect.w);
        const nearestY = clampNum(tank.y, rect.y, rect.y + rect.h);
        const dx = tank.x - nearestX;
        const dy = tank.y - nearestY;
        const distSq = dx * dx + dy * dy;
        if (distSq < r * r) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = r - dist;
            tank.x += (dx / dist) * overlap;
            tank.y += (dy / dist) * overlap;
          } else {
            const left = Math.abs(tank.x - rect.x);
            const right = Math.abs(rect.x + rect.w - tank.x);
            const top = Math.abs(tank.y - rect.y);
            const bottom = Math.abs(rect.y + rect.h - tank.y);
            const minEdge = Math.min(left, right, top, bottom);
            if (minEdge === left) tank.x = rect.x - r;
            else if (minEdge === right) tank.x = rect.x + rect.w + r;
            else if (minEdge === top) tank.y = rect.y - r;
            else tank.y = rect.y + rect.h + r;
          }
        }
      }

      for (const sc of solidCircles) {
        const dx = tank.x - sc.x;
        const dy = tank.y - sc.y;
        const minD = r + sc.r;
        const distSq = dx * dx + dy * dy;
        if (distSq < minD * minD) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.001) {
            const overlap = minD - dist;
            tank.x += (dx / dist) * overlap;
            tank.y += (dy / dist) * overlap;
          } else {
            tank.x = sc.x + minD;
          }
        }
      }
    }
  }

  private resolveTankVsTank(solidRects: Rect[], solidCircles: Circle[]): void {
    const minDist = this.tankRadius * 2;
    const minDistSq = minDist * minDist;
    for (let i = 0; i < this.tankOrder.length; i++) {
      const a = this.tankOrder[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.tankOrder.length; j++) {
        const b = this.tankOrder[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistSq) {
          const d = Math.sqrt(dSq) || 0.01;
          const overlap = (minDist - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          this.resolveCircleWorld(a, solidRects, solidCircles);
          this.resolveCircleWorld(b, solidRects, solidCircles);
        }
      }
    }
  }

  private tryFireTank(tank: SimTank): void {
    if (!tank.alive || tank.isDisconnected) return;
    if (tank.cooldownTimer > 0) return;

    const isUnlimited = tank.activePower === 'unlimited';
    if (!isUnlimited && tank.ammo <= 0) {
      this.emit('dryClick', { playerId: tank.id, x: Math.round(tank.x), y: Math.round(tank.y) });
      return;
    }

    if (!isUnlimited) {
      tank.ammo -= 1;
    }
    tank.cooldownTimer = isUnlimited ? TANK.powers.unlimited.cooldownSec : TANK.ammo.cooldownSec;
    tank.spawnShieldTimer = 0;
    tank.fireRevealTimer = TANK.arenaSeries.bush.fireRevealSec; // Reveals from bush stealth for 2s
    tank.stealth = false;
    tank.shotsFired += 1;

    const rad = (tank.angle * Math.PI) / 180;
    const muzzleDist = this.tankRadius + 10 * this.worldScaleFactor;
    const sx = tank.x + Math.cos(rad) * muzzleDist;
    const sy = tank.y + Math.sin(rad) * muzzleDist;
    const shotSpeed = isUnlimited ? this.fireballSpeed : this.shellSpeed;
    const svx = Math.cos(rad) * shotSpeed;
    const svy = Math.sin(rad) * shotSpeed;

    const shell: SimShell = {
      id: this.nextShellId++,
      ownerId: tank.id,
      ownerIdx: tank.idx,
      team: tank.team,
      colorId: tank.colorId,
      x: sx,
      y: sy,
      vx: svx,
      vy: svy,
      angle: tank.angle,
      lifeLeft: this.shellLifeSec,
      ricochetsLeft: this.settings.shellRicochets,
      isFireball: isUnlimited,
    };
    this.shells.push(shell);

    this.emit('shot', {
      shellId: shell.id,
      ownerIdx: tank.idx,
      colorId: tank.colorId,
      x: Math.round(sx),
      y: Math.round(sy),
      angle: Math.round(tank.angle),
      isFireball: isUnlimited ? 1 : 0,
      tick: this.tickCount,
    });

    if (tank.styleGroup === 'ARCADE') {
      // Firing reverses the tank's auto-rotation direction
      tank.recoilDir = tank.recoilDir === 1 ? -1 : 1;
      if (this.settings.recoilEnabled && Math.abs(tank.speed) < 25) {
        tank.recoilTimer = TANK.recoil.durationSec;
      }
    }
  }

  private stepShells(
    dt: number,
    solidRects: Rect[],
    solidCircles: Circle[],
    deathsThisTick: Array<{ victim: SimTank; killer: SimTank | null }>,
  ): void {
    const aliveTanks = this.tankOrder.filter((t) => t.alive);
    const barrelR = TANK.arenaSeries.barrel.radius;

    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i];
      shell.lifeLeft -= dt;
      if (shell.lifeLeft <= 0) {
        this.shells.splice(i, 1);
        continue;
      }

      const stepDx = shell.vx * dt;
      const stepDy = shell.vy * dt;
      const dist = Math.sqrt(stepDx * stepDx + stepDy * stepDy);
      const subSteps = Math.max(1, Math.ceil(dist / 5));
      const subDx = stepDx / subSteps;
      const subDy = stepDy / subSteps;

      let destroyed = false;

      const curShellR = shell.isFireball ? this.fireballRadius : this.shellRadius;

      for (let s = 0; s < subSteps && !destroyed; s++) {
        const nextX = shell.x + subDx;
        const nextY = shell.y + subDy;

        // 0. Check explosive barrels
        for (const barrel of this.barrels) {
          if (!barrel.alive) continue;
          if (circleIntersectsCircle(nextX, nextY, curShellR, barrel.x, barrel.y, barrelR)) {
            this.detonateBarrel(barrel, this.tanks.get(shell.ownerId) ?? null, deathsThisTick);
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;

        // 1. Check crates
        const crateHalf = 22 * this.worldScaleFactor;
        for (const crate of this.crates) {
          if (!crate.alive) continue;
          const cRect: Rect = { x: crate.x - crateHalf, y: crate.y - crateHalf, w: crateHalf * 2, h: crateHalf * 2 };
          if (circleIntersectsRect(nextX, nextY, curShellR, cRect)) {
            crate.alive = false;
            if (this.rng.next() < TANK.crateDropChance && this.settings.allowedPowers.length > 0) {
              crate.droppedPower = this.rng.pick(this.settings.allowedPowers);
              crate.droppedPowerTimer = 15;
            }
            this.emit('crateBreak', {
              id: crate.id,
              shellId: shell.id,
              x: crate.x,
              y: crate.y,
              power: crate.droppedPower,
            });
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;

        // 2. Check bricks
        for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
          const brick = this.bricks[bi];
          if (circleIntersectsRect(nextX, nextY, curShellR, brick.rect)) {
            if (this.settings.bricksBreakable) {
              const tankTouching = aliveTanks.some((t) => circleIntersectsRect(t.x, t.y, this.tankRadius, brick.rect));
              if (!tankTouching) {
                brick.hp -= 1;
                if (brick.hp <= 0) {
                  this.bricks.splice(bi, 1);
                  this.emit('brickBreak', {
                    id: brick.id,
                    x: Math.round(brick.rect.x + brick.rect.w / 2),
                    y: Math.round(brick.rect.y + brick.rect.h / 2),
                  });
                } else {
                  this.emit('brickHit', { id: brick.id });
                }
              }
            }
            if (shell.ricochetsLeft > 0) {
              this.bounceShell(shell, brick.rect);
            } else {
              this.emit('shellWall', { shellId: shell.id, x: Math.round(nextX), y: Math.round(nextY) });
              destroyed = true;
            }
            break;
          }
        }
        if (destroyed) break;

        // 3. Check solid circles (center pyramid in desert/snow)
        let hitCircle: Circle | null = null;
        for (const sc of solidCircles) {
          if (circleIntersectsCircle(nextX, nextY, curShellR, sc.x, sc.y, sc.r)) {
            hitCircle = sc;
            break;
          }
        }
        if (hitCircle) {
          if (shell.ricochetsLeft > 0) {
            this.bounceShellOffCircle(shell, hitCircle);
          } else {
            this.emit('shellWall', { shellId: shell.id, x: Math.round(nextX), y: Math.round(nextY) });
            destroyed = true;
          }
          break;
        }

        // 4. Check solid walls / steel barriers
        let hitWall: Rect | null = null;
        for (const w of solidRects) {
          if (circleIntersectsRect(nextX, nextY, curShellR, w)) {
            hitWall = w;
            break;
          }
        }
        if (
          !hitWall &&
          (nextX < curShellR ||
            nextX > this.stageW - curShellR ||
            nextY < curShellR ||
            nextY > this.stageH - curShellR)
        ) {
          hitWall = { x: 0, y: 0, w: this.stageW, h: this.stageH };
        }

        if (hitWall) {
          if (shell.ricochetsLeft > 0) {
            this.bounceShell(shell, hitWall);
          } else {
            this.emit('shellWall', { shellId: shell.id, x: Math.round(nextX), y: Math.round(nextY) });
            destroyed = true;
          }
          break;
        }

        // 5. Check tanks
        for (const target of aliveTanks) {
          if (target.id === shell.ownerId && shell.lifeLeft > this.shellLifeSec - 0.12) continue;
          if (
            !this.settings.friendlyFire &&
            this.settings.mode !== 'ffa' &&
            target.team === shell.team &&
            target.id !== shell.ownerId
          ) {
            continue;
          }
          const dx = nextX - target.x;
          const dy = nextY - target.y;
          const hitR = this.tankRadius + curShellR;
          if (dx * dx + dy * dy <= hitR * hitR) {
            const shooter = this.tanks.get(shell.ownerId) ?? null;
            if (shooter && shooter.id !== target.id) {
              shooter.hits += 1;
            }

            if (target.spawnShieldTimer > 0 || target.activePower === 'shield') {
              this.emit('shieldPop', {
                shellId: shell.id,
                playerId: target.id,
                x: Math.round(target.x),
                y: Math.round(target.y),
                spawn: target.spawnShieldTimer > 0,
              });
              destroyed = true;
              break;
            }

            target.hp = Math.max(0, target.hp - this.settings.damagePct);
            if (target.hp <= 0) {
              deathsThisTick.push({ victim: target, killer: shooter });
            } else {
              this.emit('tankHit', {
                shellId: shell.id,
                playerId: target.id,
                playerIdx: target.idx,
                x: Math.round(target.x),
                y: Math.round(target.y),
                hp: target.hp,
                maxHp: target.maxHp,
                damage: this.settings.damagePct,
              });
            }
            destroyed = true;
            break;
          }
        }

        shell.x = nextX;
        shell.y = nextY;
      }

      if (destroyed) {
        this.shells.splice(i, 1);
      }
    }
  }

  private detonateBarrel(
    barrel: SimBarrel,
    shooter: SimTank | null,
    deathsThisTick: Array<{ victim: SimTank; killer: SimTank | null }>,
  ): void {
    barrel.alive = false;
    barrel.respawnTimer = TANK.arenaSeries.barrel.respawnSec;
    this.emit('barrelExplode', { id: barrel.id, x: barrel.x, y: barrel.y, r: TANK.arenaSeries.barrel.blastRadius });

    const blastR = TANK.arenaSeries.barrel.blastRadius;
    const dmg = TANK.arenaSeries.barrel.damage;
    const kb = TANK.arenaSeries.barrel.knockback;

    for (const tank of this.tankOrder) {
      if (!tank.alive) continue;
      const dx = tank.x - barrel.x;
      const dy = tank.y - barrel.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= (blastR + this.tankRadius) ** 2) {
        const dist = Math.sqrt(distSq) || 1;
        tank.knockVx += (dx / dist) * kb;
        tank.knockVy += (dy / dist) * kb;

        if (tank.spawnShieldTimer > 0 || tank.activePower === 'shield') {
          this.emit('shieldPop', { playerId: tank.id, x: Math.round(tank.x), y: Math.round(tank.y), spawn: tank.spawnShieldTimer > 0 });
          continue;
        }
        tank.hp = Math.max(0, tank.hp - dmg);
        if (tank.hp <= 0) {
          deathsThisTick.push({ victim: tank, killer: shooter });
        } else {
          this.emit('tankHit', {
            playerId: tank.id,
            playerIdx: tank.idx,
            x: Math.round(tank.x),
            y: Math.round(tank.y),
            hp: tank.hp,
            maxHp: tank.maxHp,
            damage: dmg,
          });
        }
      }
    }
  }

  private bounceShellOffCircle(shell: SimShell, c: Circle): void {
    shell.ricochetsLeft -= 1;
    const nx = shell.x - c.x;
    const ny = shell.y - c.y;
    const len = Math.hypot(nx, ny) || 1;
    const ux = nx / len;
    const uy = ny / len;
    const dot = shell.vx * ux + shell.vy * uy;
    shell.vx = shell.vx - 2 * dot * ux;
    shell.vy = shell.vy - 2 * dot * uy;
    shell.angle = (Math.atan2(shell.vy, shell.vx) * 180) / Math.PI;
  }

  private bounceShell(shell: SimShell, rect: Rect): void {
    shell.ricochetsLeft -= 1;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (rect.x === 0 && rect.w === this.stageW && rect.h === this.stageH) {
      if (shell.x <= this.shellRadius || shell.x >= this.stageW - this.shellRadius) {
        shell.vx = -shell.vx;
      } else {
        shell.vy = -shell.vy;
      }
    } else {
      const dx = (shell.x - cx) / (rect.w / 2 || 1);
      const dy = (shell.y - cy) / (rect.h / 2 || 1);
      if (Math.abs(dx) > Math.abs(dy)) {
        shell.vx = -shell.vx;
      } else {
        shell.vy = -shell.vy;
      }
    }
    shell.angle = (Math.atan2(shell.vy, shell.vx) * 180) / Math.PI;
  }

  private processDeaths(deaths: Array<{ victim: SimTank; killer: SimTank | null }>): void {
    const processedVictims = new Set<string>();

    for (const { victim, killer } of deaths) {
      if (processedVictims.has(victim.id)) continue;
      processedVictims.add(victim.id);

      victim.alive = false;
      victim.hp = 0;
      victim.deaths += 1;
      victim.respawnTimer = TANK.respawnSec;
      victim.spawnWaitTimer = 0;
      victim.activePower = null;
      victim.powerTimer = 0;
      victim.recoilTimer = 0;
      victim.recoilDir = 1;
      victim.hazardAccum = 0;
      victim.knockVx = 0;
      victim.knockVy = 0;
      victim.inBush = false;
      victim.stealth = false;
      this.dropCarriedFlag(victim);

      if (killer && killer.id !== victim.id) {
        const isEnemy = this.settings.mode === 'ffa' || killer.team !== victim.team;
        if (isEnemy) {
          killer.points += 1;
          if (this.settings.mode === 'team-fight') {
            if (killer.team === 'red') this.teamScores.red += 1;
            else if (killer.team === 'blue') this.teamScores.blue += 1;
          }
        }
      }

      this.emit('tankKill', {
        victimId: victim.id,
        victimIdx: victim.idx,
        victimName: victim.nickname,
        victimColor: victim.colorId,
        killerId: killer?.id ?? null,
        killerIdx: killer?.idx ?? null,
        killerName: killer?.nickname ?? null,
        killerColor: killer?.colorId ?? null,
        x: Math.round(victim.x),
        y: Math.round(victim.y),
      });
    }
  }

  private tryRespawnTank(tank: SimTank, dt: number): void {
    const pool = tank.team === 'ffa' ? this.spawnPools.ffa : this.spawnPools[tank.team];
    const spawnIdx = pickBestSpawnIndex(
      pool,
      this.tankOrder,
      tank.id,
      tank.team,
      tank.lastSpawnIdx,
      TANK.spawnPool.tankClearPx * this.worldScaleFactor,
    );
    const pt = pool[spawnIdx] ?? { x: this.stageW / 2, y: this.stageH / 2, angle: 0 };

    const blocked = this.tankOrder.some((other) => {
      if (!other.alive || other.id === tank.id) return false;
      const dx = other.x - pt.x;
      const dy = other.y - pt.y;
      return dx * dx + dy * dy < (this.tankRadius * 2 + 6) ** 2;
    });

    if (blocked && tank.spawnWaitTimer < 1.0) {
      tank.spawnWaitTimer += dt;
      return;
    }

    tank.x = pt.x;
    tank.y = pt.y;
    tank.angle = pt.angle;
    tank.vx = 0;
    tank.vy = 0;
    tank.speed = 0;
    tank.alive = true;
    tank.hp = tank.maxHp;
    tank.ammo = this.settings.ammoMax;
    tank.ammoTimer = 0;
    tank.cooldownTimer = 0;
    tank.spawnShieldTimer = TANK.spawnShieldSec;
    tank.recoilDir = 1;
    tank.recoilTimer = 0;
    tank.hazardAccum = 0;
    tank.knockVx = 0;
    tank.knockVy = 0;
    tank.fireRevealTimer = 0;
    tank.lastSpawnIdx = spawnIdx;

    this.emit('respawn', {
      playerId: tank.id,
      playerIdx: tank.idx,
      x: Math.round(tank.x),
      y: Math.round(tank.y),
      angle: Math.round(tank.angle),
    });
  }

  private checkTankPickups(tank: SimTank): void {
    const pickR = this.tankRadius + 30 * this.worldScaleFactor;
    for (const box of this.powerBoxes) {
      if (!box.active) continue;
      const dx = tank.x - box.x;
      const dy = tank.y - box.y;
      if (dx * dx + dy * dy <= pickR * pickR) {
        box.active = false;
        box.respawnTimer = TANK.powerBoxReturnSec;
        const power = this.settings.allowedPowers.includes(box.power)
          ? box.power
          : this.rng.pick(this.settings.allowedPowers);
        this.grantPower(tank, power);
        this.emit('powerPickup', {
          boxId: box.id,
          playerId: tank.id,
          playerIdx: tank.idx,
          power,
          x: box.x,
          y: box.y,
        });
      }
    }

    const dropR = this.tankRadius + 20 * this.worldScaleFactor;
    for (const crate of this.crates) {
      if (!crate.droppedPower) continue;
      const dx = tank.x - crate.x;
      const dy = tank.y - crate.y;
      if (dx * dx + dy * dy <= dropR * dropR) {
        const power = crate.droppedPower;
        crate.droppedPower = null;
        crate.droppedPowerTimer = 0;
        this.grantPower(tank, power);
        this.emit('powerPickup', {
          crateId: crate.id,
          playerId: tank.id,
          playerIdx: tank.idx,
          power,
          x: crate.x,
          y: crate.y,
        });
      }
    }
  }

  private grantPower(tank: SimTank, power: PowerType): void {
    tank.activePower = power;
    tank.powerTimer =
      power === 'speed'
        ? TANK.powers.speed.sec
        : power === 'shield'
          ? TANK.powers.shield.sec
          : TANK.powers.unlimited.sec;
    tank.powersCollected += 1;
  }

  private checkTankFlags(tank: SimTank): void {
    if (!this.flags || tank.team === 'ffa') return;
    const myTeam = tank.team as 'red' | 'blue';
    const enemyTeam = myTeam === 'red' ? 'blue' : 'red';
    const myFlag = this.flags[myTeam];
    const enemyFlag = this.flags[enemyTeam];
    const flagPickR = this.tankRadius + 22 * this.worldScaleFactor;

    if (myFlag.state === 'dropped') {
      const dx = tank.x - myFlag.x;
      const dy = tank.y - myFlag.y;
      if (dx * dx + dy * dy <= flagPickR * flagPickR) {
        this.returnFlagHome(myFlag, tank);
      }
    }

    if (enemyFlag.state !== 'carried') {
      const dx = tank.x - enemyFlag.x;
      const dy = tank.y - enemyFlag.y;
      if (dx * dx + dy * dy <= flagPickR * flagPickR) {
        enemyFlag.state = 'carried';
        enemyFlag.carrierId = tank.id;
        enemyFlag.returnTimer = 0;
        tank.flagsPicked += 1;
        this.emit('flagPickup', {
          team: enemyTeam,
          carrierId: tank.id,
          carrierIdx: tank.idx,
          carrierName: tank.nickname,
        });
      }
    }

    if (enemyFlag.state === 'carried' && enemyFlag.carrierId === tank.id) {
      enemyFlag.x = tank.x;
      enemyFlag.y = tank.y;
      const dx = tank.x - myFlag.padX;
      const dy = tank.y - myFlag.padY;
      if (dx * dx + dy * dy <= this.captureRadius * this.captureRadius) {
        if (this.settings.strictFlagHome && myFlag.state !== 'home') {
          return;
        }
        tank.captures += 1;
        tank.points += 2;
        this.teamScores[myTeam] += 1;
        enemyFlag.state = 'home';
        enemyFlag.carrierId = null;
        enemyFlag.x = enemyFlag.homeX;
        enemyFlag.y = enemyFlag.homeY;
        this.emit('flagCapture', {
          scoringTeam: myTeam,
          carrierId: tank.id,
          carrierName: tank.nickname,
          redScore: this.teamScores.red,
          blueScore: this.teamScores.blue,
        });
      }
    }
  }

  private dropCarriedFlag(tank: SimTank): void {
    if (!this.flags) return;
    for (const key of ['red', 'blue'] as const) {
      const flag = this.flags[key];
      if (flag.state === 'carried' && flag.carrierId === tank.id) {
        flag.state = 'dropped';
        flag.carrierId = null;
        flag.x = clampNum(tank.x, 40 * this.worldScaleFactor, this.stageW - 40 * this.worldScaleFactor);
        flag.y = clampNum(tank.y, 40 * this.worldScaleFactor, this.stageH - 40 * this.worldScaleFactor);
        flag.returnTimer = this.settings.flagReturnSec;
        this.emit('flagDrop', {
          team: key,
          x: Math.round(flag.x),
          y: Math.round(flag.y),
        });
      }
    }
  }

  private returnFlagHome(flag: SimFlag, returner: SimTank | null): void {
    flag.state = 'home';
    flag.carrierId = null;
    flag.x = flag.homeX;
    flag.y = flag.homeY;
    flag.returnTimer = 0;
    if (returner) {
      returner.returns += 1;
    }
    this.emit('flagReturn', {
      team: flag.team,
      returnerId: returner?.id ?? null,
      returnerName: returner?.nickname ?? null,
    });
  }

  private isCarryingFlag(tank: SimTank): boolean {
    if (!this.flags) return false;
    return this.flags.red.carrierId === tank.id || this.flags.blue.carrierId === tank.id;
  }

  private getSolidRects(): Rect[] {
    const rects: Rect[] = [...this.map.pitWalls, ...this.map.steelBarriers];
    for (const b of this.bricks) rects.push(b.rect);
    return rects;
  }

  private handleTimeUp(): void {
    if (this.settings.mode === 'ffa') {
      const sorted = [...this.tankOrder].sort((a, b) => b.points - a.points || a.deaths - b.deaths);
      const top = sorted[0];
      const second = sorted[1];
      if (top && second && top.points === second.points) {
        this.startSuddenDeath();
        return;
      }
      this.finishMatch('ffa', top ? `${top.nickname} Wins!` : 'Time Up!');
      return;
    }

    if (this.teamScores.red === this.teamScores.blue) {
      this.startSuddenDeath();
      return;
    }

    const winner = this.teamScores.red > this.teamScores.blue ? 'red' : 'blue';
    this.finishMatch(winner, winner === 'red' ? 'Red Team Wins!' : 'Blue Team Wins!');
  }

  private checkWinConditions(): void {
    if (this.finishedResult) return;

    if (this.settings.mode === 'ffa') {
      const winner = this.tankOrder.find((t) => t.points >= this.settings.targetScore);
      if (winner) {
        this.finishMatch('ffa', `${winner.nickname} Wins!`);
      }
      return;
    }

    const redReached = this.teamScores.red >= this.settings.targetScore;
    const blueReached = this.teamScores.blue >= this.settings.targetScore;

    if (redReached && blueReached) {
      this.startSuddenDeath();
      return;
    }

    if (this.inSuddenDeath && this.teamScores.red !== this.teamScores.blue) {
      const winner = this.teamScores.red > this.teamScores.blue ? 'red' : 'blue';
      this.finishMatch(winner, winner === 'red' ? 'Red Team Wins!' : 'Blue Team Wins!');
      return;
    }

    if (redReached) {
      this.finishMatch('red', 'Red Team Wins!');
    } else if (blueReached) {
      this.finishMatch('blue', 'Blue Team Wins!');
    }
  }

  private startSuddenDeath(): void {
    if (this.inSuddenDeath) return;
    this.inSuddenDeath = true;
    this.timeLeftSec = TANK.suddenDeathSec;
    this.emit('suddenDeath', { durationSec: TANK.suddenDeathSec });
  }

  public finishMatch(winnerTeam: TeamId | 'draw', winnerLabel: string): void {
    if (this.finishedResult) return;

    const allStats: PlayerMatchStat[] = [
      ...this.tankOrder.map((t) => this.buildStatForTank(t, false)),
      ...this.removedStats,
    ];

    allStats.sort((a, b) => b.points - a.points || a.deaths - b.deaths || b.accuracy - a.accuracy);

    const awards: MatchAward[] = [];
    if (allStats.length > 0) {
      const mvp = [...allStats].sort((a, b) => b.mvpScore - a.mvpScore)[0];
      if (mvp) {
        awards.push({ id: 'mvp', title: 'MVP', playerId: mvp.playerId, nickname: mvp.nickname, detail: `${mvp.mvpScore} MVP pts` });
      }
      const sharp = [...allStats].filter((s) => s.shotsFired >= 5).sort((a, b) => b.accuracy - a.accuracy)[0];
      if (sharp) {
        awards.push({ id: 'sharpshooter', title: 'Sharpshooter', playerId: sharp.playerId, nickname: sharp.nickname, detail: `${sharp.accuracy}% accuracy` });
      }
      if (this.settings.mode === 'flag') {
        const hero = [...allStats].sort((a, b) => b.captures - a.captures)[0];
        if (hero && hero.captures > 0) {
          awards.push({ id: 'flag-hero', title: 'Flag Hero', playerId: hero.playerId, nickname: hero.nickname, detail: `${hero.captures} captures` });
        }
        const def = [...allStats].sort((a, b) => b.returns - a.returns)[0];
        if (def && def.returns > 0) {
          awards.push({ id: 'defender', title: 'Defender', playerId: def.playerId, nickname: def.nickname, detail: `${def.returns} returns` });
        }
      }
      const survivor = [...allStats].sort((a, b) => a.deaths - b.deaths)[0];
      if (survivor) {
        awards.push({ id: 'survivor', title: 'Survivor', playerId: survivor.playerId, nickname: survivor.nickname, detail: `${survivor.deaths} deaths` });
      }
    }

    this.finishedResult = {
      winnerTeam,
      winnerLabel,
      durationSec: Math.round(this.elapsedSec),
      teamScores: { ...this.teamScores },
      stats: allStats,
      awards,
    };
  }

  private buildStatForTank(t: SimTank, leftEarly: boolean): PlayerMatchStat {
    const accuracy = t.shotsFired > 0 ? Math.round((t.hits / t.shotsFired) * 100) : 0;
    const mvpScore = t.points + 3 * t.captures + t.returns;
    return {
      playerId: t.id,
      nickname: t.nickname,
      colorId: t.colorId,
      team: t.team,
      isBot: t.isBot,
      leftEarly,
      points: t.points,
      deaths: t.deaths,
      shotsFired: t.shotsFired,
      hits: t.hits,
      accuracy,
      flagsPicked: t.flagsPicked,
      captures: t.captures,
      returns: t.returns,
      powersCollected: t.powersCollected,
      pingMs: t.pingMs,
      mvpScore,
    };
  }

  private emit(type: SimEvent['type'], data: Record<string, unknown>): void {
    this.pendingEvents.push({ t: this.tickCount, type, data });
  }

  public drainEvents(): SimEvent[] {
    if (this.pendingEvents.length === 0) return [];
    const copy = this.pendingEvents;
    this.pendingEvents = [];
    return copy;
  }

  public getCompactSnapshot(): CompactSnapshot {
    const tanks: CompactSnapshot['tanks'] = this.tankOrder.map((t) => {
      let flags = 0;
      if (t.alive) flags |= 1;
      if (t.spawnShieldTimer > 0) flags |= 2;
      if (t.activePower === 'shield') flags |= 4;
      if (t.activePower === 'speed') flags |= 8;
      if (t.activePower === 'unlimited') flags |= 16;
      if (this.isCarryingFlag(t)) flags |= 32;
      if (t.isAfk) flags |= 64;
      if (t.isDisconnected) flags |= 128;
      if (t.stealth) flags |= 256;

      return [
        t.idx,
        Math.round(t.x),
        Math.round(t.y),
        Math.round(t.angle),
        flags,
        t.ammo,
        powerToCode(t.activePower),
        t.hp,
        Math.ceil(t.respawnTimer * 10),
      ];
    });

    const encodeFlag = (f: SimFlag): [number, number, number, number] => {
      const stateCode = f.state === 'home' ? 0 : f.state === 'carried' ? 1 : 2;
      const carrier = f.carrierId ? this.tanks.get(f.carrierId) : undefined;
      return [stateCode, Math.round(f.x), Math.round(f.y), carrier ? carrier.idx : -1];
    };

    const drops: CompactSnapshot['drops'] = [];
    for (const c of this.crates) {
      if (c.droppedPower) {
        drops.push([c.id, c.x, c.y, powerToCode(c.droppedPower)]);
      }
    }

    const snap: CompactSnapshot = {
      tick: this.tickCount,
      timeLeft: Math.round(this.timeLeftSec * 10) / 10,
      suddenDeath: this.inSuddenDeath,
      scores: [this.teamScores.red, this.teamScores.blue],
      tanks,
      flags: this.flags ? { r: encodeFlag(this.flags.red), b: encodeFlag(this.flags.blue) } : null,
      boxes: this.powerBoxes.map((b) => (b.active ? powerToCode(b.power) : 0)),
      drops,
    };

    if (this.barrels.length > 0) {
      snap.barrels = this.barrels.map((b) => (b.alive ? 1 : 0));
    }
    if (this.vents.length > 0) {
      snap.vents = this.vents.map((v) => [v.state, Math.round(v.phaseSec * 10)]);
    }

    return snap;
  }
}
