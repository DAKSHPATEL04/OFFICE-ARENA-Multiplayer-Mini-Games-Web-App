import type { BotBrain } from '../../../../platform/shared/GameModule.ts';
import type { Circle, Point, Rect } from '../maps/types.ts';
import { TANK, type TankInputObj } from '../config.ts';
import { circleIntersectsCircle, circleIntersectsRect } from '../maps/maps.ts';
import type { SimTank, TankArenaSim } from '../sim.ts';

export class TankBotBrain implements BotBrain {
  public readonly difficulty: string;
  private reactionDelay: number;
  private aimErrorDeg: number;
  private thinkTimer = 0;
  private fireSeq = 0;
  private cachedInput: TankInputObj = { seq: 0, throttle: 0, turn: 0, heading: null, fire: 0 };
  private wanderAngle = 0;
  private wanderTimer = 0;

  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    if (difficulty === 'easy') {
      this.reactionDelay = 0.6;
      this.aimErrorDeg = 20;
    } else if (difficulty === 'hard') {
      this.reactionDelay = 0.15;
      this.aimErrorDeg = 4;
    } else {
      this.reactionDelay = 0.35;
      this.aimErrorDeg = 10;
    }
  }

  public think(world: unknown, botId: string, dt: number): TankInputObj {
    const sim = world as TankArenaSim;
    const me = sim.tanks.get(botId);
    if (!me || !me.alive) {
      return { seq: sim.tickCount, throttle: 0, turn: 0, heading: null, fire: this.fireSeq };
    }

    this.thinkTimer -= dt;
    this.wanderTimer -= dt;
    if (this.thinkTimer > 0) {
      return { ...this.cachedInput, seq: sim.tickCount };
    }
    this.thinkTimer = this.reactionDelay * (0.8 + sim.rng.next() * 0.4);

    const solids: Rect[] = [...sim.map.pitWalls, ...sim.map.steelBarriers];
    for (const b of sim.bricks) solids.push(b.rect);
    const solidCircles: Circle[] = sim.map.solidCircles ?? [];

    const avoidCircles: Circle[] = [...solidCircles];
    if (this.difficulty !== 'easy') {
      for (const hz of sim.map.hazardZones ?? []) avoidCircles.push(hz);
      for (const v of sim.vents) {
        if (v.state > 0) avoidCircles.push(v.def);
      }
    }

    const revealDist = TANK.arenaSeries.bush.revealRadius * sim.worldScaleFactor;
    const enemies = sim.tankOrder.filter((t) => {
      if (!t.alive || t.id === me.id) return false;
      if (sim.settings.mode !== 'ffa' && t.team === me.team) return false;
      // Stealth in Green/Swamp Ruins hides tanks beyond 300px
      if (t.stealth && Math.hypot(t.x - me.x, t.y - me.y) > revealDist) return false;
      return true;
    });

    const nearestEnemy = this.findNearest(me, enemies);
    let targetPoint: Point | null = null;
    let aimTarget: SimTank | null = nearestEnemy;

    // Flag mode role logic
    if (sim.settings.mode === 'flag' && sim.flags && me.team !== 'ffa') {
      const myTeam = me.team as 'red' | 'blue';
      const enemyTeam = myTeam === 'red' ? 'blue' : 'red';
      const myFlag = sim.flags[myTeam];
      const enemyFlag = sim.flags[enemyTeam];

      if (enemyFlag.state === 'carried' && enemyFlag.carrierId === me.id) {
        targetPoint = { x: myFlag.padX, y: myFlag.padY };
      } else if (myFlag.state !== 'home') {
        targetPoint = { x: myFlag.x, y: myFlag.y };
        if (myFlag.carrierId) {
          aimTarget = sim.tanks.get(myFlag.carrierId) ?? nearestEnemy;
        }
      } else {
        const roleBucket = me.idx % 3;
        if (roleBucket === 0 || enemyFlag.state === 'dropped') {
          targetPoint = { x: enemyFlag.x, y: enemyFlag.y };
        } else if (roleBucket === 1) {
          const off = 140 * sim.worldScaleFactor;
          targetPoint = {
            x: myFlag.homeX + (myTeam === 'red' ? off : -off),
            y: myFlag.homeY + ((me.idx % 2 === 0 ? -1 : 1) * 100 * sim.worldScaleFactor),
          };
        } else {
          targetPoint = nearestEnemy ? { x: nearestEnemy.x, y: nearestEnemy.y } : { x: sim.stageW / 2, y: sim.stageH / 2 };
        }
      }
    } else {
      if (me.ammo === 0 && this.difficulty === 'hard') {
        const pool = me.team === 'ffa' ? sim.spawnPools.ffa : sim.spawnPools[me.team];
        const safePt = pool[0];
        if (safePt) targetPoint = { x: safePt.x, y: safePt.y };
      }
      if (!targetPoint && this.difficulty !== 'easy') {
        if (!me.activePower) {
          const nearBox = sim.powerBoxes.find((b) => {
            if (!b.active) return false;
            const d = Math.hypot(b.x - me.x, b.y - me.y);
            return d < 320 * sim.worldScaleFactor;
          });
          if (nearBox) targetPoint = { x: nearBox.x, y: nearBox.y };
        }
      }
      if (!targetPoint && nearestEnemy) {
        targetPoint = { x: nearestEnemy.x, y: nearestEnemy.y };
      }
    }

    if (!targetPoint) {
      if (this.wanderTimer <= 0) {
        this.wanderAngle = sim.rng.range(0, 360);
        this.wanderTimer = 2.0;
      }
      targetPoint = {
        x: me.x + Math.cos((this.wanderAngle * Math.PI) / 180) * 180 * sim.worldScaleFactor,
        y: me.y + Math.sin((this.wanderAngle * Math.PI) / 180) * 180 * sim.worldScaleFactor,
      };
    }

    let desiredHeading = (Math.atan2(targetPoint.y - me.y, targetPoint.x - me.x) * 180) / Math.PI;
    desiredHeading = this.avoidObstacles(me, desiredHeading, sim, solids, avoidCircles);

    let shouldFire = false;
    const engageRange = 760 * sim.worldScaleFactor;
    const turnEngageRange = 480 * sim.worldScaleFactor;
    if (aimTarget && me.ammo > 0 && me.cooldownTimer <= 0) {
      const dist = Math.hypot(aimTarget.x - me.x, aimTarget.y - me.y);
      if (dist < engageRange) {
        let aimX = aimTarget.x;
        let aimY = aimTarget.y;
        if (this.difficulty === 'hard') {
          const leadSec = dist / sim.shellSpeed;
          aimX += aimTarget.vx * leadSec * 0.7;
          aimY += aimTarget.vy * leadSec * 0.7;
        }
        const angleToTarget = (Math.atan2(aimY - me.y, aimX - me.x) * 180) / Math.PI;
        const losClear = this.hasLineOfSight(me.x, me.y, aimX, aimY, solids, solidCircles);
        if (losClear) {
          const err = (sim.rng.next() - 0.5) * 2 * this.aimErrorDeg;
          const aimHeading = (angleToTarget + err + 360) % 360;
          const angleDiff = Math.abs((((aimHeading - me.angle + 540) % 360) - 180));
          if (angleDiff <= Math.max(12, this.aimErrorDeg)) {
            shouldFire = true;
          }
          if (dist < turnEngageRange) {
            desiredHeading = aimHeading;
          }
        }
      }
    }

    if (shouldFire) {
      this.fireSeq += 1;
    }

    const throttle = 1;
    if (this.difficulty === 'hard') {
      const dodgeDist = 160 * sim.worldScaleFactor;
      const incoming = sim.shells.find((s) => {
        if (s.ownerId === me.id || (sim.settings.mode !== 'ffa' && s.team === me.team)) return false;
        const dx = me.x - s.x;
        const dy = me.y - s.y;
        return dx * dx + dy * dy < dodgeDist * dodgeDist;
      });
      if (incoming) {
        desiredHeading = (incoming.angle + 90) % 360;
      }
    }

    this.cachedInput = {
      seq: sim.tickCount,
      throttle,
      turn: 0,
      heading: ((desiredHeading % 360) + 360) % 360,
      fire: this.fireSeq,
    };

    return { ...this.cachedInput };
  }

  private findNearest(me: SimTank, candidates: SimTank[]): SimTank | null {
    let best: SimTank | null = null;
    let bestSq = Infinity;
    for (const c of candidates) {
      const dx = c.x - me.x;
      const dy = c.y - me.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestSq) {
        bestSq = dSq;
        best = c;
      }
    }
    return best;
  }

  private avoidObstacles(
    me: SimTank,
    headingDeg: number,
    sim: TankArenaSim,
    solids: Rect[],
    avoidCircles: Circle[],
  ): number {
    const offsets = [0, 35, -35, 70, -70, 115, -115];
    const probeDist = 62 * sim.worldScaleFactor;
    const r = sim.tankRadius + 6 * sim.worldScaleFactor;
    for (const off of offsets) {
      const testDeg = headingDeg + off;
      const rad = (testDeg * Math.PI) / 180;
      const probeX = me.x + Math.cos(rad) * probeDist;
      const probeY = me.y + Math.sin(rad) * probeDist;
      if (
        probeX < r + 8 ||
        probeX > sim.stageW - r - 8 ||
        probeY < r + 8 ||
        probeY > sim.stageH - r - 8
      ) {
        continue;
      }
      const hitsSolid = solids.some((rect) => circleIntersectsRect(probeX, probeY, r, rect));
      if (hitsSolid) continue;
      const hitsCircle = avoidCircles.some((c) => circleIntersectsCircle(probeX, probeY, r, c.x, c.y, c.r));
      if (!hitsCircle) return testDeg;
    }
    return (headingDeg + 180) % 360;
  }

  private hasLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    solids: Rect[],
    solidCircles: Circle[],
  ): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.ceil(dist / 36));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      for (const r of solids) {
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
          return false;
        }
      }
      for (const c of solidCircles) {
        const dx = px - c.x;
        const dy = py - c.y;
        if (dx * dx + dy * dy <= c.r * c.r) return false;
      }
    }
    return true;
  }
}
