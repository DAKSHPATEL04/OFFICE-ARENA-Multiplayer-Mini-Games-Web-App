import { TANK } from '../config.ts';
import type {
  ArenaRuleTag,
  Circle,
  EruptionVent,
  HazardCircle,
  MapData,
  MapTheme,
  Point,
  Rect,
  SpawnPoint,
  SpeedZoneCircle,
} from './types.ts';

const S = TANK.arenaSeries.worldScale; // 2.5

const scaleRect = (x: number, y: number, w: number, h: number): Rect => ({
  x: Math.round(x * S),
  y: Math.round(y * S),
  w: Math.round(w * S),
  h: Math.round(h * S),
});

const scaleCircle = (x: number, y: number, r: number): Circle => ({
  x: Math.round(x * S),
  y: Math.round(y * S),
  r: Math.round(r * S),
});

const scalePoint = (x: number, y: number): Point => ({
  x: Math.round(x * S),
  y: Math.round(y * S),
});

/**
 * Shared "Arena Series" collision geometry (1376 x 768 reference scaled by 2.5 => 3440 x 1920).
 * Every theme shares the exact same outer walls, sealed gates, 4 circular corner platforms,
 * left/right flag alcoves, and inner L- and U-shaped ruins.
 */
export const ARENA_SERIES_SHARED = {
  stage: { w: TANK.arenaSeries.stage.w, h: TANK.arenaSeries.stage.h },
  playBounds: scaleRect(86, 48, 1204, 672),

  // 4 circular stone platforms in the 4 corners (safe spawn pads)
  platforms: [
    scaleCircle(186, 152, 72), // Top-Left
    scaleCircle(1190, 152, 72), // Top-Right
    scaleCircle(186, 616, 72), // Bottom-Left
    scaleCircle(1190, 616, 72), // Bottom-Right
  ],

  // Outer perimeter + sealed top/bottom gates + corner bay walls + left/right alcoves + L/U inner ruins
  pitWalls: [
    // Outer stone walls
    scaleRect(0, 0, 1376, 48), // Top wall
    scaleRect(0, 720, 1376, 48), // Bottom wall
    scaleRect(0, 48, 86, 672), // Left wall
    scaleRect(1290, 48, 86, 672), // Right wall

    // Sealed top & bottom gate blocks
    scaleRect(616, 0, 144, 64),
    scaleRect(616, 704, 144, 64),

    // Corner-bay dividers (framing the 4 platforms while keeping wide exits)
    scaleRect(86, 244, 136, 18), // Top-Left shelf
    scaleRect(294, 48, 20, 120), // Top-Left pillar
    scaleRect(1154, 244, 136, 18), // Top-Right shelf
    scaleRect(1062, 48, 20, 120), // Top-Right pillar
    scaleRect(86, 506, 136, 18), // Bottom-Left shelf
    scaleRect(294, 600, 20, 120), // Bottom-Left pillar
    scaleRect(1154, 506, 136, 18), // Bottom-Right shelf
    scaleRect(1062, 600, 20, 120), // Bottom-Right pillar

    // Left gate alcove lips (framing Red flag stand)
    scaleRect(86, 304, 102, 22),
    scaleRect(86, 442, 102, 22),

    // Right gate alcove lips (framing Blue flag stand)
    scaleRect(1188, 304, 102, 22),
    scaleRect(1188, 442, 102, 22),

    // Top-Left L-shaped ruin + upper U-bracket
    scaleRect(382, 112, 26, 204),
    scaleRect(408, 112, 80, 24),
    scaleRect(408, 292, 48, 24),
    scaleRect(540, 140, 58, 22),
    scaleRect(576, 112, 22, 50),

    // Top-Right L-shaped ruin + upper U-bracket
    scaleRect(968, 112, 26, 204),
    scaleRect(888, 112, 80, 24),
    scaleRect(920, 292, 48, 24),
    scaleRect(778, 140, 58, 22),
    scaleRect(778, 112, 22, 50),

    // Bottom-Left L-shaped ruin + lower U-bracket
    scaleRect(382, 452, 26, 204),
    scaleRect(408, 632, 80, 24),
    scaleRect(408, 452, 48, 24),
    scaleRect(540, 606, 58, 22),
    scaleRect(576, 606, 22, 50),

    // Bottom-Right L-shaped ruin + lower U-bracket
    scaleRect(968, 452, 26, 204),
    scaleRect(888, 632, 80, 24),
    scaleRect(920, 452, 48, 24),
    scaleRect(778, 606, 58, 22),
    scaleRect(778, 606, 22, 50),
  ] as Rect[],

  // Visual gate alcove floor zones & sealed gate frames
  gateAlcoves: [
    scaleRect(86, 326, 110, 116), // Left alcove
    scaleRect(1180, 326, 110, 116), // Right alcove
  ] as Rect[],

  sealedGates: [
    scaleRect(616, 0, 144, 64),
    scaleRect(616, 704, 144, 64),
    scaleRect(54, 328, 32, 112), // Left gate doors
    scaleRect(1290, 328, 32, 112), // Right gate doors
  ] as Rect[],

  // Flag stands inside left/right alcoves (radius 100 world px capture zone)
  flags: {
    red: { flag: scalePoint(150, 378), pad: scalePoint(150, 378) },
    blue: { flag: scalePoint(1225, 378), pad: scalePoint(1225, 378) },
  },

  // 6 Red spawns (3 Top-Left + 3 Bottom-Left platforms), facing right (angle: 0)
  // 6 Blue spawns (3 Top-Right + 3 Bottom-Right platforms), facing left (angle: 180)
  startSpawns: {
    red: [
      { x: Math.round(186 * S), y: Math.round(124 * S), angle: 0 },
      { x: Math.round(186 * S), y: Math.round(588 * S), angle: 0 },
      { x: Math.round(158 * S), y: Math.round(170 * S), angle: 0 },
      { x: Math.round(158 * S), y: Math.round(634 * S), angle: 0 },
      { x: Math.round(214 * S), y: Math.round(170 * S), angle: 0 },
      { x: Math.round(214 * S), y: Math.round(634 * S), angle: 0 },
    ] as SpawnPoint[],
    blue: [
      { x: Math.round(1190 * S), y: Math.round(124 * S), angle: 180 },
      { x: Math.round(1190 * S), y: Math.round(588 * S), angle: 180 },
      { x: Math.round(1218 * S), y: Math.round(170 * S), angle: 180 },
      { x: Math.round(1218 * S), y: Math.round(634 * S), angle: 180 },
      { x: Math.round(1162 * S), y: Math.round(170 * S), angle: 180 },
      { x: Math.round(1162 * S), y: Math.round(634 * S), angle: 180 },
    ] as SpawnPoint[],
    ffa: [
      { x: Math.round(186 * S), y: Math.round(124 * S), angle: 45 },
      { x: Math.round(1190 * S), y: Math.round(124 * S), angle: 135 },
      { x: Math.round(186 * S), y: Math.round(634 * S), angle: 315 },
      { x: Math.round(1190 * S), y: Math.round(634 * S), angle: 225 },
      { x: Math.round(158 * S), y: Math.round(170 * S), angle: 20 },
      { x: Math.round(1218 * S), y: Math.round(170 * S), angle: 160 },
      { x: Math.round(158 * S), y: Math.round(588 * S), angle: 340 },
      { x: Math.round(1218 * S), y: Math.round(588 * S), angle: 200 },
      { x: Math.round(214 * S), y: Math.round(170 * S), angle: 55 },
      { x: Math.round(1162 * S), y: Math.round(170 * S), angle: 125 },
      { x: Math.round(214 * S), y: Math.round(588 * S), angle: 305 },
      { x: Math.round(1162 * S), y: Math.round(588 * S), angle: 235 },
    ] as SpawnPoint[],
  },

  spawnAreas: {
    red: [
      scaleRect(122, 88, 128, 128),
      scaleRect(122, 552, 128, 128),
    ] as Rect[],
    blue: [
      scaleRect(1126, 88, 128, 128),
      scaleRect(1126, 552, 128, 128),
    ] as Rect[],
  },

  // 10 tactical power pads (clear of all walls, hazards, and the center pyramid)
  powerBoxes: [
    scalePoint(688, 195), // Top midfield
    scalePoint(688, 573), // Bottom midfield
    scalePoint(325, 384), // Left midfield gate lane
    scalePoint(1051, 384), // Right midfield gate lane
    scalePoint(600, 260), // Upper-left center quadrant
    scalePoint(776, 260), // Upper-right center quadrant
    scalePoint(600, 508), // Lower-left center quadrant
    scalePoint(776, 508), // Lower-right center quadrant
    scalePoint(325, 220), // Top-left flank lane
    scalePoint(1051, 548), // Bottom-right flank lane
  ] as Point[],

  // 4 optional destructible explosive barrels
  barrels: [
    scalePoint(540, 310),
    scalePoint(836, 310),
    scalePoint(540, 458),
    scalePoint(836, 458),
  ] as Point[],

  respawnBays: [
    scalePoint(186, 152),
    scalePoint(186, 616),
    scalePoint(1190, 152),
    scalePoint(1190, 616),
  ] as Point[],
};

export interface ArenaThemeConfig {
  id: 'lava' | 'desert' | 'snow' | 'grass' | 'swamp';
  name: string;
  theme: MapTheme;
  accentColor: string;
  description: string;
  modes: Array<'flag' | 'team-fight' | 'ffa'>;
  bestFor: Array<'flag' | 'team-fight' | 'ffa'>;
  ruleTags: ArenaRuleTag[];
  /** Set a custom imageUrl in the future to load an external 16:9 backdrop; otherwise renders procedurally */
  imageUrl?: string;
  centerPyramid?: boolean;
  hazardZones?: HazardCircle[];
  eruptionVents?: EruptionVent[];
  speedZones?: SpeedZoneCircle[];
  icePhysics?: boolean;
  bushZones?: Circle[];
  cornerLavaDecor?: Circle[];
  crates?: Point[];
}

/**
 * Data-driven Arena Series Theme Registry.
 * Add a new theme by copying a single entry below — geometry, spawns, pads, and flags stay shared automatically.
 */
export const ARENA_SERIES_THEMES: ArenaThemeConfig[] = [
  {
    id: 'lava',
    name: 'Lava Crater',
    theme: 'lava',
    accentColor: '#FF6A2B',
    description: 'Charred volcanic ruins with glowing lava fissures and an erupting central magma vent.',
    modes: ['flag', 'team-fight', 'ffa'],
    bestFor: ['flag', 'team-fight'],
    ruleTags: ['lava-hazards', 'eruption-vent', 'explosive-barrels'],
    hazardZones: [
      { ...scaleCircle(470, 200, 40), dps: TANK.arenaSeries.lavaDps, kind: 'lava' },
      { ...scaleCircle(470, 280, 35), dps: TANK.arenaSeries.lavaDps, kind: 'lava' },
      { ...scaleCircle(960, 375, 40), dps: TANK.arenaSeries.lavaDps, kind: 'lava' },
    ],
    eruptionVents: [
      {
        ...scaleCircle(690, 440, 42),
        cycleSec: TANK.arenaSeries.vent.cycleSec,
        warnSec: TANK.arenaSeries.vent.warnSec,
        eruptSec: TANK.arenaSeries.vent.eruptSec,
        damage: TANK.arenaSeries.vent.damage,
        knockback: TANK.arenaSeries.vent.knockback,
      },
    ],
    cornerLavaDecor: [
      scaleCircle(122, 88, 34),
      scaleCircle(250, 96, 30),
      scaleCircle(1254, 88, 34),
      scaleCircle(1126, 96, 30),
      scaleCircle(122, 680, 34),
      scaleCircle(250, 672, 30),
      scaleCircle(1254, 680, 34),
      scaleCircle(1126, 672, 30),
    ],
    crates: [scalePoint(480, 384), scalePoint(896, 384)],
  },
  {
    id: 'desert',
    name: 'Desert Ruins',
    theme: 'sand',
    accentColor: '#E8A24A',
    description: 'Sunbaked sandstone ruins with a stepped center pyramid and rocky pebble trails.',
    modes: ['flag', 'team-fight', 'ffa'],
    bestFor: ['flag', 'team-fight', 'ffa'],
    ruleTags: ['center-pyramid', 'rocky-slow', 'explosive-barrels'],
    centerPyramid: true,
    speedZones: [
      { ...scaleCircle(250, 380, 45), mult: TANK.arenaSeries.rockySpeedMult, kind: 'rocky' },
      { ...scaleCircle(350, 375, 45), mult: TANK.arenaSeries.rockySpeedMult, kind: 'rocky' },
      { ...scaleCircle(450, 380, 45), mult: TANK.arenaSeries.rockySpeedMult, kind: 'rocky' },
      { ...scaleCircle(540, 420, 45), mult: TANK.arenaSeries.rockySpeedMult, kind: 'rocky' },
      { ...scaleCircle(600, 500, 45), mult: TANK.arenaSeries.rockySpeedMult, kind: 'rocky' },
      { ...scaleCircle(660, 590, 45), mult: TANK.arenaSeries.rockySpeedMult, kind: 'rocky' },
      { ...scaleCircle(720, 640, 40), mult: TANK.arenaSeries.rockySpeedMult, kind: 'rocky' },
    ],
    crates: [scalePoint(560, 384), scalePoint(816, 384)],
  },
  {
    id: 'snow',
    name: 'Frozen Ruins',
    theme: 'frost',
    accentColor: '#8FD3FF',
    description: 'Slick ice lanes that reward drift control around an ancient stepped ice pyramid.',
    modes: ['flag', 'team-fight', 'ffa'],
    bestFor: ['ffa', 'flag'],
    ruleTags: ['ice-physics', 'center-pyramid', 'explosive-barrels'],
    centerPyramid: true,
    icePhysics: true,
    crates: [scalePoint(560, 384), scalePoint(816, 384)],
  },
  {
    id: 'grass',
    name: 'Green Ruins',
    theme: 'grass',
    accentColor: '#6CC04A',
    description: 'Overgrown meadow courtyard with thick bush groves that cloak ambush tanks.',
    modes: ['flag', 'team-fight', 'ffa'],
    bestFor: ['flag', 'team-fight', 'ffa'],
    ruleTags: ['bush-stealth', 'explosive-barrels'],
    bushZones: [
      scaleCircle(790, 240, 55),
      scaleCircle(480, 545, 50),
      scaleCircle(850, 555, 50),
    ],
    crates: [scalePoint(688, 384)],
  },
  {
    id: 'swamp',
    name: 'Swamp Ruins',
    theme: 'swamp',
    accentColor: '#5AD68D',
    description: 'Mossy bog ruins with murky mud bogs near the edges, glowing reeds, and ambush bushes.',
    modes: ['flag', 'team-fight', 'ffa'],
    bestFor: ['team-fight', 'flag'],
    ruleTags: ['swamp-mud', 'bush-stealth', 'explosive-barrels'],
    speedZones: [
      { ...scaleCircle(280, 260, 42), mult: TANK.arenaSeries.mudSpeedMult, kind: 'mud' },
      { ...scaleCircle(1096, 260, 42), mult: TANK.arenaSeries.mudSpeedMult, kind: 'mud' },
      { ...scaleCircle(280, 508, 42), mult: TANK.arenaSeries.mudSpeedMult, kind: 'mud' },
      { ...scaleCircle(1096, 508, 42), mult: TANK.arenaSeries.mudSpeedMult, kind: 'mud' },
      { ...scaleCircle(480, 210, 38), mult: TANK.arenaSeries.mudSpeedMult, kind: 'mud' },
      { ...scaleCircle(896, 558, 38), mult: TANK.arenaSeries.mudSpeedMult, kind: 'mud' },
    ],
    bushZones: [
      scaleCircle(688, 384, 52),
      scaleCircle(495, 535, 44),
      scaleCircle(880, 235, 44),
    ],
    crates: [scalePoint(540, 384), scalePoint(836, 384)],
  },
];

export function buildArenaSeriesMap(cfg: ArenaThemeConfig): MapData {
  const solidCircles: Circle[] = cfg.centerPyramid ? [scaleCircle(688, 385, 62)] : [];
  return {
    id: cfg.id,
    name: cfg.name,
    theme: cfg.theme,
    series: 'arena-series',
    accentColor: cfg.accentColor,
    ruleTags: cfg.ruleTags,
    backgroundImage: cfg.imageUrl,
    description: cfg.description,
    modes: cfg.modes,
    bestFor: cfg.bestFor,
    recommendedPlayers: '2–12 players',
    stage: { ...ARENA_SERIES_SHARED.stage },
    tankScale: TANK.arenaSeries.tankScale,
    captureRadius: TANK.arenaSeries.captureRadius,
    strictFlagHomeDefault: true,
    playBounds: ARENA_SERIES_SHARED.playBounds,
    pitWalls: ARENA_SERIES_SHARED.pitWalls,
    steelBarriers: [],
    bricks: [],
    crates: cfg.crates ?? [],
    bushes: (cfg.bushZones ?? []).map((b) => ({ x: b.x, y: b.y })),
    craters: [],
    powerBoxes: ARENA_SERIES_SHARED.powerBoxes,
    platforms: ARENA_SERIES_SHARED.platforms,
    solidCircles,
    hazardZones: cfg.hazardZones,
    eruptionVents: cfg.eruptionVents,
    speedZones: cfg.speedZones,
    iceWorld: cfg.icePhysics
      ? {
          enabled: true,
          friction: TANK.arenaSeries.ice.friction,
          steerLag: TANK.arenaSeries.ice.steerLag,
          safeRects: ARENA_SERIES_SHARED.gateAlcoves,
          safeCircles: ARENA_SERIES_SHARED.platforms,
        }
      : undefined,
    bushZones: cfg.bushZones,
    barrels: ARENA_SERIES_SHARED.barrels,
    decorDetails: {
      gateAlcoves: ARENA_SERIES_SHARED.gateAlcoves,
      sealedGates: ARENA_SERIES_SHARED.sealedGates,
      cornerLavaDecor: cfg.cornerLavaDecor,
    },
    flags: ARENA_SERIES_SHARED.flags,
    startSpawns: ARENA_SERIES_SHARED.startSpawns,
    spawnAreas: ARENA_SERIES_SHARED.spawnAreas,
    respawnBays: ARENA_SERIES_SHARED.respawnBays,
  };
}

export const ARENA_SERIES_MAPS: MapData[] = ARENA_SERIES_THEMES.map(buildArenaSeriesMap);
