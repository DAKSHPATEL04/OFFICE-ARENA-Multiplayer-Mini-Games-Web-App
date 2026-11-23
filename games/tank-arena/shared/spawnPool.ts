import { SeededRandom } from '../../../platform/shared/seededRandom.ts';
import type { TeamId } from '../../../platform/shared/types.ts';
import { TANK } from './config.ts';
import { circleIntersectsCircle, circleIntersectsRect, getBrickRect } from './maps/maps.ts';
import type { Circle, MapData, Point, Rect, SpawnPoint } from './maps/types.ts';

export interface SpawnPools {
  red: SpawnPoint[];
  blue: SpawnPoint[];
  ffa: SpawnPoint[];
}

function isPointClear(
  x: number,
  y: number,
  stageW: number,
  stageH: number,
  solids: Rect[],
  solidCircles: Circle[],
  hazardCircles: Circle[],
  flagsAndPads: Point[],
  wallClear: number,
  flagClear: number,
): boolean {
  if (x < wallClear || x > stageW - wallClear || y < wallClear || y > stageH - wallClear) {
    return false;
  }
  for (const r of solids) {
    if (circleIntersectsRect(x, y, wallClear, r)) return false;
  }
  for (const c of solidCircles) {
    if (circleIntersectsCircle(x, y, wallClear, c.x, c.y, c.r)) return false;
  }
  for (const hz of hazardCircles) {
    if (circleIntersectsCircle(x, y, wallClear * 0.6, hz.x, hz.y, hz.r)) return false;
  }
  for (const fp of flagsAndPads) {
    const dx = x - fp.x;
    const dy = y - fp.y;
    if (dx * dx + dy * dy < flagClear * flagClear) return false;
  }
  return true;
}

function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function samplePool(
  candidates: Point[],
  seedPoints: SpawnPoint[],
  targetCount: number,
  minSpacing: number,
  defaultAngle: number,
  rng: SeededRandom,
): SpawnPoint[] {
  const selected: SpawnPoint[] = [];
  for (const s of seedPoints) {
    if (selected.length < targetCount) {
      selected.push({ ...s });
    }
  }

  let spacing = minSpacing;
  while (selected.length < targetCount && spacing >= 32) {
    let addedInPass = false;
    while (selected.length < targetCount) {
      let bestCandidate: Point | null = null;
      let bestMinDist = -1;

      for (const c of candidates) {
        let minD = Infinity;
        for (const s of selected) {
          const d = Math.sqrt(distSq(c, s));
          if (d < minD) minD = d;
        }
        if (minD >= spacing) {
          const score = minD + rng.next() * 0.5;
          if (score > bestMinDist) {
            bestMinDist = score;
            bestCandidate = c;
          }
        }
      }

      if (!bestCandidate) break;
      selected.push({ x: bestCandidate.x, y: bestCandidate.y, angle: defaultAngle });
      addedInPass = true;
    }
    if (!addedInPass) {
      spacing = spacing === 64 ? 48 : spacing - 16;
    } else if (selected.length < targetCount) {
      spacing = spacing === 64 ? 48 : spacing - 16;
    }
  }

  while (selected.length < targetCount && candidates.length > 0) {
    let bestCandidate: Point = candidates[0];
    let bestMinDist = -1;
    for (const c of candidates) {
      let minD = Infinity;
      for (const s of selected) {
        const d = Math.sqrt(distSq(c, s));
        if (d < minD) minD = d;
      }
      if (minD > bestMinDist) {
        bestMinDist = minD;
        bestCandidate = c;
      }
    }
    selected.push({ x: bestCandidate.x, y: bestCandidate.y, angle: defaultAngle });
    if (bestMinDist <= 0) break;
  }

  return selected;
}

export function buildSpawnPools(map: MapData, seed: number): SpawnPools {
  const rng = new SeededRandom(seed ^ 0x9e3779b9);
  const stage = map.stage ?? TANK.stage;
  const scale = map.tankScale ?? 1;
  const wallClear = map.series === 'arena-series' ? TANK.arenaSeries.spawnWallClearPx : TANK.spawnPool.wallClearPx;
  const flagClear = TANK.spawnPool.flagClearPx * scale;
  const teamSpacing = TANK.spawnPool.teamSpacingPx * scale;
  const ffaSpacing = TANK.spawnPool.ffaSpacingPx * scale;

  const solids: Rect[] = [
    ...map.pitWalls,
    ...map.steelBarriers,
    ...map.bricks.map(getBrickRect),
  ];
  const solidCircles: Circle[] = map.solidCircles ?? [];
  const hazardCircles: Circle[] = [...(map.hazardZones ?? []), ...(map.eruptionVents ?? [])];

  const flagsAndPads: Point[] = [];
  if (map.flags) {
    flagsAndPads.push(map.flags.red.flag, map.flags.red.pad, map.flags.blue.flag, map.flags.blue.pad);
  }

  const grid = Math.round(TANK.spawnPool.gridPx * scale);
  const redCandidates: Point[] = [];
  for (const area of map.spawnAreas.red) {
    for (let x = area.x + grid / 2; x <= area.x + area.w - grid / 2; x += grid) {
      for (let y = area.y + grid / 2; y <= area.y + area.h - grid / 2; y += grid) {
        if (
          isPointClear(
            x,
            y,
            stage.w,
            stage.h,
            solids,
            solidCircles,
            hazardCircles,
            flagsAndPads,
            wallClear,
            flagClear,
          )
        ) {
          redCandidates.push({ x: Math.round(x), y: Math.round(y) });
        }
      }
    }
  }

  const redPool = samplePool(
    redCandidates,
    map.startSpawns.red,
    TANK.spawnPool.perTeam,
    teamSpacing,
    map.startSpawns.red[0]?.angle ?? 0,
    rng,
  );

  // Mirror Red's pool to Blue
  const bluePool: SpawnPoint[] = redPool.map((p, idx) => {
    if (idx < map.startSpawns.blue.length) {
      return { ...map.startSpawns.blue[idx] };
    }
    if (map.pointMirrored) {
      return {
        x: stage.w - p.x,
        y: stage.h - p.y,
        angle: (p.angle + 180) % 360,
      };
    }
    return {
      x: stage.w - p.x,
      y: p.y,
      angle: (180 - p.angle + 360) % 360,
    };
  });

  // FFA pool: use explicit map FFA spawns if 12 exist, otherwise sample whole arena
  let ffaPool: SpawnPoint[];
  if (map.startSpawns.ffa && map.startSpawns.ffa.length >= TANK.spawnPool.ffa) {
    ffaPool = map.startSpawns.ffa.slice(0, TANK.spawnPool.ffa).map((s) => ({ ...s }));
  } else {
    const ffaCandidates: Point[] = [];
    const padX = Math.round(96 * scale);
    const padY = Math.round(64 * scale);
    for (let x = padX; x <= stage.w - padX; x += grid) {
      for (let y = padY; y <= stage.h - padY; y += grid) {
        if (
          isPointClear(
            x,
            y,
            stage.w,
            stage.h,
            solids,
            solidCircles,
            hazardCircles,
            flagsAndPads,
            wallClear,
            flagClear,
          )
        ) {
          ffaCandidates.push({ x, y });
        }
      }
    }
    const baseSeeds: SpawnPoint[] = [
      ...(map.startSpawns.ffa ?? []),
      ...map.startSpawns.red,
      ...map.startSpawns.blue,
    ];
    ffaPool = samplePool(
      ffaCandidates,
      baseSeeds,
      TANK.spawnPool.ffa,
      ffaSpacing,
      0,
      rng,
    );
  }

  return { red: redPool, blue: bluePool, ffa: ffaPool };
}

export function pickBestSpawnIndex(
  pool: SpawnPoint[],
  tanks: Array<{ id: string; team: TeamId; x: number; y: number; alive: boolean }>,
  selfId: string,
  selfTeam: TeamId,
  lastSpawnIdx: number | null,
  tankClearPx: number = TANK.spawnPool.tankClearPx,
): number {
  if (pool.length === 0) return 0;
  const clearDistSq = tankClearPx * tankClearPx;

  let bestIdx = -1;
  let bestEnemyDist = -1;

  for (let i = 0; i < pool.length; i++) {
    if (pool.length > 1 && i === lastSpawnIdx) continue;
    const pt = pool[i];
    let blocked = false;
    let nearestEnemySq = Infinity;

    for (const t of tanks) {
      if (!t.alive || t.id === selfId) continue;
      const dSq = distSq(pt, t);
      if (dSq < clearDistSq) {
        blocked = true;
        break;
      }
      const isEnemy = selfTeam === 'ffa' || t.team !== selfTeam;
      if (isEnemy && dSq < nearestEnemySq) {
        nearestEnemySq = dSq;
      }
    }

    if (!blocked) {
      if (nearestEnemySq > bestEnemyDist) {
        bestEnemyDist = nearestEnemySq;
        bestIdx = i;
      }
    }
  }

  if (bestIdx !== -1) return bestIdx;

  let fallbackIdx = 0;
  let maxNearestDist = -1;
  for (let i = 0; i < pool.length; i++) {
    let minTankSq = Infinity;
    for (const t of tanks) {
      if (!t.alive || t.id === selfId) continue;
      const dSq = distSq(pool[i], t);
      if (dSq < minTankSq) minTankSq = dSq;
    }
    if (minTankSq > maxNearestDist) {
      maxNearestDist = minTankSq;
      fallbackIdx = i;
    }
  }
  return fallbackIdx;
}
