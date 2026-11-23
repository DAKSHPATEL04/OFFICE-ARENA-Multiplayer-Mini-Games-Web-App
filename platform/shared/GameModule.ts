import type { ControlDevice, MatchResult, PlayModeType, RoomPlayer, TeamId } from './types.ts';

export interface ModeDef {
  id: string;
  name: string;
  planText: string;
  tip: string;
  teamType: 'teams' | 'ffa';
  minPlayers: number;
  maxPlayers: number;
  badge?: string;
}

export interface MapDef {
  id: string;
  name: string;
  theme: string;
  series?: 'arena-series' | 'classic';
  accentColor?: string;
  ruleTags?: string[];
  description: string;
  modes: string[];
  recommendedPlayers: string;
  bestFor: string[];
  backgroundImage?: string;
  thumbnailDataUrl?: string;
}

export interface SettingOptionDef {
  value: string | number | boolean;
  label: string;
}

export interface SettingDef {
  key: string;
  label: string;
  group: 'match' | 'combat' | 'world' | 'controls' | 'bots';
  type: 'select' | 'number' | 'boolean' | 'multiselect';
  defaultValue: unknown;
  options?: SettingOptionDef[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  autoOption?: boolean;
  visibleWhen?: (settings: Record<string, unknown>) => boolean;
}

export interface PresetDef {
  id: string;
  name: string;
  description: string;
  values: Record<string, unknown>;
}

export interface ControlStyleDef {
  id: string;
  name: string;
  shortLabel: string;
  devices: ControlDevice[];
  styleGroup: 'ARCADE' | 'STANDARD' | 'STEER';
  summaryLines: string[];
  recommended?: boolean;
  badge?: string;
  demoType: 'arcade' | 'standard' | 'steer';
}

export interface ControlBindingDoc {
  input: string;
  action: string;
  hint?: string;
}

export interface ControlsDoc {
  pc: ControlBindingDoc[];
  touch: ControlBindingDoc[];
  pad: ControlBindingDoc[];
}

export interface HowToStep {
  title: string;
  body: string;
}

export interface HowToDoc {
  goal: string;
  inviteSteps: string[];
  steps: HowToStep[];
  tips: string[];
}

export interface ResultColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ResultsSchema {
  columns: ResultColumnDef[];
}

export interface AssetDef {
  key: string;
  type: 'image' | 'audio';
  url: string;
  fallbackShape?: string;
}

export interface RoomContext {
  roomCode: string;
  seed: number;
  players: RoomPlayer[];
  settings: Record<string, unknown>;
  mode: PlayModeType;
  emitEvent: (event: unknown) => void;
  onPlayerRemoved?: (playerId: string) => void;
}

export interface ClientContext {
  container: HTMLElement;
  localPlayerId: string;
  localPlayers?: Array<{ id: string; nickname: string; colorId: string; team: TeamId; inputSlot: number }>;
  playMode: PlayModeType;
  isSpectator: boolean;
  mapId: string;
  seed: number;
  settings: Record<string, unknown>;
  players: RoomPlayer[];
  controlStyle: string;
  onSendInput: (payload: unknown) => void;
  onRequestPause: () => void;
  onRequestJoinMatch?: () => void;
  onLocalMatchEnd?: (result: MatchResult) => void;
  onHudUpdate?: (hudState: unknown) => void;
}

export interface BotBrain {
  difficulty: string;
  think(world: unknown, botId: string, dt: number): unknown;
}

export interface GameRoom {
  onPlayerJoin(player: RoomPlayer): void;
  onPlayerLeave(playerId: string): void;
  onReconnect(playerId: string): void;
  onLateJoin?(player: RoomPlayer): boolean;
  onInput(playerId: string, payload: unknown): void;
  canLateJoin?(elapsedSec: number): boolean;
  tick(dt: number): void;
  getSnapshot(): unknown;
  getEvents(): unknown[];
  isFinished(): MatchResult | null;
}

export interface GameClient {
  applySnapshot(snapshot: unknown, serverTime: number): void;
  applyEvent(event: unknown): void;
  setPaused(paused: boolean): void;
  setControlStyle(styleId: string): void;
  setSpectatorMode(isSpectator: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface GameModule {
  id: string;
  requires: number;
  isTemplate?: boolean;
  isNew?: boolean;
  meta: {
    name: string;
    tagline: string;
    description: string;
    icon: string;
    banner: string;
    tags: string[];
    minPlayers: number;
    maxPlayers: number;
    defaultMaxPlayers: number;
    maxSpectators: number;
    maxLocalPlayers: number;
    teamSize?: { min: number; max: number };
    avgMinutes: number;
    supports: {
      online: boolean;
      localParty: boolean;
      solo: boolean;
    };
    devices: {
      keyboardMouse: boolean;
      touch: boolean;
      gamepad: boolean;
    };
  };
  modes: ModeDef[];
  maps?: MapDef[];
  settingsSchema: SettingDef[];
  presets?: PresetDef[];
  controlStyles: ControlStyleDef[];
  controls: ControlsDoc;
  howTo: HowToDoc;
  results: ResultsSchema;
  assets: AssetDef[];
  tickRate: number;
  computeAutoScaleSummary?: (settings: Record<string, unknown>, playerCount: number) => string;
  renderMapPreview?: (mapId: string, modeId: string) => string;
  createServerRoom(ctx: RoomContext): GameRoom;
  createClientScene(ctx: ClientContext): GameClient;
  createBot?(difficulty: string): BotBrain;
}
