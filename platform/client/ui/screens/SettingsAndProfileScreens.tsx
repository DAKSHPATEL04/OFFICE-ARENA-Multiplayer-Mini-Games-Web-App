import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  Gamepad2,
  HelpCircle,
  Monitor,
  Play,
  RotateCcw,
  Sliders,
  Smartphone,
  Upload,
  Volume2,
} from 'lucide-react';
import { PLAYER_COLORS, PROFILE_ICONS } from '../../../shared/config.ts';
import type { GameClient, GameModule } from '../../../shared/GameModule.ts';
import type { ControlDevice, MatchHistoryEntry, PlayerProfile } from '../../../shared/types.ts';
import {
  DEFAULT_PC_BINDINGS,
  DEFAULT_TOUCH_SETTINGS,
  formatBindingLabel,
  SettingsStore,
  type PcControlBindings,
  type PlatformSettings,
  type TouchControlsSettings,
} from '../../core/SettingsStore.ts';
import { Modal, ProfileIconSvg, ShapeColorBadge } from '../components/PlayerBadge.tsx';

export const ProfileScreen: React.FC<{
  profile: PlayerProfile;
  gameId: string;
  history: MatchHistoryEntry[];
  onSaveProfile: (p: PlayerProfile) => void;
  onResetAll: () => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}> = ({ profile, gameId, history, onSaveProfile, onResetAll, onBack, onToast }) => {
  const [nickname, setNickname] = useState(profile.nickname);
  const [colorId, setColorId] = useState(profile.colorId);
  const [iconId, setIconId] = useState(profile.iconId);
  const stats = SettingsStore.getGameStats(gameId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nickname.trim().slice(0, 14) || 'Player';
    onSaveProfile({ ...profile, nickname: clean, colorId, iconId });
    onToast('Profile saved');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form onSubmit={handleSave} className="arena-glass rounded-3xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <ShapeColorBadge colorId={colorId} size={36} />
            <ProfileIconSvg iconId={iconId} size={26} className="text-[var(--accent)]" />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">Your Profile</h1>
              <div className="text-xs text-[var(--text-dim)]">Saved automatically to this browser</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Nickname (1–14 chars)</label>
            <input
              type="text"
              minLength={1}
              maxLength={14}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-base font-bold"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Tank Color & Shape</label>
            <div className="grid grid-cols-6 gap-2">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorId(c.id)}
                  className={`p-2 rounded-xl border flex items-center justify-center ${
                    colorId === c.id ? 'border-[var(--accent)] bg-[var(--surface-2)]' : 'border-[var(--border)]'
                  }`}
                >
                  <ShapeColorBadge colorId={c.id} size={24} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Emblem Icon</label>
            <div className="grid grid-cols-8 gap-2">
              {PROFILE_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIconId(ic)}
                  className={`p-2 rounded-xl border flex items-center justify-center ${
                    iconId === ic
                      ? 'border-[var(--accent)] bg-[var(--surface-2)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-dim)]'
                  }`}
                >
                  <ProfileIconSvg iconId={ic} size={18} />
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full arena-btn-primary py-3 rounded-xl font-bold">
            Save Profile
          </button>
        </form>

        <div className="space-y-5">
          <div className="arena-glass rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-[var(--text)]">Career Stats</h2>
            <div className="grid grid-cols-2 gap-3 tabular-nums">
              <div className="p-3 rounded-xl bg-[var(--surface)]">
                <div className="text-xs text-[var(--text-dim)]">Matches</div>
                <div className="text-2xl font-bold">{stats.matches}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)]">
                <div className="text-xs text-[var(--text-dim)]">Wins</div>
                <div className="text-2xl font-bold text-[var(--success)]">{stats.wins}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)]">
                <div className="text-xs text-[var(--text-dim)]">Total Points</div>
                <div className="text-2xl font-bold text-[var(--gold)]">{stats.points}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)]">
                <div className="text-xs text-[var(--text-dim)]">Flag Captures</div>
                <div className="text-2xl font-bold text-[var(--accent)]">{stats.captures}</div>
              </div>
            </div>
          </div>

          <div className="arena-glass rounded-3xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text)]">Recent Matches</h2>
              <button
                type="button"
                onClick={onResetAll}
                className="text-xs font-bold text-[#FF4D6D] hover:underline"
              >
                Reset All Data
              </button>
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-[var(--text-dim)]">No matches played on this device yet.</div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-[var(--surface)] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[var(--text)]">{h.winnerLabel}</div>
                      <div className="text-[var(--text-dim)]">
                        {h.modeId} · Map {h.mapId}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className={h.won ? 'font-bold text-[var(--success)]' : 'text-[var(--text-dim)]'}>
                        {h.won ? 'Victory' : 'Finished'}
                      </div>
                      <div>{h.myPoints} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SettingsScreen: React.FC<{
  settings: PlatformSettings;
  onUpdate: (next: PlatformSettings) => void;
  onOpenControls: () => void;
  onOpenTouchEditor: () => void;
  onResetAll: () => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}> = ({ settings, onUpdate, onOpenControls, onOpenTouchEditor, onResetAll, onBack, onToast }) => {
  const [tab, setTab] = useState<'audio' | 'graphics' | 'controls' | 'access' | 'data'>('audio');
  const [lastKey, setLastKey] = useState<string>('Press any key...');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setLastKey(`${e.code} (${e.key === ' ' ? 'Space' : e.key})`);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const accents = ['#7C5CFF', '#00B8FF', '#00E5C3', '#FF8A3D', '#3DDC97', '#FF4D6D'];

  const handleExport = () => {
    const blob = new Blob([SettingsStore.exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'office-arena-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    onToast('Settings exported');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => {
      if (SettingsStore.importAll(txt)) {
        onUpdate(SettingsStore.getSettings());
        onToast('Settings imported');
      } else {
        onToast('Invalid settings file');
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="arena-glass rounded-3xl p-6 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">Settings</h1>

        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[var(--surface)]">
          {(
            [
              ['audio', 'Audio'],
              ['graphics', 'Graphics & Theme'],
              ['controls', 'Controls'],
              ['access', 'Accessibility'],
              ['data', 'Data'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                tab === id ? 'arena-btn-primary text-white' : 'text-[var(--text-dim)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'audio' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className="font-bold flex items-center gap-2">
                <Volume2 size={18} /> Mute All Audio
              </span>
              <input
                type="checkbox"
                checked={settings.audio.muted}
                onChange={(e) => onUpdate({ ...settings, audio: { ...settings.audio, muted: e.target.checked } })}
                className="w-5 h-5"
              />
            </label>
            {(
              [
                ['master', 'Master Volume'],
                ['music', 'Music Volume'],
                ['effects', 'Effects Volume'],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <div className="flex justify-between text-sm font-bold">
                  <span>{label}</span>
                  <span className="tabular-nums">{Math.round(settings.audio[k] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.audio[k]}
                  onChange={(e) =>
                    onUpdate({ ...settings, audio: { ...settings.audio, [k]: Number(e.target.value) } })
                  }
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}

        {tab === 'graphics' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="font-bold">Theme</span>
              <div className="flex gap-2">
                {(['dark', 'light', 'high-contrast'] as const).map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => onUpdate({ ...settings, theme: th })}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold capitalize ${
                      settings.theme === th ? 'arena-btn-primary text-white' : 'bg-[var(--surface-2)]'
                    }`}
                  >
                    {th.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="font-bold">Accent Color</span>
              <div className="flex gap-2">
                {accents.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onUpdate({ ...settings, accentColor: hex })}
                    style={{ backgroundColor: hex }}
                    className={`w-8 h-8 rounded-full border-2 ${
                      settings.accentColor === hex ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    aria-label={`Accent ${hex}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="font-bold">Quality Preset</span>
              <select
                value={settings.graphics.quality}
                onChange={(e) =>
                  onUpdate({
                    ...settings,
                    graphics: { ...settings.graphics, quality: e.target.value as 'auto' | 'high' | 'medium' | 'low' },
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-bold"
              >
                <option value="auto">Auto</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <label className="flex items-center justify-between gap-4">
              <span className="font-bold">Show FPS & Ping in Match</span>
              <input
                type="checkbox"
                checked={settings.graphics.showFpsPing}
                onChange={(e) =>
                  onUpdate({ ...settings, graphics: { ...settings.graphics, showFpsPing: e.target.checked } })
                }
                className="w-5 h-5"
              />
            </label>
          </div>
        )}

        {tab === 'controls' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onOpenControls}
                className="arena-btn-primary px-5 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2"
              >
                <Sliders size={16} /> Control Style & Practice Range
              </button>
              <button
                type="button"
                onClick={onOpenTouchEditor}
                className="px-5 py-3 rounded-xl bg-[var(--surface-2)] hover:brightness-110 font-bold text-sm inline-flex items-center gap-2"
              >
                <Smartphone size={16} /> Touch Controls Layout Editor
              </button>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-bold">Key Test Box</span>
              <span className="font-mono text-sm text-[var(--accent)]">{lastKey}</span>
            </div>
          </div>
        )}

        {tab === 'access' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className="font-bold">Big Screen / TV Mode (125% UI Scale)</span>
              <input
                type="checkbox"
                checked={settings.bigScreenMode}
                onChange={(e) => onUpdate({ ...settings, bigScreenMode: e.target.checked })}
                className="w-5 h-5"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="font-bold">Reduced Motion</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => onUpdate({ ...settings, reducedMotion: e.target.checked })}
                className="w-5 h-5"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="font-bold">Colorblind Shape Badges</span>
              <input
                type="checkbox"
                checked={settings.accessibility.colorblindBadges}
                onChange={(e) =>
                  onUpdate({
                    ...settings,
                    accessibility: { ...settings.accessibility, colorblindBadges: e.target.checked },
                  })
                }
                className="w-5 h-5"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="font-bold">Vibration / Haptics (Mobile)</span>
              <input
                type="checkbox"
                checked={settings.accessibility.haptics}
                onChange={(e) =>
                  onUpdate({ ...settings, accessibility: { ...settings.accessibility, haptics: e.target.checked } })
                }
                className="w-5 h-5"
              />
            </label>
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] font-bold text-sm inline-flex items-center gap-2"
              >
                <Download size={16} /> Export Settings JSON
              </button>
              <label className="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] font-bold text-sm inline-flex items-center gap-2 cursor-pointer">
                <Upload size={16} /> Import Settings JSON
                <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
              </label>
              <button
                type="button"
                onClick={() => {
                  SettingsStore.resetTips();
                  onUpdate(SettingsStore.getSettings());
                  onToast('Tips & coach marks reset');
                }}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] font-bold text-sm inline-flex items-center gap-2"
              >
                <RotateCcw size={16} /> Reset Onboarding Tips
              </button>
            </div>
            <button
              type="button"
              onClick={onResetAll}
              className="px-5 py-2.5 rounded-xl bg-[#FF4D6D]/20 text-[#FF4D6D] font-bold text-sm"
            >
              Reset All Saved Local Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

type BindingActionKey = keyof PcControlBindings;

const BINDING_ACTIONS: Array<{ key: BindingActionKey; label: string; hint: string }> = [
  { key: 'forward', label: 'Move Forward', hint: 'Hold to drive' },
  { key: 'reverse', label: 'Reverse / Brake', hint: 'Back up' },
  { key: 'turnLeft', label: 'Turn Left', hint: 'Rotate CCW' },
  { key: 'turnRight', label: 'Turn Right', hint: 'Rotate CW' },
  { key: 'fire', label: 'Fire Cannon', hint: 'Click or key' },
];

export const ControlSetupScreen: React.FC<{
  game: GameModule;
  profile: PlayerProfile;
  onSelectStyle: (device: ControlDevice, styleId: string) => void;
  onBack: () => void;
}> = ({ game, profile, onSelectStyle, onBack }) => {
  const [device, setDevice] = useState<ControlDevice>(SettingsStore.detectDevice());
  const [practiceStyle, setPracticeStyle] = useState<string | null>(null);
  const [pcBindings, setPcBindings] = useState<PcControlBindings>(() => SettingsStore.getPcBindings());
  const [listeningAction, setListeningAction] = useState<BindingActionKey | null>(null);
  const practiceHostRef = useRef<HTMLDivElement | null>(null);

  const styles = game.controlStyles.filter((s) => s.devices.includes(device));
  const currentStyle = profile.controlStyle[device];

  const applyPcBindings = (next: PcControlBindings, autoActivateCustom = true) => {
    setPcBindings(next);
    SettingsStore.savePcBindings(next);
    if (autoActivateCustom && currentStyle !== 'PC_CUSTOM' && styles.some((s) => s.id === 'PC_CUSTOM')) {
      onSelectStyle('pc', 'PC_CUSTOM');
    }
  };

  useEffect(() => {
    if (!listeningAction) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningAction(null);
        return;
      }
      const next = { ...pcBindings, [listeningAction]: e.code };
      setListeningAction(null);
      applyPcBindings(next);
    };
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const btnCode = e.button === 2 ? 'MouseRight' : e.button === 1 ? 'MouseMiddle' : 'MouseLeft';
      const next = { ...pcBindings, [listeningAction]: btnCode };
      setListeningAction(null);
      applyPcBindings(next);
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [listeningAction, pcBindings]);

  useEffect(() => {
    if (!practiceStyle || !practiceHostRef.current) return;
    const client: GameClient = game.createClientScene({
      container: practiceHostRef.current,
      localPlayerId: 'practice_me',
      playMode: 'solo',
      isSpectator: false,
      mapId: 'lava',
      seed: 42,
      settings: { __practice: true, mode: 'team-fight', map: 'lava', damagePct: 50, bricksBreakable: true, powerBoxes: 'normal' },
      players: [
        {
          id: 'practice_me',
          nickname: profile.nickname,
          colorId: profile.colorId,
          iconId: profile.iconId,
          team: 'red',
          isHost: true,
          isBot: false,
          isSpectator: false,
          isReady: true,
          isAway: false,
          isDisconnected: false,
          controlStyle: practiceStyle,
          device,
          pingMs: 0,
          rematchVoted: false,
          joinedAt: 0,
        },
        {
          id: 'practice_bot',
          nickname: 'Target Bot',
          colorId: 'blue',
          iconId: 'bot',
          team: 'blue',
          isHost: false,
          isBot: true,
          botDifficulty: 'easy',
          isSpectator: false,
          isReady: true,
          isAway: false,
          isDisconnected: false,
          controlStyle: 'PC_ARCADE',
          device: 'pc',
          pingMs: 0,
          rematchVoted: false,
          joinedAt: 1,
        },
      ],
      controlStyle: practiceStyle,
      onSendInput: () => {},
      onRequestPause: () => setPracticeStyle(null),
    });
    return () => {
      client.destroy();
    };
  }, [practiceStyle, device, game, profile]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="arena-glass rounded-3xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">Control Styles & Practice Range</h1>
            <p className="text-sm text-[var(--text-dim)]">
              Pick the steering style that feels best for your device, then test it live in the Practice Range.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface)]">
            {(
              [
                ['pc', 'PC', Monitor],
                ['touch', 'Touch', Smartphone],
                ['pad', 'Gamepad', Gamepad2],
              ] as const
            ).map(([d, label, Icon]) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={`px-3.5 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${
                  device === d ? 'arena-btn-primary text-white' : 'text-[var(--text-dim)]'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {styles.map((s) => {
            const active = currentStyle === s.id;
            return (
              <div
                key={s.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between gap-4 ${
                  active ? 'bg-[var(--surface-2)] border-[var(--accent)]' : 'bg-[var(--surface)] border-[var(--border)]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[var(--text)]">{s.name}</h3>
                    {s.badge && <span className="text-xs font-bold text-[var(--accent)] whitespace-nowrap">{s.badge}</span>}
                  </div>
                  <ul className="space-y-1 text-xs text-[var(--text-dim)]">
                    {s.summaryLines.map((line, i) => (
                      <li key={i}>• {line}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectStyle(device, s.id)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      active ? 'bg-[var(--success)]/25 text-[var(--success)]' : 'arena-btn-primary text-white'
                    }`}
                  >
                    {active ? <Check size={14} /> : null} {active ? 'Active' : 'Use Style'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPracticeStyle(s.id)}
                    className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] hover:brightness-110 font-bold text-xs inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Play size={13} /> Try It
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom PC Button & Mouse Key Mapper */}
        {device === 'pc' && game.controlStyles.some((s) => s.id === 'PC_CUSTOM') && (
          <div className="rounded-2xl p-5 bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">Custom PC Keys & Mouse Bindings</h2>
                <p className="text-xs text-[var(--text-dim)]">
                  Click any action below, then press a keyboard key or mouse button to customize. For one-hand Spacebar drive + auto-rotate + Mouse fire, select Arcade (Space + Click) above.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectStyle('pc', 'PC_ARCADE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                    currentStyle === 'PC_ARCADE'
                      ? 'arena-btn-primary text-white'
                      : 'bg-[var(--surface-2)] hover:brightness-110'
                  }`}
                >
                  Space + Mouse (Auto-Spin)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPcBindings({
                      forward: 'KeyW',
                      reverse: 'KeyS',
                      turnLeft: 'KeyA',
                      turnRight: 'KeyD',
                      fire: 'MouseLeft',
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold whitespace-nowrap"
                >
                  WASD + Mouse Fire
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPcBindings({
                      forward: 'ArrowUp',
                      reverse: 'ArrowDown',
                      turnLeft: 'ArrowLeft',
                      turnRight: 'ArrowRight',
                      fire: 'Space',
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold whitespace-nowrap"
                >
                  Arrows + Space Fire
                </button>
                <button
                  type="button"
                  onClick={() => applyPcBindings({ ...DEFAULT_PC_BINDINGS })}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {BINDING_ACTIONS.map(({ key, label, hint }) => {
                const isListening = listeningAction === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setListeningAction(isListening ? null : key)}
                    className={`p-3.5 rounded-xl border text-left transition-colors space-y-1.5 ${
                      isListening
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15'
                        : 'border-[var(--border)] bg-[var(--surface-solid)] hover:border-[var(--accent)]/60'
                    }`}
                  >
                    <div className="text-xs font-bold text-[var(--text)]">{label}</div>
                    <div className="font-mono text-sm font-bold text-[var(--accent)]">
                      {isListening ? 'Press key or click…' : formatBindingLabel(pcBindings[key])}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {isListening ? 'Esc to cancel' : hint}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-[var(--text-dim)]">
                Active style:{' '}
                <span className="font-bold text-[var(--text)]">
                  {game.controlStyles.find((s) => s.id === currentStyle)?.name ?? currentStyle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (currentStyle !== 'PC_CUSTOM') onSelectStyle('pc', 'PC_CUSTOM');
                  setPracticeStyle('PC_CUSTOM');
                }}
                className="px-4 py-2 rounded-xl arena-btn-primary text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Play size={14} /> Test Custom Keys in Practice Range
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Practice Range Modal */}
      <Modal
        open={Boolean(practiceStyle)}
        title={`Practice Range · ${game.controlStyles.find((s) => s.id === practiceStyle)?.name ?? ''}`}
        onClose={() => setPracticeStyle(null)}
      >
        <div className="space-y-3">
          <div ref={practiceHostRef} className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-[var(--border)]" />
          <div className="flex justify-between items-center text-xs text-[var(--text-dim)]">
            <span>Drive around, break crates, and test shooting!</span>
            <button
              type="button"
              onClick={() => setPracticeStyle(null)}
              className="px-4 py-2 rounded-xl arena-btn-primary text-white font-bold"
            >
              Done Testing
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const TouchControlsEditorScreen: React.FC<{
  onBack: () => void;
  onToast: (msg: string) => void;
}> = ({ onBack, onToast }) => {
  const [cfg, setCfg] = useState<TouchControlsSettings>(() => SettingsStore.getTouchSettings());

  const save = (next: TouchControlsSettings) => {
    setCfg(next);
    SettingsStore.saveTouchSettings(next);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="arena-glass rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[var(--text)]">Touch Controls Layout</h1>
          <button
            type="button"
            onClick={() => {
              save({ ...DEFAULT_TOUCH_SETTINGS });
              onToast('Touch controls reset to default');
            }}
            className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] text-xs font-bold inline-flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Reset Default
          </button>
        </div>

        {/* Interactive Preview Box */}
        <div className="relative h-56 rounded-2xl bg-[#0B1020] border border-[var(--border)] overflow-hidden flex items-center justify-center">
          <span className="text-xs text-[var(--text-dim)]">Live Thumb Zone Preview</span>
          <div
            style={{
              width: cfg.stickSize * 0.7,
              height: cfg.stickSize * 0.7,
              opacity: Math.max(0.35, cfg.opacity),
              left: cfg.leftHanded ? undefined : '10%',
              right: cfg.leftHanded ? '10%' : undefined,
            }}
            className="absolute bottom-6 rounded-full border-2 border-white/70 bg-white/10 flex items-center justify-center text-[11px] font-bold"
          >
            STEER
          </div>
          <div
            style={{
              width: cfg.fireSize * 0.75,
              height: cfg.fireSize * 0.75,
              opacity: Math.max(0.45, cfg.opacity),
              right: cfg.leftHanded ? undefined : '10%',
              left: cfg.leftHanded ? '10%' : undefined,
            }}
            className="absolute bottom-6 rounded-full border-2 border-[#FF4D6D] bg-[#FF4D6D]/30 flex items-center justify-center text-xs font-bold"
          >
            FIRE
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span>Stick Size</span>
              <span className="tabular-nums">{cfg.stickSize}px</span>
            </div>
            <input
              type="range"
              min={100}
              max={190}
              step={8}
              value={cfg.stickSize}
              onChange={(e) => save({ ...cfg, stickSize: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span>FIRE Button Size</span>
              <span className="tabular-nums">{cfg.fireSize}px</span>
            </div>
            <input
              type="range"
              min={80}
              max={160}
              step={8}
              value={cfg.fireSize}
              onChange={(e) => save({ ...cfg, fireSize: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span>Opacity</span>
              <span className="tabular-nums">{Math.round(cfg.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={0.85}
              step={0.05}
              value={cfg.opacity}
              onChange={(e) => save({ ...cfg, opacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex justify-between font-bold mb-1">
              <span>Dead Zone</span>
              <span className="tabular-nums">{Math.round(cfg.deadZone * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.25}
              step={0.01}
              value={cfg.deadZone}
              onChange={(e) => save({ ...cfg, deadZone: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)]">
            <span className="font-bold">Left-Handed Swap</span>
            <input type="checkbox" checked={cfg.leftHanded} onChange={(e) => save({ ...cfg, leftHanded: e.target.checked })} className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)]">
            <span className="font-bold">Floating Stick (Follows Thumb)</span>
            <input type="checkbox" checked={cfg.floating} onChange={(e) => save({ ...cfg, floating: e.target.checked })} className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)]">
            <span className="font-bold">Hold FIRE to Rapid Fire</span>
            <input type="checkbox" checked={cfg.rapidFire} onChange={(e) => save({ ...cfg, rapidFire: e.target.checked })} className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)]">
            <span className="font-bold">Light Aim Assist</span>
            <input
              type="checkbox"
              checked={cfg.aimAssist === 'light'}
              onChange={(e) => save({ ...cfg, aimAssist: e.target.checked ? 'light' : 'off' })}
              className="w-4 h-4"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export const HowToPlayScreen: React.FC<{ game: GameModule; onBack: () => void }> = ({ game, onBack }) => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
    <button
      type="button"
      onClick={onBack}
      className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
    >
      <ArrowLeft size={16} /> Back
    </button>

    <div className="arena-glass rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle size={28} className="text-[var(--accent)]" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">How to Play · {game.meta.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">{game.howTo.goal}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold text-[var(--text)]">Inviting Friends (2–12 Players)</h2>
        <ul className="space-y-1.5 text-sm text-[var(--text)]">
          {game.howTo.inviteSteps.map((s, i) => (
            <li key={i}>
              {i + 1}. {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {game.howTo.steps.map((st, i) => (
          <div key={i} className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
            <div className="font-bold text-[var(--accent)]">{st.title}</div>
            <div className="text-sm text-[var(--text)]">{st.body}</div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
        <div className="font-bold text-sm text-[var(--gold)]">Pro Tips</div>
        <ul className="space-y-1 text-sm text-[var(--text-dim)]">
          {game.howTo.tips.map((t, i) => (
            <li key={i}>• {t}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

export const CreditsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
    <button
      type="button"
      onClick={onBack}
      className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
    >
      <ArrowLeft size={16} /> Back
    </button>

    <div className="arena-glass rounded-3xl p-6 sm:p-8 space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">Credits & Open Technologies</h1>
      <div className="space-y-3 text-sm">
        <div className="p-4 rounded-2xl bg-[var(--surface)] flex justify-between gap-4">
          <span className="font-bold">Phaser 3</span>
          <span className="text-[var(--text-dim)]">2D HTML5 Game Framework · MIT License</span>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--surface)] flex justify-between gap-4">
          <span className="font-bold">Lucide Icons</span>
          <span className="text-[var(--text-dim)]">UI Iconography · ISC License</span>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--surface)] flex justify-between gap-4">
          <span className="font-bold">Google Fonts (Fredoka, Nunito, JetBrains Mono)</span>
          <span className="text-[var(--text-dim)]">Typography · SIL Open Font License</span>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--surface)] flex justify-between gap-4">
          <span className="font-bold">Procedural Arena Graphics & Web Audio Synth</span>
          <span className="text-[var(--text-dim)]">Original code-drawn artwork & sound effects</span>
        </div>
      </div>
    </div>
  </div>
);
