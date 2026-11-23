export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
}

export type MapTheme = 'steel' | 'sand' | 'grass' | 'river' | 'lava' | 'frost' | 'swamp';

export type ArenaRuleTag =
  | 'lava-hazards'
  | 'eruption-vent'
  | 'center-pyramid'
  | 'rocky-slow'
  | 'ice-physics'
  | 'bush-stealth'
  | 'swamp-mud'
  | 'explosive-barrels';

export interface BrickDef {
  x: number;
  y: number;
  vertical?: boolean;
}

export interface HazardCircle extends Circle {
  dps: number;
  kind: 'lava';
}

export interface EruptionVent extends Circle {
  cycleSec: number;
  warnSec: number;
  eruptSec: number;
  damage: number;
  knockback: number;
}

export interface SpeedZoneCircle extends Circle {
  mult: number;
  kind: 'rocky' | 'mud';
}

export interface MapData {
  id: 'lava' | 'desert' | 'snow' | 'grass' | 'swamp' | 'A' | 'E' | 'G' | 'H' | 'J';
  name: string;
  theme: MapTheme;
  series: 'arena-series' | 'classic';
  accentColor?: string;
  ruleTags?: ArenaRuleTag[];
  backgroundImage?: string;
  description: string;
  modes: Array<'flag' | 'team-fight' | 'ffa'>;
  bestFor: Array<'flag' | 'team-fight' | 'ffa'>;
  recommendedPlayers: string;
  stage?: { w: number; h: number };
  tankScale?: number;
  captureRadius?: number;
  pointMirrored?: boolean;
  strictFlagHomeDefault?: boolean;
  playBounds?: Rect;
  pitWalls: Rect[];
  steelBarriers: Rect[];
  bricks: BrickDef[];
  crates: Point[];
  bushes: Point[];
  craters: Point[];
  powerBoxes: Point[];
  platforms?: Circle[];
  solidCircles?: Circle[];
  hazardZones?: HazardCircle[];
  eruptionVents?: EruptionVent[];
  speedZones?: SpeedZoneCircle[];
  iceWorld?: {
    enabled: boolean;
    friction: number;
    steerLag: number;
    safeRects: Rect[];
    safeCircles: Circle[];
  };
  bushZones?: Circle[];
  barrels?: Point[];
  decorDetails?: {
    gateAlcoves: Rect[];
    sealedGates: Rect[];
    cornerLavaDecor?: Circle[];
  };
  teamGates?: { red: Rect; blue: Rect };
  flags?: {
    red: { flag: Point; pad: Point };
    blue: { flag: Point; pad: Point };
  };
  startSpawns: {
    red: SpawnPoint[];
    blue: SpawnPoint[];
    ffa?: SpawnPoint[];
  };
  spawnAreas: {
    red: Rect[];
    blue: Rect[];
  };
  respawnBays?: Point[];
}
