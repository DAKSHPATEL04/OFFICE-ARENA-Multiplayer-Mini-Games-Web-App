import type { PresetDef } from '../../../platform/shared/GameModule.ts';

export type TankControlStyleGroup = 'ARCADE' | 'STANDARD' | 'STEER';

export interface TankInputObj {
  seq: number;
  throttle: number; // -1..1
  turn: number; // -1..1
  heading: number | null; // degrees 0..360 for STEER; null otherwise
  fire: number; // monotonically increasing counter
}

export type CompactTankInput = [number, number, number, number | null, number];

export const TANK = {
  stage: { w: 1792, h: 828 },
  radius: 27,
  speed: 145,
  reverseSpeed: 95,
  accelSec: 0.1,
  brakeSec: 0.1,
  hits: 1,
  turnRate: { standard: 165, steer: 175, arcadeSpin: 100, arcadeAssist: 140 },
  steerPivotAngle: 60,
  steerPivotSpeedScale: 0.6,
  recoil: { enabled: true, angleDeg: 18, durationSec: 0.1 },
  tapTimeSec: 0.2,
  holdDelaySec: 0.1,
  shell: { speed: 520, radius: 7, lifeSec: 1.8, ricochets: 0, fireballSpeed: 580, fireballRadius: 13 },
  ammo: { max: 5, returnSec: 1.5, cooldownSec: 0.2 },
  respawnSec: 3,
  spawnShieldSec: 1.5,
  carrierSpeedPct: 90,
  flagReturnSec: 10,
  powerBoxReturnSec: 12,
  powers: {
    speed: { mult: 2.0, sec: 6 },
    shield: { sec: 6 },
    unlimited: { sec: 7, cooldownSec: 0.14 },
  },
  players: { min: 2, max: 12, defaultMax: 8, perTeamMax: 6, localMax: 4, spectatorsMax: 20 },
  autoScale: [
    { upTo: 4, timeSec: 120, points: 3, captures: 1 },
    { upTo: 8, timeSec: 180, points: 5, captures: 2 },
    { upTo: 12, timeSec: 240, points: 8, captures: 3 },
  ],
  suddenDeathSec: 30,
  spawnPool: {
    gridPx: 32,
    wallClearPx: 40,
    flagClearPx: 70,
    teamSpacingPx: 64,
    ffaSpacingPx: 160,
    perTeam: 6,
    ffa: 12,
    tankClearPx: 100,
  },
  lateJoinUntilPct: 70,
  afk: { warnSec: 20, specSec: 45 },
  aimAssist: { level: 'light' as 'off' | 'light', coneDeg: 10, rangePx: 500, nudgeDeg: 4 },
  touch: {
    stickPx: 140,
    stickMax: 60,
    deadZone: 0.12,
    firePx: 110,
    hitPadPx: 16,
    idleOpacity: 0.45,
    pressOpacity: 0.85,
  },
  defaultStyle: {
    pc: 'PC_ARCADE',
    touch: 'STEER_TWIN_THUMB',
    pad: 'PAD_STEER',
  },
  crateDropChance: 0.4,
  tickRate: 30,
  arenaSeries: {
    worldScale: 2.5,
    refSize: { w: 1376, h: 768 },
    stage: { w: 3440, h: 1920 },
    canvas: { w: 1720, h: 960 },
    tankScale: 1.68,
    spawnWallClearPx: 80,
    captureRadius: 100,
    lavaDps: 8,
    vent: {
      cycleSec: 6.0,
      warnSec: 1.0,
      eruptSec: 0.45,
      damage: 25,
      knockback: 420,
    },
    barrel: {
      radius: 26,
      blastRadius: 185,
      damage: 45,
      knockback: 380,
      respawnSec: 15,
    },
    ice: {
      friction: 0.3,
      steerLag: 0.22,
    },
    rockySpeedMult: 0.85,
    mudSpeedMult: 0.65,
    bush: {
      revealRadius: 300,
      fireRevealSec: 2.0,
    },
  },
} as const;

export const TANK_PRESETS: PresetDef[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Balanced 100% power (1-hit destroy) for 2–12 players.',
    values: {
      mode: 'flag',
      map: 'auto',
      timeLimit: 'auto',
      pointsToWin: 'auto',
      capturesToWin: 'auto',
      damagePct: 100,
      ammoMax: 5,
      ammoReturnSec: 1.5,
      tankSpeedPct: 100,
      shellRicochets: 0,
      bricksBreakable: true,
      powerBoxes: 'normal',
      allowedPowers: ['speed', 'shield', 'unlimited'],
    },
  },
  {
    id: 'fast',
    name: 'Fast Match',
    description: '60-second sprint with faster tanks and 4 shells.',
    values: {
      mode: 'team-fight',
      timeLimit: 60,
      ammoMax: 4,
      tankSpeedPct: 120,
      damagePct: 100,
      powerBoxes: 'normal',
    },
  },
  {
    id: 'chaos',
    name: 'Chaos',
    description: 'Bouncing shells, many power boxes, and 50% damage (2-hit armor).',
    values: {
      powerBoxes: 'many',
      shellRicochets: 1,
      damagePct: 50,
      tankSpeedPct: 110,
      bricksBreakable: true,
    },
  },
  {
    id: 'duel',
    name: 'Duel',
    description: 'Tactical Team Fight to 5 points on Frozen Ruins.',
    values: {
      mode: 'team-fight',
      map: 'snow',
      pointsToWin: 5,
      damagePct: 100,
      powerBoxes: 'few',
    },
  },
  {
    id: 'big-party',
    name: 'Big Party',
    description: 'Up to 12 players Free For All on Desert Ruins.',
    values: {
      mode: 'ffa',
      map: 'desert',
      timeLimit: 'auto',
      pointsToWin: 'auto',
      powerBoxes: 'many',
      damagePct: 100,
    },
  },
];

export function resolveAutoScale(playerCount: number): { timeSec: number; points: number; captures: number } {
  for (const row of TANK.autoScale) {
    if (playerCount <= row.upTo) {
      return { timeSec: row.timeSec, points: row.points, captures: row.captures };
    }
  }
  const last = TANK.autoScale[TANK.autoScale.length - 1];
  return { timeSec: last.timeSec, points: last.points, captures: last.captures };
}

export function normalizeInput(raw: unknown): TankInputObj {
  if (Array.isArray(raw)) {
    return {
      seq: Number(raw[0]) || 0,
      throttle: clampNum(Number(raw[1]) || 0, -1, 1),
      turn: clampNum(Number(raw[2]) || 0, -1, 1),
      heading: raw[3] === null || raw[3] === undefined ? null : ((Number(raw[3]) % 360) + 360) % 360,
      fire: Math.max(0, Math.floor(Number(raw[4]) || 0)),
    };
  }
  const obj = (raw ?? {}) as Partial<TankInputObj>;
  return {
    seq: Number(obj.seq) || 0,
    throttle: clampNum(Number(obj.throttle) || 0, -1, 1),
    turn: clampNum(Number(obj.turn) || 0, -1, 1),
    heading: obj.heading === null || obj.heading === undefined ? null : ((Number(obj.heading) % 360) + 360) % 360,
    fire: Math.max(0, Math.floor(Number(obj.fire) || 0)),
  };
}

export function clampNum(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}
