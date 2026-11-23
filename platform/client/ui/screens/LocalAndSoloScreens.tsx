import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bot, Play, Users } from 'lucide-react';
import { PLAYER_COLORS } from '../../../shared/config.ts';
import type { GameModule } from '../../../shared/GameModule.ts';
import type { RoomPlayer, TeamId } from '../../../shared/types.ts';
import { ShapeColorBadge } from '../components/PlayerBadge.tsx';
import { GroupedMapSelector, MapPreviewCard } from '../components/MapSelectorPanel.tsx';

export interface LocalPartyConfig {
  players: RoomPlayer[];
  localPlayers: Array<{ id: string; nickname: string; colorId: string; team: TeamId; inputSlot: number }>;
  settings: Record<string, unknown>;
}

const LOCAL_KEYS = ['Q', 'P', 'Z', 'M'];
const CORNER_POSITIONS = ['Top-Left (Q)', 'Top-Right (P)', 'Bottom-Left (Z)', 'Bottom-Right (M)'];

export const LocalPartySetupScreen: React.FC<{
  game: GameModule;
  onBack: () => void;
  onStart: (cfg: LocalPartyConfig) => void;
}> = ({ game, onBack, onStart }) => {
  const [joined, setJoined] = useState<boolean[]>([true, true, false, false]);
  const [names, setNames] = useState<string[]>(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [colors, setColors] = useState<string[]>(['red', 'blue', 'yellow', 'green']);
  const [modeId, setModeId] = useState<string>(game.modes[0]?.id ?? 'flag');
  const [mapId, setMapId] = useState<string>('auto');
  const [damagePct, setDamagePct] = useState<number>(100);
  const [fillBots, setFillBots] = useState<boolean>(false);

  const toggleSlot = (idx: number) => {
    setJoined((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toUpperCase();
      const idx = LOCAL_KEYS.indexOf(k);
      if (idx >= 0) toggleSlot(idx);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeCount = joined.filter(Boolean).length;
  const activeMode = game.modes.find((m) => m.id === modeId) ?? game.modes[0];
  const isTeams = activeMode?.teamType === 'teams';

  const handleStart = () => {
    if (activeCount < 2) return;
    const localPlayers: LocalPartyConfig['localPlayers'] = [];
    const players: RoomPlayer[] = [];

    joined.forEach((isIn, slot) => {
      if (!isIn) return;
      const id = `local_${slot}`;
      const team: TeamId = isTeams ? (slot % 2 === 0 ? 'red' : 'blue') : 'ffa';
      const colorId = colors[slot];
      const nickname = names[slot].trim() || `P${slot + 1}`;
      localPlayers.push({ id, nickname, colorId, team, inputSlot: slot });
      players.push({
        id,
        nickname,
        colorId,
        iconId: 'shield',
        team,
        isHost: slot === 0,
        isBot: false,
        isSpectator: false,
        isReady: true,
        isAway: false,
        isDisconnected: false,
        controlStyle: 'PC_ARCADE',
        device: 'pc',
        pingMs: 0,
        rematchVoted: false,
        joinedAt: slot,
      });
    });

    if (fillBots && players.length < 4) {
      const botsNeeded = 4 - players.length;
      for (let i = 0; i < botsNeeded; i++) {
        const team: TeamId = isTeams ? ((players.length % 2 === 0) ? 'red' : 'blue') : 'ffa';
        players.push({
          id: `bot_lp_${i}`,
          nickname: `Bot ${i + 1}`,
          colorId: PLAYER_COLORS[(players.length + 4) % PLAYER_COLORS.length].id,
          iconId: 'bot',
          team,
          isHost: false,
          isBot: true,
          botDifficulty: 'medium',
          isSpectator: false,
          isReady: true,
          isAway: false,
          isDisconnected: false,
          controlStyle: 'PC_ARCADE',
          device: 'pc',
          pingMs: 0,
          rematchVoted: false,
          joinedAt: 10 + i,
        });
      }
    }

    onStart({
      players,
      localPlayers,
      settings: {
        mode: modeId,
        map: mapId,
        timeLimit: 180,
        damagePct,
        powerBoxes: 'normal',
        bricksBreakable: true,
      },
    });
  };

  const localHitsNeeded = Math.ceil(100 / Math.max(10, damagePct));
  const hasDamagePct = game.settingsSchema.some((s) => s.key === 'damagePct');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="arena-glass rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] flex items-center gap-2.5">
              <Users size={26} className="text-[var(--accent)]" /> Local Party (2–4 Players, Same Screen)
            </h1>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              Each player gets one corner button or key (Q, P, Z, M). Hold to drive, tap to fire + recoil turn!
            </p>
          </div>
        </div>

        {/* 4 Corner Pads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((slot) => {
            const isIn = joined[slot];
            return (
              <div
                key={slot}
                className={`rounded-2xl p-4 border transition-colors space-y-3 ${
                  isIn
                    ? 'bg-[var(--surface-2)] border-[var(--accent)]'
                    : 'bg-[var(--surface)] border-[var(--border)] opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShapeColorBadge colorId={colors[slot]} size={22} />
                    <span className="font-bold text-sm text-[var(--text)]">{CORNER_POSITIONS[slot]}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                      isIn ? 'bg-[var(--success)]/25 text-[var(--success)]' : 'arena-btn-primary text-white'
                    }`}
                  >
                    {isIn ? 'Joined (Tap to leave)' : `Tap or Press ${LOCAL_KEYS[slot]} to Join`}
                  </button>
                </div>

                {isIn && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      maxLength={14}
                      value={names[slot]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNames((prev) => prev.map((n, i) => (i === slot ? val : n)));
                      }}
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-bold"
                    />
                    <select
                      value={colors[slot]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColors((prev) => prev.map((c, i) => (i === slot ? val : c)));
                      }}
                      className="px-3 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-bold"
                    >
                      {PLAYER_COLORS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mode, Power & Map Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-bold mb-1">Mode</label>
            <select
              value={modeId}
              onChange={(e) => setModeId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-semibold"
            >
              {game.modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] self-end cursor-pointer">
            <span className="text-sm font-bold">Add Bots to Fill 4</span>
            <input type="checkbox" checked={fillBots} onChange={(e) => setFillBots(e.target.checked)} className="w-4 h-4" />
          </label>
        </div>

        {hasDamagePct && (
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-[var(--text)]">Tank Power (Shell Damage %)</div>
              <div className="text-xs font-bold text-[var(--accent)] tabular-nums">
                {damagePct}% · {localHitsNeeded} {localHitsNeeded === 1 ? 'hit' : 'hits'} to destroy
              </div>
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
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold tabular-nums ${
                    damagePct === opt.pct ? 'arena-btn-primary text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {game.maps && game.maps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--text)]">Select Arena Map</label>
              <span className="text-xs text-[var(--text-dim)]">All {game.maps.length} maps playable</span>
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

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-dim)]">
            iPad / Tablet tip: Disable iOS Multitasking Gestures if 4 players touch the screen simultaneously.
          </span>
          <button
            type="button"
            disabled={activeCount < 2}
            onClick={handleStart}
            className="arena-btn-primary px-7 py-3.5 rounded-xl font-bold inline-flex items-center gap-2 disabled:opacity-45"
          >
            <Play size={18} /> Start Local Party ({activeCount} Players)
          </button>
        </div>
      </div>
    </div>
  );
};

export const SoloSetupScreen: React.FC<{
  game: GameModule;
  selfProfile: { nickname: string; colorId: string; iconId: string; controlStyle: string; device: 'pc' | 'touch' | 'pad' };
  initialMapId?: string;
  onBack: () => void;
  onStart: (players: RoomPlayer[], settings: Record<string, unknown>) => void;
}> = ({ game, selfProfile, initialMapId = 'auto', onBack, onStart }) => {
  const [modeId, setModeId] = useState<string>(game.modes[0]?.id ?? 'flag');
  const [mapId, setMapId] = useState<string>(initialMapId || 'auto');
  const [botCount, setBotCount] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [presetId, setPresetId] = useState<string>('standard');
  const [damagePct, setDamagePct] = useState<number>(100);

  const activeMode = game.modes.find((m) => m.id === modeId) ?? game.modes[0];
  const isTeams = activeMode?.teamType === 'teams';
  const hasDamagePct = game.settingsSchema.some((s) => s.key === 'damagePct');
  const soloHitsNeeded = Math.ceil(100 / Math.max(10, damagePct));

  const resolvedMap =
    mapId === 'auto'
      ? modeId === 'ffa'
        ? 'desert'
        : modeId === 'team-fight'
          ? botCount + 1 <= 4
            ? 'snow'
            : 'grass'
          : 'lava'
      : mapId;
  const resolvedMapObj = game.maps?.find((m) => m.id === resolvedMap);
  const mapPreview = game.renderMapPreview?.(resolvedMap, modeId);

  const handleStart = () => {
    const preset = game.presets?.find((p) => p.id === presetId)?.values ?? {};
    const players: RoomPlayer[] = [
      {
        id: 'solo_human',
        nickname: selfProfile.nickname,
        colorId: selfProfile.colorId,
        iconId: selfProfile.iconId,
        team: isTeams ? 'red' : 'ffa',
        isHost: true,
        isBot: false,
        isSpectator: false,
        isReady: true,
        isAway: false,
        isDisconnected: false,
        controlStyle: selfProfile.controlStyle,
        device: selfProfile.device,
        pingMs: 0,
        rematchVoted: false,
        joinedAt: 0,
      },
    ];

    const totalBots = Math.max(1, Math.min(11, botCount));
    for (let i = 0; i < totalBots; i++) {
      const team: TeamId = isTeams ? (i % 2 === 0 ? 'blue' : 'red') : 'ffa';
      const diff = difficulty === 'mixed' ? (['easy', 'medium', 'hard'][i % 3]) : difficulty;
      players.push({
        id: `bot_${i + 1}`,
        nickname: `Bot ${i + 1}`,
        colorId: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length].id,
        iconId: 'bot',
        team,
        isHost: false,
        isBot: true,
        botDifficulty: diff,
        isSpectator: false,
        isReady: true,
        isAway: false,
        isDisconnected: false,
        controlStyle: 'PC_ARCADE',
        device: 'pc',
        pingMs: 0,
        rematchVoted: false,
        joinedAt: i + 1,
      });
    }

    onStart(players, {
      ...preset,
      mode: modeId,
      map: mapId,
      botDifficulty: difficulty,
      damagePct,
      timeLimit: preset.timeLimit ?? 'auto',
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

      <div className="arena-glass rounded-3xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] flex items-center gap-2.5">
            <Bot size={26} className="text-[var(--accent)]" /> Solo vs Bots
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            Play offline anytime against smart AI bots (up to 6v6 or 12-tank Free For All).
          </p>

          <div>
            <label className="block text-sm font-bold mb-1">Mode</label>
            <select
              value={modeId}
              onChange={(e) => setModeId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-semibold"
            >
              {game.modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Arena Map</label>
            <select
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-semibold"
            >
              <option value="auto">Auto (Best for Mode)</option>
              {game.maps?.some((m) => m.series === 'arena-series') && (
                <optgroup label="Arena Series (Shared Layout)">
                  {game.maps
                    .filter((m) => m.series === 'arena-series')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {game.maps?.some((m) => m.series !== 'arena-series') && (
                <optgroup label="Classic Arenas">
                  {game.maps
                    .filter((m) => m.series !== 'arena-series')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id} · {m.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Bots (1–11)</label>
              <input
                type="number"
                min={1}
                max={11}
                value={botCount}
                onChange={(e) => setBotCount(Math.max(1, Math.min(11, Number(e.target.value))))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-semibold"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>

          {hasDamagePct && (
            <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--text)]">Tank Power (Damage %)</span>
                <span className="text-xs font-bold text-[var(--accent)] tabular-nums">
                  {damagePct}% · {soloHitsNeeded} {soloHitsNeeded === 1 ? 'hit' : 'hits'}
                </span>
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
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { pct: 25, label: '25% · 4h' },
                  { pct: 35, label: '35% · 3h' },
                  { pct: 50, label: '50% · 2h' },
                  { pct: 100, label: '100% · 1h' },
                ].map((opt) => (
                  <button
                    key={opt.pct}
                    type="button"
                    onClick={() => setDamagePct(opt.pct)}
                    className={`py-1.5 rounded-xl text-xs font-bold tabular-nums ${
                      damagePct === opt.pct ? 'arena-btn-primary text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {game.presets && game.presets.length > 0 && (
            <div>
              <label className="block text-sm font-bold mb-1">Rule Preset</label>
              <div className="flex flex-wrap gap-1.5">
                {game.presets.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => {
                      setPresetId(pr.id);
                      if (typeof pr.values.damagePct === 'number') {
                        setDamagePct(pr.values.damagePct);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      presetId === pr.id ? 'arena-btn-primary text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
                    }`}
                  >
                    {pr.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleStart}
            className="w-full arena-btn-primary py-3.5 rounded-xl font-bold inline-flex items-center justify-center gap-2"
          >
            <Play size={18} /> Start Solo Match ({botCount + 1} Tanks)
          </button>
        </div>

        <div className="space-y-4">
          <div className="max-w-[520px]">
            <MapPreviewCard
              map={resolvedMapObj}
              resolvedMapId={resolvedMap}
              previewUrl={mapPreview}
              modeName={activeMode?.name}
              modes={game.modes}
              footerText={resolvedMapObj?.description}
            />
          </div>

          {game.maps && game.maps.length > 0 && (
            <GroupedMapSelector
              maps={game.maps}
              selectedMapId={mapId}
              modeId={modeId}
              renderMapPreview={game.renderMapPreview}
              onSelect={setMapId}
              compact
            />
          )}

          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-sm space-y-1">
            <div className="font-bold text-[var(--text)]">{activeMode?.name}</div>
            <div className="text-xs text-[var(--text-dim)]">{activeMode?.planText}</div>
            <div className="text-xs text-[var(--accent)] pt-1">{activeMode?.tip}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
