import React, { useState } from 'react';
import { ArrowLeft, Bot, Gamepad2, Globe, Monitor, Smartphone, Users, Zap } from 'lucide-react';
import type { GameModule, MapDef } from '../../../shared/GameModule.ts';
import { MapRuleLine, formatBestModes } from '../components/MapSelectorPanel.tsx';

export const GameDetailScreen: React.FC<{
  game: GameModule;
  isOnline: boolean;
  suggestSolo: boolean;
  onBack: () => void;
  onCreateRoom: (mapId?: string) => void;
  onJoinRoom: () => void;
  onQuickJoin: () => void;
  onLocalParty: () => void;
  onSolo: (mapId?: string) => void;
  onOpenHowTo: () => void;
  onDismissSoloSuggest: () => void;
}> = ({
  game,
  isOnline,
  suggestSolo,
  onBack,
  onCreateRoom,
  onJoinRoom,
  onQuickJoin,
  onLocalParty,
  onSolo,
  onOpenHowTo,
  onDismissSoloSuggest,
}) => {
  const [deviceTab, setDeviceTab] = useState<'pc' | 'touch' | 'pad'>('pc');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap"
        >
          <ArrowLeft size={16} /> Back to Games
        </button>
        <button
          type="button"
          onClick={onOpenHowTo}
          className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold whitespace-nowrap"
        >
          How to Play
        </button>
      </div>

      {/* Hero Banner */}
      <section className="arena-glass rounded-[28px] overflow-hidden">
        <div className="relative h-56 sm:h-72 w-full">
          <img
            src={game.meta.banner}
            alt={game.meta.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-8">
            <div className="text-xs font-semibold text-[var(--accent)] tabular-nums mb-1">
              {game.meta.minPlayers}–{game.meta.maxPlayers} players · ~{game.meta.avgMinutes} min ·{' '}
              {game.modes.map((m) => m.name).join(' · ')}
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-white">{game.meta.name}</h1>
            <p className="text-sm sm:text-base text-white/85 max-w-2xl mt-2">{game.meta.description}</p>
          </div>
        </div>

        {/* Action Strip */}
        <div className="p-6 flex flex-wrap items-center gap-3">
          {game.meta.supports.online && (
            <>
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => onCreateRoom()}
                className="arena-btn-primary px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <Globe size={18} /> Create Room
              </button>
              <button
                type="button"
                disabled={!isOnline}
                onClick={onJoinRoom}
                className="px-5 py-3 rounded-xl bg-[var(--surface-2)] hover:brightness-110 font-bold inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <Users size={18} /> Join / Open Rooms
              </button>
              <button
                type="button"
                disabled={!isOnline}
                onClick={onQuickJoin}
                className="px-5 py-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-2)] font-bold inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <Zap size={18} className="text-[var(--accent)]" /> Quick Join
              </button>
            </>
          )}

          {game.meta.supports.localParty && (
            <button
              type="button"
              onClick={onLocalParty}
              className="px-5 py-3 rounded-xl bg-[var(--surface-2)] hover:brightness-110 font-bold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Users size={18} /> Local Party (2–{game.meta.maxLocalPlayers})
            </button>
          )}

          {game.meta.supports.solo && (
            <button
              type="button"
              onClick={() => onSolo()}
              className="px-5 py-3 rounded-xl bg-[var(--surface-2)] hover:brightness-110 font-bold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Bot size={18} /> Solo vs Bots
            </button>
          )}
        </div>
      </section>

      {suggestSolo && game.meta.supports.solo && (
        <div className="arena-glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-[var(--accent)]">
          <div className="text-sm font-semibold">
            First time playing {game.meta.name}? Try a quick Solo match vs Bots to feel the controls!
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onDismissSoloSuggest();
                onSolo();
              }}
              className="px-4 py-2 rounded-xl arena-btn-primary text-sm font-bold whitespace-nowrap"
            >
              Try Solo Now
            </button>
            <button
              type="button"
              onClick={onDismissSoloSuggest}
              className="px-3 py-2 rounded-xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text-dim)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Modes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[var(--text)]">Game Modes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {game.modes.map((m) => (
            <div key={m.id} className="arena-glass rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-[var(--text)]">{m.name}</h3>
                <span className="text-xs font-semibold text-[var(--accent)] tabular-nums">
                  {m.teamType === 'teams' ? 'Teams (up to 6v6)' : 'Free For All'}
                </span>
              </div>
              <p className="text-sm text-[var(--text)]">{m.planText}</p>
              <p className="text-xs text-[var(--text-dim)]">{m.tip}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Maps */}
      {game.maps && game.maps.length > 0 && (() => {
        const arenaSeries = game.maps.filter((m) => m.series === 'arena-series');
        const classicArenas = game.maps.filter((m) => m.series !== 'arena-series');
        const renderMapCard = (m: MapDef) => {
          const previewUrl = game.renderMapPreview?.(m.id, m.modes[0] ?? 'flag');
          const accent = m.accentColor ?? 'var(--accent)';
          const bestLabel = m.bestFor?.length ? formatBestModes(m.bestFor, game.modes) : '';
          return (
            <div key={m.id} className="arena-glass rounded-2xl overflow-hidden flex flex-col justify-between">
              <div>
                {previewUrl && (
                  <div className="aspect-video bg-black/30 relative">
                    <img
                      src={previewUrl}
                      alt={m.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-[var(--text)] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                      <span>{m.series === 'arena-series' ? m.name : `Map ${m.id} · ${m.name}`}</span>
                    </h3>
                    <span className="text-xs font-semibold text-[var(--gold)] whitespace-nowrap">{m.recommendedPlayers}</span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)]">{m.description}</p>
                  <MapRuleLine ruleTags={m.ruleTags} />
                  {bestLabel && (
                    <div className="text-[11px] text-[var(--text-dim)]">
                      Best for: <span className="font-semibold text-[var(--text)]">{bestLabel}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-4 pb-4 flex items-center gap-2">
                {game.meta.supports.online && (
                  <button
                    type="button"
                    disabled={!isOnline}
                    onClick={() => onCreateRoom(m.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                  >
                    Host Arena
                  </button>
                )}
                {game.meta.supports.solo && (
                  <button
                    type="button"
                    onClick={() => onSolo(m.id)}
                    className="flex-1 py-2 px-3 rounded-xl arena-btn-primary text-xs font-bold whitespace-nowrap"
                  >
                    Play Solo
                  </button>
                )}
              </div>
            </div>
          );
        };

        return (
          <section className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-bold text-[var(--text)]">Arena Maps ({game.maps.length})</h2>
              <span className="text-xs text-[var(--text-dim)]">Every map supports Flag, Team Fight & Free For All</span>
            </div>

            {arenaSeries.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-dim)]">
                    Arena Series · Shared Layout, 5 Themes
                  </h3>
                  <span className="text-xs text-[var(--text-dim)]">4 corner platforms · Left/Right flag alcoves · Unique theme hazards</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {arenaSeries.map(renderMapCard)}
                </div>
              </div>
            )}

            {classicArenas.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-dim)]">
                    Classic Arenas
                  </h3>
                  <span className="text-xs text-[var(--text-dim)]">Classic Tank Arena layouts A · E · G · H · J</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classicArenas.map(renderMapCard)}
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* Controls Preview */}
      <section className="arena-glass rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-[var(--text)]">Controls by Device</h2>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setDeviceTab('pc')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${
                deviceTab === 'pc' ? 'arena-btn-primary text-white' : 'text-[var(--text-dim)]'
              }`}
            >
              <Monitor size={15} /> PC
            </button>
            <button
              type="button"
              onClick={() => setDeviceTab('touch')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${
                deviceTab === 'touch' ? 'arena-btn-primary text-white' : 'text-[var(--text-dim)]'
              }`}
            >
              <Smartphone size={15} /> Touch
            </button>
            <button
              type="button"
              onClick={() => setDeviceTab('pad')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${
                deviceTab === 'pad' ? 'arena-btn-primary text-white' : 'text-[var(--text-dim)]'
              }`}
            >
              <Gamepad2 size={15} /> Gamepad
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {game.controls[deviceTab].map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[var(--surface)]">
              <span className="font-mono text-sm font-bold text-[var(--accent)]">{c.input}</span>
              <span className="text-sm text-[var(--text)] text-right">{c.action}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
