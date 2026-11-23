import { TANK } from '../config.ts';
import { ARENA_SERIES_MAPS } from './arenaSeries.ts';
import type { BrickDef, Circle, MapData, Point, Rect } from './types.ts';

function buildBrickRun(x: number, y: number, count: number, vertical: boolean): BrickDef[] {
  const list: BrickDef[] = [];
  for (let i = 0; i < count; i++) {
    if (vertical) {
      list.push({ x, y: y + i * 44, vertical: true });
    } else {
      list.push({ x: x + i * 44, y, vertical: false });
    }
  }
  return list;
}

export const MAP_A: MapData = {
  id: 'A',
  name: 'Steel Yard',
  theme: 'steel',
  series: 'classic',
  accentColor: '#7FA3A8',
  description: 'Symmetrical steel yard with center bunker corridors and corner respawn bays.',
  modes: ['flag', 'team-fight', 'ffa'],
  bestFor: ['flag', 'team-fight'],
  recommendedPlayers: '2–8 players (up to 12)',
  pitWalls: [
    { x: 0, y: 0, w: 176, h: 828 },
    { x: 1616, y: 0, w: 176, h: 828 },
    { x: 0, y: 0, w: 1792, h: 32 },
    { x: 0, y: 796, w: 1792, h: 32 },
    // Corner pits
    { x: 176, y: 0, w: 128, h: 112 },
    { x: 176, y: 112, w: 360, h: 72 },
    { x: 1488, y: 0, w: 128, h: 112 },
    { x: 1256, y: 112, w: 360, h: 72 },
    { x: 176, y: 716, w: 128, h: 112 },
    { x: 176, y: 644, w: 360, h: 72 },
    { x: 1488, y: 716, w: 128, h: 112 },
    { x: 1256, y: 644, w: 360, h: 72 },
    // Center blocks & top/bottom bars
    { x: 544, y: 372, w: 304, h: 104 },
    { x: 944, y: 372, w: 304, h: 104 },
    { x: 720, y: 152, w: 352, h: 64 },
    { x: 720, y: 612, w: 352, h: 64 },
  ],
  steelBarriers: [],
  bricks: [],
  crates: [],
  bushes: [],
  craters: [],
  powerBoxes: [
    { x: 896, y: 310 },
    { x: 896, y: 414 },
    { x: 896, y: 518 },
  ],
  teamGates: {
    red: { x: 472, y: 376, w: 64, h: 96 },
    blue: { x: 1256, y: 376, w: 64, h: 96 },
  },
  flags: {
    red: { flag: { x: 358, y: 420 }, pad: { x: 270, y: 420 } },
    blue: { flag: { x: 1434, y: 420 }, pad: { x: 1522, y: 420 } },
  },
  startSpawns: {
    red: [
      { x: 358, y: 330, angle: 90 },
      { x: 358, y: 498, angle: 90 },
    ],
    blue: [
      { x: 1434, y: 330, angle: 270 },
      { x: 1434, y: 498, angle: 270 },
    ],
  },
  spawnAreas: {
    red: [{ x: 190, y: 196, w: 320, h: 440 }],
    blue: [{ x: 1282, y: 196, w: 320, h: 440 }],
  },
  respawnBays: [
    { x: 344, y: 72 },
    { x: 344, y: 756 },
    { x: 1448, y: 72 },
    { x: 1448, y: 756 },
  ],
};

export const MAP_E: MapData = {
  id: 'E',
  name: 'Sand Camp',
  theme: 'sand',
  series: 'classic',
  accentColor: '#E0C070',
  description: 'Destructible brick fortifications guarding each flag with striped steel midfield cover.',
  modes: ['flag', 'team-fight', 'ffa'],
  bestFor: ['flag'],
  recommendedPlayers: '2–8 players (up to 12)',
  playBounds: { x: 120, y: 0, w: 1552, h: 828 },
  pitWalls: [
    { x: 0, y: 0, w: 120, h: 828 },
    { x: 1672, y: 0, w: 120, h: 828 },
    { x: 0, y: -24, w: 1792, h: 24 },
    { x: 0, y: 828, w: 1792, h: 24 },
  ],
  steelBarriers: [
    // C-bays
    { x: 272, y: 0, w: 176, h: 36 },
    { x: 272, y: 112, w: 176, h: 36 },
    { x: 272, y: 0, w: 36, h: 148 },
    { x: 1344, y: 0, w: 176, h: 36 },
    { x: 1344, y: 112, w: 176, h: 36 },
    { x: 1484, y: 0, w: 36, h: 148 },
    { x: 272, y: 792, w: 176, h: 36 },
    { x: 272, y: 680, w: 176, h: 36 },
    { x: 272, y: 680, w: 36, h: 148 },
    { x: 1344, y: 792, w: 176, h: 36 },
    { x: 1344, y: 680, w: 176, h: 36 },
    { x: 1484, y: 680, w: 36, h: 148 },
    // Center point-symmetric barriers
    { x: 764, y: 176, w: 84, h: 160 },
    { x: 944, y: 492, w: 84, h: 160 },
  ],
  bricks: [
    ...buildBrickRun(156, 254, 3, false),
    ...buildBrickRun(156, 550, 3, false),
    ...buildBrickRun(276, 284, 3, true),
    ...buildBrickRun(276, 434, 3, true),
    ...buildBrickRun(1504, 254, 3, false),
    ...buildBrickRun(1504, 550, 3, false),
    ...buildBrickRun(1488, 284, 3, true),
    ...buildBrickRun(1488, 434, 3, true),
  ],
  crates: [{ x: 896, y: 696 }],
  bushes: [
    { x: 738, y: 55 },
    { x: 1165, y: 128 },
    { x: 1120, y: 340 },
    { x: 492, y: 535 },
    { x: 648, y: 755 },
    { x: 1120, y: 698 },
  ],
  craters: [],
  powerBoxes: [
    { x: 896, y: 414 },
    { x: 540, y: 240 },
    { x: 1252, y: 588 },
  ],
  flags: {
    red: { flag: { x: 222, y: 414 }, pad: { x: 152, y: 414 } },
    blue: { flag: { x: 1570, y: 414 }, pad: { x: 1640, y: 414 } },
  },
  startSpawns: {
    red: [
      { x: 225, y: 330, angle: 0 },
      { x: 225, y: 500, angle: 0 },
    ],
    blue: [
      { x: 1567, y: 330, angle: 180 },
      { x: 1567, y: 500, angle: 180 },
    ],
  },
  spawnAreas: {
    red: [
      { x: 160, y: 290, w: 110, h: 250 },
      { x: 320, y: 170, w: 230, h: 500 },
    ],
    blue: [
      { x: 1522, y: 290, w: 110, h: 250 },
      { x: 1242, y: 170, w: 230, h: 500 },
    ],
  },
  respawnBays: [
    { x: 380, y: 74 },
    { x: 380, y: 754 },
    { x: 1412, y: 74 },
    { x: 1412, y: 754 },
  ],
};

export const MAP_G: MapData = {
  id: 'G',
  name: 'Duel Field',
  theme: 'sand',
  series: 'classic',
  accentColor: '#DFC58B',
  description: 'Open combat arena framed by brick columns and four recessed alcove bays.',
  modes: ['flag', 'team-fight', 'ffa'],
  bestFor: ['team-fight'],
  recommendedPlayers: '2–8 players (up to 12)',
  pitWalls: [
    { x: 0, y: 0, w: 224, h: 828 },
    { x: 1568, y: 0, w: 224, h: 828 },
    { x: 224, y: 0, w: 90, h: 148 },
    { x: 314, y: 0, w: 90, h: 36 },
    { x: 404, y: 0, w: 984, h: 148 },
    { x: 1388, y: 0, w: 90, h: 36 },
    { x: 1478, y: 0, w: 90, h: 148 },
    { x: 224, y: 662, w: 90, h: 166 },
    { x: 314, y: 774, w: 90, h: 54 },
    { x: 404, y: 662, w: 984, h: 166 },
    { x: 1388, y: 774, w: 90, h: 54 },
    { x: 1478, y: 662, w: 90, h: 166 },
  ],
  steelBarriers: [],
  bricks: [
    ...buildBrickRun(456, 260, 3, true),
    ...buildBrickRun(456, 434, 3, true),
    ...buildBrickRun(1308, 260, 3, true),
    ...buildBrickRun(1308, 434, 3, true),
  ],
  crates: [{ x: 360, y: 620 }],
  bushes: [
    { x: 684, y: 304 },
    { x: 1108, y: 304 },
    { x: 908, y: 222 },
    { x: 896, y: 572 },
    { x: 1120, y: 496 },
  ],
  craters: [],
  powerBoxes: [
    { x: 896, y: 300 },
    { x: 896, y: 414 },
    { x: 896, y: 528 },
  ],
  flags: {
    red: { flag: { x: 340, y: 414 }, pad: { x: 266, y: 414 } },
    blue: { flag: { x: 1452, y: 414 }, pad: { x: 1526, y: 414 } },
  },
  startSpawns: {
    red: [
      { x: 358, y: 332, angle: 0 },
      { x: 358, y: 496, angle: 0 },
    ],
    blue: [
      { x: 1434, y: 332, angle: 180 },
      { x: 1434, y: 496, angle: 180 },
    ],
  },
  spawnAreas: {
    red: [{ x: 244, y: 164, w: 192, h: 482 }],
    blue: [{ x: 1356, y: 164, w: 192, h: 482 }],
  },
  respawnBays: [
    { x: 358, y: 92 },
    { x: 358, y: 718 },
    { x: 1434, y: 92 },
    { x: 1434, y: 718 },
  ],
};

export const MAP_H: MapData = {
  id: 'H',
  name: 'Sand Cross',
  theme: 'sand',
  series: 'classic',
  accentColor: '#E3C37A',
  description: 'Four-quadrant Free For All crossroads built for up to 12 tanks.',
  modes: ['flag', 'team-fight', 'ffa'],
  bestFor: ['ffa'],
  recommendedPlayers: '3–12 players',
  playBounds: { x: 0, y: 0, w: 1792, h: 828 },
  pitWalls: [
    { x: 0, y: 0, w: 1792, h: 24 },
    { x: 0, y: 804, w: 1792, h: 24 },
    { x: 0, y: 0, w: 24, h: 828 },
    { x: 1768, y: 0, w: 24, h: 828 },
  ],
  steelBarriers: [
    { x: 854, y: 214, w: 84, h: 160 },
    { x: 558, y: 380, w: 196, h: 70 },
    { x: 1040, y: 380, w: 196, h: 70 },
    { x: 854, y: 456, w: 84, h: 160 },
  ],
  bricks: [
    ...buildBrickRun(234, 190, 3, false),
    ...buildBrickRun(366, 58, 3, true),
    ...buildBrickRun(1414, 190, 3, false),
    ...buildBrickRun(1398, 58, 3, true),
    ...buildBrickRun(234, 610, 3, false),
    ...buildBrickRun(366, 638, 3, true),
    ...buildBrickRun(1414, 610, 3, false),
    ...buildBrickRun(1398, 638, 3, true),
  ],
  crates: [{ x: 896, y: 414 }],
  bushes: [
    { x: 738, y: 55 },
    { x: 1165, y: 128 },
    { x: 1376, y: 312 },
    { x: 492, y: 535 },
    { x: 1590, y: 515 },
    { x: 648, y: 755 },
  ],
  craters: [{ x: 1120, y: 698 }],
  powerBoxes: [
    { x: 896, y: 150 },
    { x: 896, y: 678 },
    { x: 660, y: 250 },
    { x: 1132, y: 578 },
  ],
  flags: {
    red: { flag: { x: 240, y: 414 }, pad: { x: 130, y: 414 } },
    blue: { flag: { x: 1552, y: 414 }, pad: { x: 1662, y: 414 } },
  },
  startSpawns: {
    red: [
      { x: 260, y: 90, angle: 45 },
      { x: 260, y: 738, angle: 315 },
    ],
    blue: [
      { x: 1530, y: 90, angle: 135 },
      { x: 1530, y: 738, angle: 225 },
    ],
    ffa: [
      { x: 260, y: 90, angle: 45 },
      { x: 1530, y: 90, angle: 135 },
      { x: 260, y: 738, angle: 315 },
      { x: 1530, y: 738, angle: 225 },
      { x: 896, y: 80, angle: 90 },
      { x: 896, y: 748, angle: 270 },
      { x: 200, y: 414, angle: 0 },
      { x: 1592, y: 414, angle: 180 },
      { x: 560, y: 200, angle: 30 },
      { x: 1232, y: 200, angle: 150 },
      { x: 560, y: 628, angle: 330 },
      { x: 1232, y: 628, angle: 210 },
    ],
  },
  spawnAreas: {
    red: [{ x: 140, y: 60, w: 560, h: 708 }],
    blue: [{ x: 1092, y: 60, w: 560, h: 708 }],
  },
};

export const MAP_J: MapData = {
  id: 'J',
  name: 'Grass Blocks',
  theme: 'grass',
  series: 'classic',
  accentColor: '#3DBB74',
  description: 'Diagonal grass arena where flags rest right on their home pads—guard yours closely!',
  modes: ['flag', 'team-fight', 'ffa'],
  bestFor: ['flag'],
  recommendedPlayers: '2–8 players (up to 12)',
  pointMirrored: true,
  strictFlagHomeDefault: true,
  playBounds: { x: 176, y: 32, w: 1440, h: 764 },
  pitWalls: [
    { x: 0, y: 0, w: 176, h: 828 },
    { x: 1616, y: 0, w: 176, h: 828 },
    { x: 0, y: 0, w: 1792, h: 32 },
    { x: 0, y: 796, w: 1792, h: 32 },
    // Blocks
    { x: 642, y: 148, w: 132, h: 108 },
    { x: 964, y: 148, w: 132, h: 108 },
    { x: 696, y: 572, w: 132, h: 108 },
    { x: 1018, y: 572, w: 132, h: 108 },
    // T-walls
    { x: 270, y: 296, w: 44, h: 256 },
    { x: 176, y: 296, w: 94, h: 32 },
    { x: 176, y: 520, w: 94, h: 32 },
    { x: 1478, y: 296, w: 44, h: 256 },
    { x: 1522, y: 296, w: 94, h: 32 },
    { x: 1522, y: 520, w: 94, h: 32 },
    // Notches
    { x: 448, y: 32, w: 88, h: 40 },
    { x: 1256, y: 756, w: 88, h: 40 },
  ],
  steelBarriers: [],
  bricks: [],
  crates: [],
  bushes: [
    { x: 403, y: 423 },
    { x: 805, y: 423 },
    { x: 985, y: 423 },
    { x: 1390, y: 423 },
  ],
  craters: [],
  powerBoxes: [
    { x: 896, y: 414 },
    { x: 520, y: 270 },
    { x: 1272, y: 558 },
  ],
  flags: {
    red: { flag: { x: 358, y: 728 }, pad: { x: 358, y: 728 } },
    blue: { flag: { x: 1434, y: 100 }, pad: { x: 1434, y: 100 } },
  },
  startSpawns: {
    red: [
      { x: 356, y: 620, angle: 270 },
      { x: 458, y: 720, angle: 0 },
    ],
    blue: [
      { x: 1436, y: 208, angle: 90 },
      { x: 1334, y: 108, angle: 180 },
    ],
  },
  spawnAreas: {
    red: [{ x: 190, y: 520, w: 420, h: 260 }],
    blue: [{ x: 1182, y: 48, w: 420, h: 260 }],
  },
};

const arenaMapById = Object.fromEntries(ARENA_SERIES_MAPS.map((m) => [m.id, m])) as Record<
  'lava' | 'desert' | 'snow' | 'grass' | 'swamp',
  MapData
>;

export const TANK_MAPS: Record<MapData['id'], MapData> = {
  ...arenaMapById,
  A: MAP_A,
  E: MAP_E,
  G: MAP_G,
  H: MAP_H,
  J: MAP_J,
};

export const TANK_MAP_LIST: MapData[] = [
  ...ARENA_SERIES_MAPS,
  MAP_A,
  MAP_E,
  MAP_G,
  MAP_H,
  MAP_J,
];

const LEGACY_MAP_ALIASES: Record<string, MapData['id']> = {
  V: 'lava',
  R: 'grass',
  F: 'snow',
  C: 'desert',
};

export function resolveMapId(requested: string, modeId: string, playerCount: number): MapData['id'] {
  if (requested && requested in LEGACY_MAP_ALIASES) {
    return LEGACY_MAP_ALIASES[requested];
  }
  if (requested && requested !== 'auto' && requested !== 'random' && requested in TANK_MAPS) {
    return requested as MapData['id'];
  }
  if (modeId === 'ffa') return 'desert';
  if (modeId === 'team-fight') return playerCount <= 4 ? 'snow' : 'grass';
  return 'lava';
}

export function circleIntersectsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

export function circleIntersectsCircle(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const sum = ar + br;
  return dx * dx + dy * dy < sum * sum;
}

export function getBrickRect(b: BrickDef): Rect {
  return b.vertical ? { x: b.x, y: b.y, w: 28, h: 44 } : { x: b.x, y: b.y, w: 44, h: 28 };
}

function isWalkableCell(map: MapData, x: number, y: number, r: number, solids: Rect[], circles: Circle[]): boolean {
  const stage = map.stage ?? TANK.stage;
  if (x < r || x > stage.w - r || y < r || y > stage.h - r) return false;
  for (const rect of solids) {
    if (circleIntersectsRect(x, y, r, rect)) return false;
  }
  for (const c of circles) {
    if (circleIntersectsCircle(x, y, r, c.x, c.y, c.r)) return false;
  }
  return true;
}

function verifyConnectivity(map: MapData, solids: Rect[], circles: Circle[], tankRadius: number): string[] {
  const errors: string[] = [];
  const stage = map.stage ?? TANK.stage;
  const step = map.series === 'arena-series' ? 60 : 32;
  const cols = Math.ceil(stage.w / step);
  const rows = Math.ceil(stage.h / step);
  const toGrid = (pt: Point) => ({
    gx: Math.max(0, Math.min(cols - 1, Math.round(pt.x / step))),
    gy: Math.max(0, Math.min(rows - 1, Math.round(pt.y / step))),
  });

  const walkable = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const wx = gx * step;
      const wy = gy * step;
      if (isWalkableCell(map, wx, wy, tankRadius * 0.85, solids, circles)) {
        walkable[gy * cols + gx] = 1;
      }
    }
  }

  const startPt = map.startSpawns.red[0];
  if (!startPt) return errors;
  const startCell = toGrid(startPt);

  // Find nearest walkable cell to startPt
  let seedIdx = startCell.gy * cols + startCell.gx;
  if (!walkable[seedIdx]) {
    let bestD = Infinity;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (!walkable[gy * cols + gx]) continue;
        const d = (gx - startCell.gx) ** 2 + (gy - startCell.gy) ** 2;
        if (d < bestD) {
          bestD = d;
          seedIdx = gy * cols + gx;
        }
      }
    }
  }

  const visited = new Uint8Array(cols * rows);
  const queue: number[] = [seedIdx];
  visited[seedIdx] = 1;
  let head = 0;
  const dirs = [1, -1, cols, -cols];
  while (head < queue.length) {
    const cur = queue[head++];
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
    for (let i = 0; i < 4; i++) {
      const nx = cx + (i === 0 ? 1 : i === 1 ? -1 : 0);
      const ny = cy + (i === 2 ? 1 : i === 3 ? -1 : 0);
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nIdx = ny * cols + nx;
      if (walkable[nIdx] && !visited[nIdx]) {
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  const checkReachable = (label: string, pt: Point) => {
    const g = toGrid(pt);
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) {
      for (let dx = -1; dx <= 1 && !ok; dx++) {
        const nx = g.gx + dx;
        const ny = g.gy + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && visited[ny * cols + nx]) {
          ok = true;
        }
      }
    }
    if (!ok) {
      errors.push(`Map ${map.id}: ${label} (${pt.x},${pt.y}) is unreachable from spawn`);
    }
  };

  map.startSpawns.red.forEach((s, i) => checkReachable(`red spawn ${i}`, s));
  map.startSpawns.blue.forEach((s, i) => checkReachable(`blue spawn ${i}`, s));
  map.startSpawns.ffa?.forEach((s, i) => checkReachable(`ffa spawn ${i}`, s));
  map.powerBoxes.forEach((p, i) => checkReachable(`powerBox ${i}`, p));
  if (map.flags) {
    checkReachable('red flag', map.flags.red.flag);
    checkReachable('blue flag', map.flags.blue.flag);
  }

  return errors;
}

export function validateMap(map: MapData): string[] {
  const errors: string[] = [];
  const scale = map.tankScale ?? 1;
  const tankRadius = TANK.radius * scale;
  const spawnClear = map.series === 'arena-series' ? TANK.arenaSeries.spawnWallClearPx : tankRadius;
  const allSolids: Rect[] = [...map.pitWalls, ...map.steelBarriers, ...map.bricks.map(getBrickRect)];
  const solidCircles: Circle[] = map.solidCircles ?? [];

  const checkClear = (label: string, x: number, y: number, r: number) => {
    for (const rect of allSolids) {
      if (circleIntersectsRect(x, y, r, rect)) {
        errors.push(`Map ${map.id}: ${label} (${x},${y}) overlaps solid rect (${rect.x},${rect.y},${rect.w},${rect.h})`);
      }
    }
    for (const c of solidCircles) {
      if (circleIntersectsCircle(x, y, r, c.x, c.y, c.r)) {
        errors.push(`Map ${map.id}: ${label} (${x},${y}) overlaps solid circle (${c.x},${c.y},r${c.r})`);
      }
    }
  };

  map.startSpawns.red.forEach((s, i) => checkClear(`red spawn ${i}`, s.x, s.y, spawnClear));
  map.startSpawns.blue.forEach((s, i) => checkClear(`blue spawn ${i}`, s.x, s.y, spawnClear));
  map.startSpawns.ffa?.forEach((s, i) => checkClear(`ffa spawn ${i}`, s.x, s.y, spawnClear));

  if (map.flags) {
    const flagR = map.series === 'arena-series' ? tankRadius : tankRadius;
    checkClear('red flag', map.flags.red.flag.x, map.flags.red.flag.y, flagR);
    checkClear('red pad', map.flags.red.pad.x, map.flags.red.pad.y, flagR);
    checkClear('blue flag', map.flags.blue.flag.x, map.flags.blue.flag.y, flagR);
    checkClear('blue pad', map.flags.blue.pad.x, map.flags.blue.pad.y, flagR);
  }

  map.powerBoxes.forEach((p, i) => checkClear(`powerBox ${i}`, p.x, p.y, tankRadius));
  const permanentSolids: Rect[] = [...map.pitWalls, ...map.steelBarriers];
  errors.push(...verifyConnectivity(map, permanentSolids, solidCircles, tankRadius));

  return errors;
}

export function generateMapSvgDataUrl(mapId: string, modeId: string): string {
  const resolvedId = resolveMapId(mapId, modeId, 8);
  const map = TANK_MAPS[resolvedId];
  const stage = map.stage ?? TANK.stage;

  const themePalettes: Record<string, { ground: string; grid: string; wall: string; wallEdge: string; platform: string }> = {
    lava: { ground: '#2A1916', grid: 'rgba(255,106,43,0.12)', wall: '#3E2E2B', wallEdge: '#FF6A2B', platform: '#4E3933' },
    sand: { ground: '#C89E68', grid: 'rgba(92,58,28,0.10)', wall: '#6A4D33', wallEdge: '#E8A24A', platform: '#D7B98A' },
    frost: { ground: '#A6D0EB', grid: 'rgba(255,255,255,0.22)', wall: '#466179', wallEdge: '#8FD3FF', platform: '#CFE9F7' },
    grass: { ground: '#4D8A3E', grid: 'rgba(18,52,20,0.12)', wall: '#4B5546', wallEdge: '#6CC04A', platform: '#8D9582' },
    swamp: { ground: '#2C463B', grid: 'rgba(90,214,141,0.12)', wall: '#38463E', wallEdge: '#5AD68D', platform: '#5A6D60' },
    steel: { ground: '#A9BFC0', grid: 'rgba(0,0,0,0.06)', wall: '#3C4252', wallEdge: '#B8D4D6', platform: '#8E9FA2' },
    river: { ground: '#7FA3A8', grid: 'rgba(0,0,0,0.06)', wall: '#3C4252', wallEdge: '#B8D4D6', platform: '#7A99A0' },
  };
  const pal = themePalettes[map.theme] ?? themePalettes.steel;
  const s = map.series === 'arena-series' ? 2.5 : 1;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="520" height="292">`);
  parts.push(`<rect width="${stage.w}" height="${stage.h}" fill="${pal.ground}" />`);

  // Subtle grid
  const gridStep = Math.round(96 * s);
  parts.push(`<g stroke="${pal.grid}" stroke-width="${2 * s}">`);
  for (let x = gridStep; x < stage.w; x += gridStep) {
    parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${stage.h}" />`);
  }
  for (let y = gridStep; y < stage.h; y += gridStep) {
    parts.push(`<line x1="0" y1="${y}" x2="${stage.w}" y2="${y}" />`);
  }
  parts.push(`</g>`);

  // Corner Lava Decor
  for (const c of map.decorDetails?.cornerLavaDecor ?? []) {
    parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="rgba(255,95,20,0.65)" />`);
  }

  // Speed zones (rocky path / swamp mud)
  for (const sz of map.speedZones ?? []) {
    const fill = sz.kind === 'mud' ? 'rgba(68,54,32,0.72)' : 'rgba(130,104,76,0.55)';
    const stroke = sz.kind === 'mud' ? '#5AD68D' : '#8C6D4F';
    parts.push(`<circle cx="${sz.x}" cy="${sz.y}" r="${sz.r}" fill="${fill}" stroke="${stroke}" stroke-width="${2 * s}" stroke-dasharray="${8 * s} ${6 * s}" />`);
  }

  // Hazard zones (lava cracks)
  for (const hz of map.hazardZones ?? []) {
    parts.push(`<circle cx="${hz.x}" cy="${hz.y}" r="${hz.r}" fill="rgba(255,80,20,0.58)" stroke="#FFB347" stroke-width="${3 * s}" />`);
  }

  // Eruption vent
  for (const v of map.eruptionVents ?? []) {
    parts.push(`<circle cx="${v.x}" cy="${v.y}" r="${v.r}" fill="rgba(255,60,0,0.45)" stroke="#FF6A2B" stroke-width="${4 * s}" />`);
    parts.push(`<circle cx="${v.x}" cy="${v.y}" r="${v.r * 0.45}" fill="#FFD166" />`);
  }

  // Corner platforms
  for (const p of map.platforms ?? []) {
    parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${pal.platform}" stroke="${pal.wallEdge}" stroke-width="${4 * s}" />`);
    parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${p.r * 0.62}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="${2 * s}" />`);
  }

  // Gate alcoves & sealed gates
  for (const g of map.decorDetails?.gateAlcoves ?? []) {
    parts.push(`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="rgba(255,255,255,0.08)" stroke="${pal.wallEdge}" stroke-width="${2 * s}" />`);
  }

  // Spawn areas (classic maps)
  if (!map.platforms) {
    for (const r of map.spawnAreas.red) {
      parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="16" fill="rgba(242,58,18,0.14)" stroke="rgba(242,58,18,0.4)" stroke-dasharray="14 10" stroke-width="4" />`);
    }
    for (const r of map.spawnAreas.blue) {
      parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="16" fill="rgba(63,111,224,0.14)" stroke="rgba(63,111,224,0.4)" stroke-dasharray="14 10" stroke-width="4" />`);
    }
  }

  // Wall drop shadows (lower-right)
  for (const w of map.pitWalls) {
    parts.push(`<rect x="${w.x + 8 * s}" y="${w.y + 8 * s}" width="${w.w}" height="${w.h}" fill="rgba(0,0,0,0.34)" />`);
  }

  // Walls
  for (const w of map.pitWalls) {
    parts.push(`<rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="${pal.wall}" stroke="${pal.wallEdge}" stroke-width="${2.5 * s}" />`);
  }

  // Solid center stepped pyramid (desert / snow)
  for (const sc of map.solidCircles ?? []) {
    parts.push(`<circle cx="${sc.x + 10 * s}" cy="${sc.y + 10 * s}" r="${sc.r}" fill="rgba(0,0,0,0.36)" />`);
    parts.push(`<circle cx="${sc.x}" cy="${sc.y}" r="${sc.r}" fill="${pal.wall}" stroke="${pal.wallEdge}" stroke-width="${4 * s}" />`);
    parts.push(`<rect x="${sc.x - sc.r * 0.56}" y="${sc.y - sc.r * 0.56}" width="${sc.r * 1.12}" height="${sc.r * 1.12}" fill="${pal.platform}" stroke="${pal.wallEdge}" stroke-width="${2.5 * s}" />`);
    parts.push(`<rect x="${sc.x - sc.r * 0.28}" y="${sc.y - sc.r * 0.28}" width="${sc.r * 0.56}" height="${sc.r * 0.56}" fill="${pal.wallEdge}" />`);
  }

  for (const st of map.steelBarriers) {
    parts.push(`<rect x="${st.x}" y="${st.y}" width="${st.w}" height="${st.h}" fill="#8FA6AA" stroke="#F2C400" stroke-width="5" />`);
  }

  for (const b of map.bricks) {
    const r = getBrickRect(b);
    parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="#C98A4B" stroke="#784B21" stroke-width="3" />`);
  }

  for (const c of map.crates) {
    const cs = 22 * s;
    parts.push(`<rect x="${c.x - cs}" y="${c.y - cs}" width="${cs * 2}" height="${cs * 2}" rx="${4 * s}" fill="#B57A40" stroke="#4D2E14" stroke-width="${3 * s}" />`);
  }

  map.powerBoxes.forEach((p, idx) => {
    const ps = 20 * s;
    const pStyle =
      idx % 3 === 0
        ? { fill: 'rgba(0,184,255,0.32)', stroke: '#7CE8FF' } // Shield
        : idx % 3 === 1
          ? { fill: 'rgba(0,229,195,0.30)', stroke: '#00E5C3' } // Speed 2x
          : { fill: 'rgba(255,106,43,0.35)', stroke: '#FFD166' }; // Fireball
    parts.push(`<rect x="${p.x - ps}" y="${p.y - ps}" width="${ps * 2}" height="${ps * 2}" rx="${6 * s}" fill="${pStyle.fill}" stroke="${pStyle.stroke}" stroke-width="${3 * s}" />`);
  });

  for (const bz of map.bushZones ?? []) {
    parts.push(`<circle cx="${bz.x}" cy="${bz.y}" r="${bz.r}" fill="rgba(46,139,87,0.72)" stroke="#A7F3D0" stroke-width="${3 * s}" />`);
  }
  if (!map.bushZones) {
    for (const b of map.bushes) {
      parts.push(`<circle cx="${b.x}" cy="${b.y}" r="26" fill="rgba(46,139,87,0.75)" stroke="#1E5E3A" stroke-width="4" />`);
    }
  }

  // Flag stands (always shown clearly on Arena Series or when Flag mode selected)
  if (map.flags && (modeId === 'flag' || map.series === 'arena-series')) {
    const capR = map.captureRadius ?? 40;
    parts.push(`<circle cx="${map.flags.red.pad.x}" cy="${map.flags.red.pad.y}" r="${capR}" fill="rgba(242,58,18,0.24)" stroke="#F23A12" stroke-width="${4 * s}" />`);
    parts.push(`<polygon points="${map.flags.red.flag.x - 10 * s},${map.flags.red.flag.y - 24 * s} ${map.flags.red.flag.x + 22 * s},${map.flags.red.flag.y - 10 * s} ${map.flags.red.flag.x - 10 * s},${map.flags.red.flag.y + 4 * s}" fill="#FF4D4D" stroke="#FFFFFF" stroke-width="${2.5 * s}" />`);
    parts.push(`<circle cx="${map.flags.blue.pad.x}" cy="${map.flags.blue.pad.y}" r="${capR}" fill="rgba(63,111,224,0.24)" stroke="#3F6FE0" stroke-width="${4 * s}" />`);
    parts.push(`<polygon points="${map.flags.blue.flag.x - 10 * s},${map.flags.blue.flag.y - 24 * s} ${map.flags.blue.flag.x + 22 * s},${map.flags.blue.flag.y - 10 * s} ${map.flags.blue.flag.x - 10 * s},${map.flags.blue.flag.y + 4 * s}" fill="#4D8BFF" stroke="#FFFFFF" stroke-width="${2.5 * s}" />`);
  }

  parts.push(`</svg>`);
  return `data:image/svg+xml;utf8,${encodeURIComponent(parts.join(''))}`;
}
