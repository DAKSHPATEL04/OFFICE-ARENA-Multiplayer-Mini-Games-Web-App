import { PLAYER_COLORS, PROFILE_ICONS } from '../../shared/config.ts';
import type {
  ControlDevice,
  GameStatsRecord,
  MatchHistoryEntry,
  PlayerProfile,
  RecentRoomEntry,
  RoomOptions,
} from '../../shared/types.ts';

export type ThemeMode = 'dark' | 'light' | 'high-contrast';
export type DensityMode = 'comfortable' | 'compact';

export interface PlatformSettings {
  theme: ThemeMode;
  accentColor: string;
  density: DensityMode;
  uiScale: number;
  bigScreenMode: boolean;
  reducedMotion: boolean;
  audio: {
    master: number;
    music: number;
    effects: number;
    uiSounds: boolean;
    muted: boolean;
  };
  graphics: {
    quality: 'auto' | 'high' | 'medium' | 'low';
    resScale: number;
    showFpsPing: boolean;
    particles: boolean;
    screenShake: boolean;
  };
  accessibility: {
    colorblindBadges: boolean;
    largeText: boolean;
    autoFire: boolean;
    oneHanded: boolean;
    haptics: boolean;
  };
  onboarding: {
    welcomed: boolean;
    hubCoachDone: boolean;
    soloSuggested: boolean;
    hostTipSeen: boolean;
    matchHintsSeen: boolean;
  };
}

export interface TouchControlsSettings {
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
  stickX?: number;
  stickY?: number;
  fireX?: number;
  fireY?: number;
}

export interface PcControlBindings {
  forward: string;
  reverse: string;
  turnLeft: string;
  turnRight: string;
  fire: string;
}

export const DEFAULT_PC_BINDINGS: PcControlBindings = {
  forward: 'Space',
  reverse: 'KeyS',
  turnLeft: 'KeyA',
  turnRight: 'KeyD',
  fire: 'MouseLeft',
};

export function formatBindingLabel(code: string): string {
  if (!code) return 'Unbound';
  if (code === 'MouseLeft') return 'Left Click';
  if (code === 'MouseRight') return 'Right Click';
  if (code === 'MouseMiddle') return 'Middle Click';
  if (code === 'Space') return 'Spacebar';
  if (code === 'ArrowUp') return 'Arrow Up';
  if (code === 'ArrowDown') return 'Arrow Down';
  if (code === 'ArrowLeft') return 'Arrow Left';
  if (code === 'ArrowRight') return 'Arrow Right';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

const DEFAULT_PROFILE: PlayerProfile = {
  nickname: `Player${Math.floor(100 + Math.random() * 899)}`,
  colorId: PLAYER_COLORS[0].id,
  iconId: PROFILE_ICONS[0],
  controlStyle: {
    pc: 'PC_ARCADE',
    touch: 'STEER_TWIN_THUMB',
    pad: 'PAD_STEER',
  },
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  theme: 'dark',
  accentColor: '#7C5CFF',
  density: 'comfortable',
  uiScale: 100,
  bigScreenMode: false,
  reducedMotion: false,
  audio: {
    master: 0.7,
    music: 0.25,
    effects: 0.85,
    uiSounds: true,
    muted: false,
  },
  graphics: {
    quality: 'auto',
    resScale: 100,
    showFpsPing: true,
    particles: true,
    screenShake: true,
  },
  accessibility: {
    colorblindBadges: true,
    largeText: false,
    autoFire: false,
    oneHanded: false,
    haptics: true,
  },
  onboarding: {
    welcomed: false,
    hubCoachDone: false,
    soloSuggested: false,
    hostTipSeen: false,
    matchHintsSeen: false,
  },
};

export const DEFAULT_TOUCH_SETTINGS: TouchControlsSettings = {
  stickSize: 140,
  fireSize: 110,
  opacity: 0.45,
  deadZone: 0.12,
  floating: true,
  leftHanded: false,
  rapidFire: true,
  aimAssist: 'light',
  autoFire: false,
  haptics: true,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export const SettingsStore = {
  detectDevice(): ControlDevice {
    if (typeof window === 'undefined') return 'pc';
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isTouch && window.innerWidth < 1024 ? 'touch' : 'pc';
  },

  getProfile(): PlayerProfile {
    const stored = readJson<PlayerProfile>('oa.profile', DEFAULT_PROFILE);
    stored.controlStyle = { ...DEFAULT_PROFILE.controlStyle, ...stored.controlStyle };
    return stored;
  },

  saveProfile(profile: PlayerProfile): void {
    localStorage.setItem('oa.profile', JSON.stringify(profile));
  },

  getSettings(): PlatformSettings {
    const raw = readJson<PlatformSettings>('oa.settings', DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      audio: { ...DEFAULT_SETTINGS.audio, ...raw.audio },
      graphics: { ...DEFAULT_SETTINGS.graphics, ...raw.graphics },
      accessibility: { ...DEFAULT_SETTINGS.accessibility, ...raw.accessibility },
      onboarding: { ...DEFAULT_SETTINGS.onboarding, ...raw.onboarding },
    };
  },

  saveSettings(settings: PlatformSettings): void {
    localStorage.setItem('oa.settings', JSON.stringify(settings));
    this.applyThemeToDocument(settings);
  },

  applyThemeToDocument(settings: PlatformSettings): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-light', 'theme-hc');
    if (settings.theme === 'dark') root.classList.add('dark');
    else if (settings.theme === 'light') root.classList.add('theme-light');
    else root.classList.add('theme-hc');

    root.style.setProperty('--primary', settings.accentColor);
    const scale = settings.bigScreenMode ? Math.max(125, settings.uiScale) : settings.uiScale;
    root.style.setProperty('--ui-scale', String(scale / 100));
    root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    root.dataset.density = settings.density;
  },

  getTouchSettings(): TouchControlsSettings {
    return readJson<TouchControlsSettings>('oa.settings.controls.touch', DEFAULT_TOUCH_SETTINGS);
  },

  saveTouchSettings(cfg: TouchControlsSettings): void {
    localStorage.setItem('oa.settings.controls.touch', JSON.stringify(cfg));
  },

  getPcBindings(): PcControlBindings {
    return readJson<PcControlBindings>('oa.settings.controls.pcBindings', DEFAULT_PC_BINDINGS);
  },

  savePcBindings(bindings: PcControlBindings): void {
    localStorage.setItem('oa.settings.controls.pcBindings', JSON.stringify(bindings));
  },

  getFavorites(): string[] {
    try {
      const raw = localStorage.getItem('oa.favorites');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  },

  toggleFavorite(gameId: string): string[] {
    const favs = new Set(this.getFavorites());
    if (favs.has(gameId)) favs.delete(gameId);
    else favs.add(gameId);
    const list = Array.from(favs);
    localStorage.setItem('oa.favorites', JSON.stringify(list));
    return list;
  },

  getRecentRooms(): RecentRoomEntry[] {
    try {
      const raw = localStorage.getItem('oa.recentRooms');
      return raw ? (JSON.parse(raw) as RecentRoomEntry[]) : [];
    } catch {
      return [];
    }
  },

  pushRecentRoom(entry: RecentRoomEntry): void {
    const list = this.getRecentRooms().filter((r) => r.code !== entry.code);
    list.unshift(entry);
    localStorage.setItem('oa.recentRooms', JSON.stringify(list.slice(0, 3)));
  },

  getGameStats(gameId: string): GameStatsRecord {
    return readJson<GameStatsRecord>(`oa.stats.${gameId}`, {
      matches: 0,
      wins: 0,
      points: 0,
      captures: 0,
      deaths: 0,
    });
  },

  recordMatchStats(gameId: string, entry: MatchHistoryEntry, captures: number): void {
    const cur = this.getGameStats(gameId);
    cur.matches += 1;
    if (entry.won) cur.wins += 1;
    cur.points += entry.myPoints;
    cur.deaths += entry.myDeaths;
    cur.captures += captures;
    localStorage.setItem(`oa.stats.${gameId}`, JSON.stringify(cur));

    const hist = this.getHistory();
    hist.unshift(entry);
    localStorage.setItem('oa.history', JSON.stringify(hist.slice(0, 10)));
  },

  getHistory(): MatchHistoryEntry[] {
    try {
      const raw = localStorage.getItem('oa.history');
      return raw ? (JSON.parse(raw) as MatchHistoryEntry[]) : [];
    } catch {
      return [];
    }
  },

  getRoomDefaults(): Partial<RoomOptions> {
    return readJson<Partial<RoomOptions>>('oa.roomDefaults', {
      visibility: 'private',
      maxPlayers: 8,
      allowSpectators: true,
      allowLateJoin: true,
      startRule: 'host',
    });
  },

  saveRoomDefaults(opts: Partial<RoomOptions>): void {
    localStorage.setItem('oa.roomDefaults', JSON.stringify(opts));
  },

  exportAll(): string {
    return JSON.stringify(
      {
        profile: this.getProfile(),
        settings: this.getSettings(),
        touch: this.getTouchSettings(),
        pcBindings: this.getPcBindings(),
        favorites: this.getFavorites(),
      },
      null,
      2,
    );
  },

  importAll(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr) as Record<string, unknown>;
      if (data.profile) this.saveProfile(data.profile as PlayerProfile);
      if (data.settings) this.saveSettings(data.settings as PlatformSettings);
      if (data.touch) this.saveTouchSettings(data.touch as TouchControlsSettings);
      if (data.pcBindings) this.savePcBindings(data.pcBindings as PcControlBindings);
      if (Array.isArray(data.favorites)) {
        localStorage.setItem('oa.favorites', JSON.stringify(data.favorites));
      }
      return true;
    } catch {
      return false;
    }
  },

  resetTips(): void {
    const s = this.getSettings();
    s.onboarding = { ...DEFAULT_SETTINGS.onboarding };
    this.saveSettings(s);
  },

  resetAllData(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('oa.'));
    for (const k of keys) localStorage.removeItem(k);
    sessionStorage.removeItem('oa.playerToken');
    this.applyThemeToDocument(DEFAULT_SETTINGS);
  },
};
