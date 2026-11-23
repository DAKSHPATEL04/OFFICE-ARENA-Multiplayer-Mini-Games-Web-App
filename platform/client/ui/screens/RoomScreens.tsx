import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ClipboardPaste, Eye, Lock, Minus, Plus, RefreshCw, Zap } from 'lucide-react';
import type { GameModule } from '../../../shared/GameModule.ts';
import type { RoomOptions, RoomSummary } from '../../../shared/types.ts';
import { SettingsStore } from '../../core/SettingsStore.ts';
import { GroupedMapSelector, MapPreviewCard } from '../components/MapSelectorPanel.tsx';

export const CreateRoomScreen: React.FC<{
  game: GameModule;
  hostNickname: string;
  initialMapId?: string;
  onCancel: () => void;
  onSubmit: (options: Partial<RoomOptions>, gameSettings: Record<string, unknown>) => void;
}> = ({ game, hostNickname, initialMapId = 'auto', onCancel, onSubmit }) => {
  const defaults = SettingsStore.getRoomDefaults();
  const [name, setName] = useState(defaults.name || `${hostNickname}'s room`);
  const [visibility, setVisibility] = useState<'private' | 'open'>(defaults.visibility ?? 'private');
  const [maxPlayers, setMaxPlayers] = useState<number>(
    Math.max(game.meta.minPlayers, Math.min(game.meta.maxPlayers, defaults.maxPlayers ?? game.meta.defaultMaxPlayers)),
  );
  const [password, setPassword] = useState('');
  const [allowSpectators, setAllowSpectators] = useState(defaults.allowSpectators !== false);
  const [allowLateJoin, setAllowLateJoin] = useState(defaults.allowLateJoin !== false);
  const [startRule, setStartRule] = useState<'host' | 'auto'>(defaults.startRule ?? 'host');

  // Dynamic match & arena settings pre-configured at room creation
  const hasDamagePct = game.settingsSchema.some((s) => s.key === 'damagePct');
  const hasSpeedPct = game.settingsSchema.some((s) => s.key === 'tankSpeedPct');
  const hasFillBots = game.settingsSchema.some((s) => s.key === 'fillBots');
  const hasControlsAllowed = game.settingsSchema.some((s) => s.key === 'controlStylesAllowed');

  const [modeId, setModeId] = useState<string>(game.modes[0]?.id ?? 'flag');
  const [mapId, setMapId] = useState<string>(initialMapId || 'auto');
  const [damagePct, setDamagePct] = useState<number>(100);
  const [tankSpeedPct, setTankSpeedPct] = useState<number>(100);
  const [fillBots, setFillBots] = useState<string>('even');
  const [controlStylesAllowed, setControlStylesAllowed] = useState<string>('all');

  const hitsRequired = Math.ceil(100 / Math.max(10, damagePct));
  const activeMode = game.modes.find((m) => m.id === modeId) ?? game.modes[0];
  const resolvedMapId =
    mapId === 'auto'
      ? modeId === 'ffa'
        ? 'desert'
        : modeId === 'team-fight'
          ? maxPlayers <= 4
            ? 'snow'
            : 'grass'
          : 'lava'
      : mapId;
  const resolvedMapObj = game.maps?.find((m) => m.id === resolvedMapId) ?? game.maps?.[0];
  const mapPreviewUrl = game.renderMapPreview?.(resolvedMapId, modeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const opts: Partial<RoomOptions> = {
      name: name.trim() || `${hostNickname}'s room`,
      visibility,
      maxPlayers,
      password: password.trim(),
      allowSpectators,
      allowLateJoin,
      startRule,
    };
    SettingsStore.saveRoomDefaults({
      visibility,
      maxPlayers,
      allowSpectators,
      allowLateJoin,
      startRule,
    });

    const gameSettings: Record<string, unknown> = {
      mode: modeId,
    };
    if (game.maps && game.maps.length > 0) gameSettings.map = mapId;
    if (hasDamagePct) gameSettings.damagePct = damagePct;
    if (hasSpeedPct) gameSettings.tankSpeedPct = tankSpeedPct;
    if (hasFillBots) gameSettings.fillBots = fillBots;
    if (hasControlsAllowed) gameSettings.controlStylesAllowed = controlStylesAllowed;

    onSubmit(opts, gameSettings);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={onCancel}
        className="mb-6 px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <form onSubmit={handleSubmit} className="arena-glass rounded-[24px] p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <div className="text-xs font-semibold text-[var(--accent)]">{game.meta.name}</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">Create a Room & Match Rules</h1>
          </div>
          <button type="submit" className="px-7 py-3 rounded-xl arena-btn-primary font-bold whitespace-nowrap">
            Create Room
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Room Access & Lobby Options */}
          <div className="lg:col-span-5 space-y-5">
            <h2 className="text-lg font-bold text-[var(--text)]">Room Access</h2>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--text)]">Room Name</label>
              <input
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${hostNickname}'s room`}
                className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--text)]">Visibility</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    visibility === 'private'
                      ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  <div className="font-bold text-sm">Private</div>
                  <div className="text-xs text-[var(--text-dim)]">Code, link, or QR only</div>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('open')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    visibility === 'open'
                      ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  <div className="font-bold text-sm">Open</div>
                  <div className="text-xs text-[var(--text-dim)]">Listed in Open Rooms</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-sm text-[var(--text)]">Max Players</div>
                <div className="text-xs text-[var(--text-dim)] tabular-nums">
                  Allowed: {game.meta.minPlayers} to {game.meta.maxPlayers}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMaxPlayers((m) => Math.max(game.meta.minPlayers, m - 1))}
                  className="w-10 h-10 rounded-xl bg-[var(--surface-2)] flex items-center justify-center hover:brightness-110"
                  aria-label="Decrease max players"
                >
                  <Minus size={17} />
                </button>
                <span className="w-9 text-center text-xl font-bold font-display tabular-nums">{maxPlayers}</span>
                <button
                  type="button"
                  onClick={() => setMaxPlayers((m) => Math.min(game.meta.maxPlayers, m + 1))}
                  className="w-10 h-10 rounded-xl bg-[var(--surface-2)] flex items-center justify-center hover:brightness-110"
                  aria-label="Increase max players"
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--text)]">Password (optional)</label>
              <input
                type="password"
                value={password}
                maxLength={12}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password (4–12 chars)"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              {password.length > 0 && password.length < 4 && (
                <p className="text-xs text-[#FFC83D]">Password must be at least 4 characters (or leave blank).</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface)] cursor-pointer">
                <span className="text-xs font-semibold">Allow Spectators</span>
                <input
                  type="checkbox"
                  checked={allowSpectators}
                  onChange={(e) => setAllowSpectators(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface)] cursor-pointer">
                <span className="text-xs font-semibold">Allow Late Join</span>
                <input
                  type="checkbox"
                  checked={allowLateJoin}
                  onChange={(e) => setAllowLateJoin(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--text)]">Start Rule</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStartRule('host')}
                  className={`p-2.5 rounded-xl border text-xs font-bold ${
                    startRule === 'host' ? 'border-[var(--accent)] bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  Host Starts
                </button>
                <button
                  type="button"
                  onClick={() => setStartRule('auto')}
                  className={`p-2.5 rounded-xl border text-xs font-bold ${
                    startRule === 'auto' ? 'border-[var(--accent)] bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  Auto when All Ready
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Mode, Map Picker, Tank Power & Combat Rules */}
          <div className="lg:col-span-7 space-y-5">
            <h2 className="text-lg font-bold text-[var(--text)]">Arena, Mode & Power</h2>

            {/* Mode Buttons */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--text)]">Game Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {game.modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModeId(m.id)}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      modeId === m.id
                        ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                        : 'border-[var(--border)] bg-[var(--surface)]'
                    }`}
                  >
                    <div className="font-bold text-sm text-[var(--text)]">{m.name}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {m.teamType === 'teams' ? 'Red vs Blue Teams' : 'Every player for self'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Map Picker (Arena Series + Classic Arenas) */}
            {game.maps && game.maps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-bold text-[var(--text)]">Select Arena Map</label>
                  <span className="text-xs text-[var(--text-dim)]">All {game.maps.length} maps work in every mode</span>
                </div>
                <div className="max-w-[520px]">
                  <MapPreviewCard
                    map={resolvedMapObj}
                    resolvedMapId={resolvedMapId}
                    previewUrl={mapPreviewUrl}
                    modeName={activeMode?.name}
                    modes={game.modes}
                    footerText={resolvedMapObj?.description}
                  />
                </div>
                <GroupedMapSelector
                  maps={game.maps}
                  selectedMapId={mapId}
                  modeId={modeId}
                  renderMapPreview={game.renderMapPreview}
                  onSelect={setMapId}
                  compact
                />
              </div>
            )}

            {/* Tank Power (Shell Damage %) */}
            {hasDamagePct && (
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[var(--text)]">Tank Power (Shell Damage %)</div>
                    <div className="text-xs text-[var(--text-dim)] tabular-nums">
                      {damagePct}% damage per hit · {hitsRequired} {hitsRequired === 1 ? 'hit' : 'hits'} to destroy an enemy tank
                    </div>
                  </div>
                  <span className="font-mono text-lg font-bold text-[var(--accent)] tabular-nums">{damagePct}%</span>
                </div>

                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={damagePct}
                  onChange={(e) => setDamagePct(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { pct: 25, label: '25% · 4 hits' },
                    { pct: 35, label: '35% · 3 hits' },
                    { pct: 50, label: '50% · 2 hits' },
                    { pct: 100, label: '100% · 1 hit' },
                  ].map((opt) => (
                    <button
                      key={opt.pct}
                      type="button"
                      onClick={() => setDamagePct(opt.pct)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold tabular-nums whitespace-nowrap ${
                        damagePct === opt.pct ? 'arena-btn-primary text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Speed, Bot Fill, & Controls Allowed */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {hasSpeedPct && (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Tank Speed</span>
                    <span className="tabular-nums text-[var(--accent)]">{tankSpeedPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={130}
                    step={10}
                    value={tankSpeedPct}
                    onChange={(e) => setTankSpeedPct(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
              )}

              {hasFillBots && (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
                  <label className="block text-xs font-bold">Fill with Bots</label>
                  <select
                    value={fillBots}
                    onChange={(e) => setFillBots(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-semibold"
                  >
                    <option value="even">Even Teams</option>
                    <option value="max">Fill to Max</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              )}

              {hasControlsAllowed && (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
                  <label className="block text-xs font-bold">Room Control Policy</label>
                  <select
                    value={controlStylesAllowed}
                    onChange={(e) => setControlStylesAllowed(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-semibold"
                  >
                    <option value="all">All & Custom Styles</option>
                    <option value="standard-only">Standard Only</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl bg-[var(--surface-2)] font-bold whitespace-nowrap"
          >
            Cancel
          </button>
          <button type="submit" className="px-7 py-3 rounded-xl arena-btn-primary font-bold whitespace-nowrap">
            Create Room
          </button>
        </div>
      </form>
    </div>
  );
};

export const JoinRoomScreen: React.FC<{
  initialCode?: string;
  openRooms: RoomSummary[];
  needsPassword: boolean;
  canSpectatePrompt: string | null;
  errorMsg: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onJoin: (code: string, password?: string, asSpectator?: boolean) => void;
  onQuickJoin: (gameId: string) => void;
  onCreateRoom: () => void;
}> = ({
  initialCode = '',
  openRooms,
  needsPassword,
  canSpectatePrompt,
  errorMsg,
  onBack,
  onRefresh,
  onJoin,
  onQuickJoin,
  onCreateRoom,
}) => {
  const [chars, setChars] = useState<string[]>(() => {
    const clean = initialCode.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    return [clean[0] ?? '', clean[1] ?? '', clean[2] ?? '', clean[3] ?? ''];
  });
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(needsPassword);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (needsPassword) setShowPw(true);
  }, [needsPassword]);

  const code = chars.join('').toUpperCase();

  const handleBoxChange = (idx: number, val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z]/g, '');
    if (!clean) {
      const next = [...chars];
      next[idx] = '';
      setChars(next);
      return;
    }
    if (clean.length > 1) {
      const next = [clean[0] ?? '', clean[1] ?? '', clean[2] ?? '', clean[3] ?? ''];
      setChars(next);
      inputRefs.current[Math.min(3, clean.length - 1)]?.focus();
      return;
    }
    const next = [...chars];
    next[idx] = clean[0];
    setChars(next);
    if (idx < 3) inputRefs.current[idx + 1]?.focus();
  };

  const handleBoxKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.toUpperCase().match(/(?:ROOM=)?([A-HJ-NP-Z]{4})/);
      if (match?.[1]) {
        const c = match[1];
        setChars([c[0], c[1], c[2], c[3]]);
      }
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Join by 4-letter code */}
      <section className="arena-glass rounded-[24px] p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text)]">Join a Room</h1>
            <p className="text-sm text-[var(--text-dim)]">Enter the 4-letter code from your friend or pick an open room below.</p>
          </div>
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-sm font-bold inline-flex items-center gap-2"
          >
            <ClipboardPaste size={16} /> Paste Code / Link
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                value={chars[i]}
                maxLength={4}
                onChange={(e) => handleBoxChange(i, e.target.value)}
                onKeyDown={(e) => handleBoxKeyDown(i, e)}
                aria-label={`Room code letter ${i + 1}`}
                className="w-16 h-20 sm:w-20 sm:h-20 text-center text-3xl font-bold font-display uppercase rounded-2xl bg-[var(--surface)] border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none text-[var(--text)]"
              />
            ))}
          </div>

          <button
            type="button"
            disabled={code.length < 4}
            onClick={() => onJoin(code, password || undefined, false)}
            className="px-7 py-4 rounded-2xl arena-btn-primary font-bold text-lg disabled:opacity-40"
          >
            Join Room
          </button>
        </div>

        {showPw && (
          <div className="max-w-sm space-y-2">
            <label className="text-sm font-bold text-[var(--text)]">Room Password</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => onJoin(code, password, false)}
                className="px-4 py-2.5 rounded-xl arena-btn-primary font-bold text-sm"
              >
                Unlock
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-[#FF4D6D]/15 border border-[#FF4D6D]/40 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[#FF4D6D]">{errorMsg}</span>
            {canSpectatePrompt && (
              <button
                type="button"
                onClick={() => onJoin(canSpectatePrompt, password || undefined, true)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-1.5"
              >
                <Eye size={16} /> Watch as Spectator
              </button>
            )}
          </div>
        )}
      </section>

      {/* Open Rooms List */}
      <section className="arena-glass rounded-[24px] p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text)]">Open Rooms</h2>
            <p className="text-xs text-[var(--text-dim)]">Updates automatically every 5 seconds</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onQuickJoin('tank-arena')}
              className="px-4 py-2.5 rounded-xl arena-btn-primary text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Zap size={16} /> Quick Join
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-xl bg-[var(--surface-2)] hover:brightness-110"
              aria-label="Refresh open rooms"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {openRooms.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-[var(--text-dim)] font-semibold">No open rooms listed right now.</p>
            <button
              type="button"
              onClick={onCreateRoom}
              className="px-5 py-2.5 rounded-xl arena-btn-primary text-sm font-bold"
            >
              Create One!
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {openRooms.map((r) => {
              const isFull = r.players >= r.maxPlayers;
              const isPlaying = r.status !== 'LOBBY';
              return (
                <div key={r.code} className="py-3.5 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text)] truncate">{r.name}</span>
                      {r.hasPassword && <Lock size={14} className="text-[#FFC83D] shrink-0" />}
                    </div>
                    <div className="text-xs text-[var(--text-dim)] tabular-nums">
                      {r.gameName} · Host: {r.hostName} · Code: {r.code} · {r.players}/{r.maxPlayers} players ·{' '}
                      {r.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (r.hasPassword) {
                        setChars([r.code[0], r.code[1], r.code[2], r.code[3]]);
                        setShowPw(true);
                      } else {
                        onJoin(r.code, undefined, isFull || isPlaying);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-sm font-bold whitespace-nowrap"
                  >
                    {isFull || isPlaying ? 'Watch' : 'Join'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
