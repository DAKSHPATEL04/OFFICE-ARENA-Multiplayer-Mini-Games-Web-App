import { PLATFORM_API } from '../../platform/shared/config.ts';
import type {
  BotBrain,
  ClientContext,
  GameClient,
  GameModule,
  GameRoom,
  RoomContext,
} from '../../platform/shared/GameModule.ts';
import howToData from './howto.json' with { type: 'json' };
import { TankArenaRoom } from './server/TankArenaRoom.ts';
import { TankBotBrain } from './shared/bots/botBrain.ts';
import { resolveAutoScale, TANK, TANK_PRESETS } from './shared/config.ts';
import { generateMapSvgDataUrl, resolveMapId, TANK_MAP_LIST, TANK_MAPS } from './shared/maps/maps.ts';

class DeferredTankArenaClient implements GameClient {
  private inner: GameClient | null = null;
  private destroyed = false;
  private queuedSnapshots: unknown[] = [];
  private queuedEvents: unknown[] = [];
  private paused = false;
  private styleId: string | null = null;
  private spectator: boolean | null = null;

  constructor(ctx: ClientContext) {
    import('./client/TankArenaClientImpl.ts').then(({ TankArenaClientImpl }) => {
      if (this.destroyed) return;
      this.inner = new TankArenaClientImpl(ctx);
      if (this.styleId) this.inner.setControlStyle(this.styleId);
      if (this.spectator !== null) this.inner.setSpectatorMode(this.spectator);
      this.inner.setPaused(this.paused);
      for (const s of this.queuedSnapshots) this.inner.applySnapshot(s, Date.now());
      for (const e of this.queuedEvents) this.inner.applyEvent(e);
      this.queuedSnapshots = [];
      this.queuedEvents = [];
    });
  }

  applySnapshot(snapshot: unknown, serverTime: number): void {
    if (this.inner) this.inner.applySnapshot(snapshot, serverTime);
    else this.queuedSnapshots = [snapshot];
  }

  applyEvent(event: unknown): void {
    if (this.inner) this.inner.applyEvent(event);
    else this.queuedEvents.push(event);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.inner) this.inner.setPaused(paused);
  }

  setControlStyle(styleId: string): void {
    this.styleId = styleId;
    if (this.inner) this.inner.setControlStyle(styleId);
  }

  setSpectatorMode(isSpectator: boolean): void {
    this.spectator = isSpectator;
    if (this.inner) this.inner.setSpectatorMode(isSpectator);
  }

  resize(width: number, height: number): void {
    if (this.inner) this.inner.resize(width, height);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.inner) this.inner.destroy();
  }
}

export const tankArenaModule: GameModule = {
  id: 'tank-arena',
  requires: PLATFORM_API,
  isNew: true,
  meta: {
    name: 'Tank Arena',
    tagline: '2D top-down tank battles for 2 to 12 players',
    description:
      'Capture the enemy flag, team up in 6v6 skirmishes, or battle up to 12 tanks in Free For All across 10 tactical arenas.',
    icon: '/src/assets/images/tank_arena_icon_1795319703622.jpg',
    banner: '/src/assets/images/tank_card_banner_1795428450837.jpg',
    tags: ['action', 'party', 'team', 'quick'],
    minPlayers: TANK.players.min,
    maxPlayers: TANK.players.max,
    defaultMaxPlayers: TANK.players.defaultMax,
    maxSpectators: TANK.players.spectatorsMax,
    maxLocalPlayers: TANK.players.localMax,
    teamSize: { min: 1, max: TANK.players.perTeamMax },
    avgMinutes: 3,
    supports: { online: true, localParty: true, solo: true },
    devices: { keyboardMouse: true, touch: true, gamepad: true },
  },
  modes: [
    {
      id: 'flag',
      name: 'Flag',
      planText: 'Grab the enemy flag and carry it back to your own pad!',
      tip: 'Carriers move at 90% speed. Touch a dropped friendly flag to return it instantly.',
      teamType: 'teams',
      minPlayers: 2,
      maxPlayers: 12,
      badge: 'Default',
    },
    {
      id: 'team-fight',
      name: 'Team Fight',
      planText: 'Destroy enemy tanks to reach the target score before time runs out!',
      tip: 'Coordinate pushes with your team up to 6v6.',
      teamType: 'teams',
      minPlayers: 2,
      maxPlayers: 12,
    },
    {
      id: 'ffa',
      name: 'Free For All',
      planText: 'Every tank for itself! Outscore up to 11 rivals to claim victory.',
      tip: 'Watch your flanks and grab power boxes for shields or speed.',
      teamType: 'ffa',
      minPlayers: 2,
      maxPlayers: 12,
    },
  ],
  maps: TANK_MAP_LIST.map((m) => ({
    id: m.id,
    name: m.name,
    theme: m.theme,
    series: m.series,
    accentColor: m.accentColor,
    ruleTags: m.ruleTags,
    description: m.description,
    modes: m.modes,
    recommendedPlayers: m.recommendedPlayers,
    bestFor: m.bestFor,
    backgroundImage: m.backgroundImage,
  })),
  settingsSchema: [
    {
      key: 'mode',
      label: 'Game Mode',
      group: 'match',
      type: 'select',
      defaultValue: 'flag',
      options: [
        { value: 'flag', label: 'Flag (Capture)' },
        { value: 'team-fight', label: 'Team Fight' },
        { value: 'ffa', label: 'Free For All' },
      ],
    },
    {
      key: 'map',
      label: 'Arena Map',
      group: 'match',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { value: 'auto', label: 'Auto (Best for Mode)' },
        { value: 'lava', label: 'Lava Crater (Arena Series)' },
        { value: 'desert', label: 'Desert Ruins (Arena Series)' },
        { value: 'snow', label: 'Frozen Ruins (Arena Series)' },
        { value: 'grass', label: 'Green Ruins (Arena Series)' },
        { value: 'swamp', label: 'Swamp Ruins (Arena Series)' },
        { value: 'A', label: 'A · Steel Yard' },
        { value: 'E', label: 'E · Sand Camp' },
        { value: 'G', label: 'G · Duel Field' },
        { value: 'H', label: 'H · Sand Cross' },
        { value: 'J', label: 'J · Grass Blocks' },
      ],
    },
    {
      key: 'timeLimit',
      label: 'Time Limit',
      group: 'match',
      type: 'select',
      defaultValue: 'auto',
      autoOption: true,
      options: [
        { value: 'auto', label: 'Auto (Scales with players)' },
        { value: 60, label: '1:00' },
        { value: 120, label: '2:00' },
        { value: 180, label: '3:00' },
        { value: 240, label: '4:00' },
        { value: 300, label: '5:00' },
        { value: 600, label: '10:00' },
      ],
    },
    {
      key: 'capturesToWin',
      label: 'Captures to Win',
      group: 'match',
      type: 'select',
      defaultValue: 'auto',
      visibleWhen: (s) => (s.mode ?? 'flag') === 'flag',
      options: [
        { value: 'auto', label: 'Auto (1–3)' },
        { value: 1, label: '1 Capture' },
        { value: 2, label: '2 Captures' },
        { value: 3, label: '3 Captures' },
        { value: 5, label: '5 Captures' },
      ],
    },
    {
      key: 'pointsToWin',
      label: 'Points to Win',
      group: 'match',
      type: 'select',
      defaultValue: 'auto',
      visibleWhen: (s) => s.mode === 'team-fight' || s.mode === 'ffa',
      options: [
        { value: 'auto', label: 'Auto (3–8)' },
        { value: 3, label: '3 Points' },
        { value: 5, label: '5 Points' },
        { value: 8, label: '8 Points' },
        { value: 15, label: '15 Points' },
        { value: 30, label: '30 Points' },
      ],
    },
    {
      key: 'fillBots',
      label: 'Fill with Bots',
      group: 'bots',
      type: 'select',
      defaultValue: 'even',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'even', label: 'Even Teams' },
        { value: 'max', label: 'Fill to Max Players' },
      ],
    },
    {
      key: 'botCount',
      label: 'Manual Bots',
      group: 'bots',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      key: 'botDifficulty',
      label: 'Bot Difficulty',
      group: 'bots',
      type: 'select',
      defaultValue: 'medium',
      options: [
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    {
      key: 'damagePct',
      label: 'Tank Power (Damage %)',
      group: 'combat',
      type: 'number',
      defaultValue: 100,
      min: 10,
      max: 100,
      step: 5,
      unit: '%',
    },
    {
      key: 'ammoMax',
      label: 'Ammo Rack Size',
      group: 'combat',
      type: 'number',
      defaultValue: 5,
      min: 3,
      max: 8,
      step: 1,
    },
    {
      key: 'ammoReturnSec',
      label: 'Ammo Reload (sec)',
      group: 'combat',
      type: 'number',
      defaultValue: 1.5,
      min: 0.8,
      max: 3.0,
      step: 0.1,
      unit: 's',
    },
    {
      key: 'tankSpeedPct',
      label: 'Tank Speed',
      group: 'combat',
      type: 'number',
      defaultValue: 100,
      min: 80,
      max: 130,
      step: 10,
      unit: '%',
    },
    {
      key: 'shellRicochets',
      label: 'Shell Ricochets',
      group: 'combat',
      type: 'select',
      defaultValue: 0,
      options: [
        { value: 0, label: '0 (Explode on Wall)' },
        { value: 1, label: '1 Bounce' },
        { value: 2, label: '2 Bounces' },
      ],
    },
    {
      key: 'bricksBreakable',
      label: 'Breakable Bricks',
      group: 'world',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'powerBoxes',
      label: 'Power Boxes',
      group: 'world',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'few', label: 'Few' },
        { value: 'normal', label: 'Normal' },
        { value: 'many', label: 'Many' },
      ],
    },
    {
      key: 'strictFlagHome',
      label: 'Own Flag Must Be Home',
      group: 'world',
      type: 'boolean',
      defaultValue: false,
      visibleWhen: (s) => (s.mode ?? 'flag') === 'flag',
    },
    {
      key: 'friendlyFire',
      label: 'Friendly Fire',
      group: 'combat',
      type: 'boolean',
      defaultValue: false,
      visibleWhen: (s) => s.mode !== 'ffa',
    },
    {
      key: 'controlStylesAllowed',
      label: 'Allowed Control Styles',
      group: 'controls',
      type: 'select',
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All Styles Allowed' },
        { value: 'standard-only', label: 'Standard Only' },
      ],
    },
    {
      key: 'aimAssistAllowed',
      label: 'Allow Touch Aim Assist',
      group: 'controls',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'recoilEnabled',
      label: 'Arcade Recoil Turn',
      group: 'controls',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'afkRemoval',
      label: 'AFK Auto-Spectate',
      group: 'match',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'mapLook',
      label: 'Arena Lighting',
      group: 'world',
      type: 'select',
      defaultValue: 'default',
      options: [
        { value: 'default', label: 'Daylight' },
        { value: 'night', label: 'Night Ops' },
      ],
    },
  ],
  presets: TANK_PRESETS,
  controlStyles: [
    {
      id: 'PC_ARCADE',
      name: 'Arcade (Space + Click)',
      shortLabel: 'Arcade',
      devices: ['pc'],
      styleGroup: 'ARCADE',
      summaryLines: [
        'Tank auto-rotates smoothly when Space is released',
        'Hold Space: stop spinning & drive forward',
        'Left Click: fire shell & reverse rotation direction',
      ],
      recommended: true,
      badge: 'Space + Mouse',
      demoType: 'arcade',
    },
    {
      id: 'PC_STANDARD',
      name: 'Standard (WASD)',
      shortLabel: 'WASD',
      devices: ['pc'],
      styleGroup: 'STANDARD',
      summaryLines: ['W / S: forward & reverse', 'A / D: rotate hull', 'Space or Click: fire (no recoil turn)'],
      badge: 'Classic WASD',
      demoType: 'standard',
    },
    {
      id: 'PC_MOUSE_STEER',
      name: 'Mouse Steer',
      shortLabel: 'Mouse',
      devices: ['pc'],
      styleGroup: 'STEER',
      summaryLines: ['Move Mouse: aim & turn tank', 'Hold Right Click or W: drive', 'Left Click or Space: fire'],
      demoType: 'steer',
    },
    {
      id: 'PC_CUSTOM',
      name: 'Custom Keys & Mouse',
      shortLabel: 'Custom',
      devices: ['pc'],
      styleGroup: 'STANDARD',
      summaryLines: [
        'Bind any key for drive, reverse, turn & fire',
        'Supports Mouse Clicks, Space, WASD, or Arrows',
        'Saved automatically across matches',
      ],
      badge: 'Key Mapper',
      demoType: 'standard',
    },
    {
      id: 'STEER_TWIN_THUMB',
      name: 'Twin-Thumb Stick',
      shortLabel: 'Twin-Thumb',
      devices: ['touch'],
      styleGroup: 'STEER',
      summaryLines: ['Left Thumb: floating steer stick', 'Right Thumb: tap or hold FIRE', '60% pivot rule for tight turns'],
      recommended: true,
      badge: 'Recommended',
      demoType: 'steer',
    },
    {
      id: 'TOUCH_TANK_PAD',
      name: 'Tank Pad Buttons',
      shortLabel: 'Tank Pad',
      devices: ['touch'],
      styleGroup: 'STANDARD',
      summaryLines: ['Left Thumb: Left / Right rotate buttons', 'Right Thumb: Drive & FIRE buttons'],
      demoType: 'standard',
    },
    {
      id: 'TOUCH_ONE_THUMB',
      name: 'One-Thumb Arcade',
      shortLabel: 'One-Thumb',
      devices: ['touch'],
      styleGroup: 'ARCADE',
      summaryLines: ['Touch & Hold anywhere: drive', 'Quick Tap: fire + recoil turn'],
      demoType: 'arcade',
    },
    {
      id: 'PAD_STEER',
      name: 'Gamepad Twin Stick',
      shortLabel: 'Gamepad',
      devices: ['pad'],
      styleGroup: 'STEER',
      summaryLines: ['Left Stick: steer & drive', 'A or RT: fire cannon', 'Start: pause menu'],
      recommended: true,
      demoType: 'steer',
    },
  ],
  controls: {
    pc: [
      { input: 'Space (hold)', action: 'Lock aim & drive forward (release to auto-rotate)' },
      { input: 'Left Click', action: 'Fire shell & reverse rotation direction' },
      { input: 'W S A D / Mouse', action: 'Available in Standard (WASD) or Mouse Steer styles' },
      { input: 'Tab (hold)', action: 'Scoreboard' },
      { input: 'Esc / ?', action: 'Pause / Controls Overlay' },
      { input: 'Local Party Keys', action: 'P1: Q · P2: P · P3: Z · P4: M' },
    ],
    touch: [
      { input: 'Left Zone', action: 'Floating Virtual Stick (Twin-Thumb)' },
      { input: 'Right Button', action: 'FIRE (tap or hold)' },
      { input: 'Local Party', action: '4 Corner Buttons (hold drive, tap fire)' },
    ],
    pad: [
      { input: 'Left Stick', action: 'Steer & Throttle' },
      { input: 'A or RT', action: 'Fire Shell' },
      { input: 'Start', action: 'Pause' },
    ],
  },
  howTo: howToData,
  results: {
    columns: [
      { key: 'points', label: 'Points', align: 'right' },
      { key: 'deaths', label: 'Deaths', align: 'right' },
      { key: 'accuracy', label: 'Accuracy', align: 'right' },
      { key: 'captures', label: 'Flags', align: 'right' },
    ],
  },
  assets: [],
  tickRate: TANK.tickRate,
  computeAutoScaleSummary(settings, playerCount) {
    const modeId = String(settings.mode ?? 'flag');
    const mapId = resolveMapId(String(settings.map ?? 'auto'), modeId, playerCount);
    const mapName = TANK_MAPS[mapId]?.name ?? 'Lava Crater';
    const modeName = modeId === 'flag' ? 'Flag' : modeId === 'team-fight' ? 'Team Fight' : 'Free For All';
    const auto = resolveAutoScale(playerCount);
    const timeLabel = settings.timeLimit === 'auto' || !settings.timeLimit ? `${Math.round(auto.timeSec / 60)}m (Auto)` : `${Math.round(Number(settings.timeLimit) / 60)}m`;
    const dmg = Number(settings.damagePct ?? (Number(settings.hitsToDestroy ?? 1) === 2 ? 50 : 100));
    const hits = Math.ceil(100 / Math.max(10, dmg));
    const splitLabel = modeId === 'ffa' ? `${playerCount} FFA` : `${Math.ceil(playerCount / 2)} vs ${Math.floor(playerCount / 2)}`;
    return `${modeName} · ${mapName} · ${splitLabel} · ${timeLabel} · ${dmg}% dmg (${hits} ${hits === 1 ? 'hit' : 'hits'})`;
  },
  renderMapPreview(mapId, modeId) {
    return generateMapSvgDataUrl(mapId, modeId);
  },
  createServerRoom(ctx: RoomContext): GameRoom {
    return new TankArenaRoom(ctx);
  },
  createClientScene(ctx: ClientContext): GameClient {
    return new DeferredTankArenaClient(ctx);
  },
  createBot(difficulty: string): BotBrain {
    return new TankBotBrain(difficulty);
  },
};

export default tankArenaModule;
