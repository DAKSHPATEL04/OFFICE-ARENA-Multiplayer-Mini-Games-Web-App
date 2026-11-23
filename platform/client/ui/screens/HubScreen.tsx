import React, { useMemo, useState } from 'react';
import { ArrowRight, Play, Search, Star, Users } from 'lucide-react';
import type { GameModule } from '../../../shared/GameModule.ts';
import type { RecentRoomEntry } from '../../../shared/types.ts';

const COMING_SOON_IDEAS = [
  { id: 'sumo-push', name: 'Sumo Push', players: '2–8 players', tags: 'Action · Party' },
  { id: 'bomber-grid', name: 'Bomber Grid', players: '2–8 players', tags: 'Action · Quick' },
  { id: 'draw-guess', name: 'Draw & Guess', players: '3–12 players', tags: 'Party · Team' },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Action' },
  { id: 'party', label: 'Party' },
  { id: 'quick', label: 'Quick (<5m)' },
  { id: 'team', label: 'Team' },
  { id: '5+', label: '5+ Players' },
  { id: 'favorites', label: 'Favorites' },
] as const;

export const HubScreen: React.FC<{
  games: GameModule[];
  favorites: string[];
  recentRooms: RecentRoomEntry[];
  isOnline: boolean;
  onSelectGame: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
  onRejoinRoom: (code: string) => void;
  onOpenJoin: () => void;
  onOpenCreate: (gameId: string) => void;
  showCoachMarks: boolean;
  onDismissCoach: () => void;
}> = ({
  games,
  favorites,
  recentRooms,
  isOnline,
  onSelectGame,
  onToggleFavorite,
  onRejoinRoom,
  onOpenJoin,
  onOpenCreate,
  showCoachMarks,
  onDismissCoach,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [coachStep, setCoachStep] = useState(0);

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (filter === 'favorites' && !favorites.includes(g.id)) return false;
      if (filter === 'quick' && g.meta.avgMinutes > 5) return false;
      if (filter === '5+' && g.meta.maxPlayers < 5) return false;
      if (filter !== 'all' && filter !== 'favorites' && filter !== 'quick' && filter !== '5+') {
        if (!g.meta.tags.includes(filter)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return g.meta.name.toLowerCase().includes(q) || g.meta.tagline.toLowerCase().includes(q);
      }
      return true;
    });
  }, [games, filter, favorites, search]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const code = search.trim().toUpperCase();
      if (/^[A-HJ-NP-Z]{4}$/.test(code)) {
        onRejoinRoom(code);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Hero Banner */}
      <section className="arena-glass rounded-[28px] p-6 sm:p-8 flex flex-col lg:flex-row items-stretch justify-between gap-8">
        <div className="flex flex-col justify-between gap-4 max-w-2xl">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--accent)]">
              2–12 Players Online · 2–4 Local Party · Solo vs Bots
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text)] [text-wrap:balance]">
              Play together in 30 seconds.
            </h1>
            <p className="text-base text-[var(--text-dim)] max-w-xl">
              Create a room, share a 4-letter code or QR, and battle colleagues on PC, phone, tablet, or gamepad.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => onOpenCreate('tank-arena')}
              className="arena-btn-primary px-6 py-3 rounded-xl font-bold text-base inline-flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Play size={18} />
              Create Tank Arena Room
            </button>
            <button
              type="button"
              disabled={!isOnline}
              onClick={onOpenJoin}
              className="px-6 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] font-bold text-base hover:brightness-110 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              Join by Code / Open Rooms
            </button>
          </div>
        </div>

        <div className="lg:w-[420px] rounded-2xl overflow-hidden border border-[var(--border)] relative shrink-0 min-h-[205px] bg-black/40">
          <img
            src="/src/assets/images/arena_hub_showcase_1795428450530.jpg"
            alt="Office Arena battle showcase"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-5">
            <div className="text-lg font-bold text-white font-display">Featured · Tank Arena</div>
            <div className="text-xs text-white/80">9 Illustrated & Classic Maps · Custom Keys · Dynamic Power</div>
          </div>
        </div>
      </section>

      {/* Onboarding Coach Mark */}
      {showCoachMarks && (
        <div className="arena-glass rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-[var(--accent)]">
          <div className="text-sm text-[var(--text)]">
            <span className="font-bold text-[var(--accent)]">Tip {coachStep + 1}/3: </span>
            {coachStep === 0 && 'Use the search bar (or Ctrl+K) to find games or enter a 4-letter room code.'}
            {coachStep === 1 && 'Filter games by Quick, Team, or 5+ Players to fit your group size.'}
            {coachStep === 2 && 'Click Tank Arena below to try Solo vs Bots or host a 12-player online room.'}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {coachStep < 2 ? (
              <button
                type="button"
                onClick={() => setCoachStep((s) => s + 1)}
                className="px-4 py-1.5 rounded-lg arena-btn-primary text-sm font-bold whitespace-nowrap"
              >
                Next Tip
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDismissCoach}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text)] whitespace-nowrap"
            >
              {coachStep < 2 ? 'Skip' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                filter === f.id
                  ? 'arena-btn-primary text-white'
                  : 'bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80 shrink-0">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search games or room code..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Game Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--text)]">Arena Games</h2>
          <span className="text-sm text-[var(--text-dim)] tabular-nums">{filteredGames.length} playable</span>
        </div>

        {filteredGames.length === 0 ? (
          <div className="arena-glass rounded-2xl p-10 text-center space-y-3">
            <p className="text-lg font-semibold text-[var(--text)]">No games match that filter.</p>
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
              className="px-5 py-2.5 rounded-xl arena-btn-primary text-sm font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((g) => {
              const isFav = favorites.includes(g.id);
              return (
                <article
                  key={g.id}
                  onClick={() => onSelectGame(g.id)}
                  className="arena-glass arena-glass-interactive rounded-[20px] overflow-hidden cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="aspect-video w-full overflow-hidden bg-black/30 relative">
                      <img
                        src={g.meta.banner}
                        alt={g.meta.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xl font-bold text-[var(--text)] truncate">{g.meta.name}</h3>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(g.id);
                          }}
                          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--gold)] shrink-0"
                        >
                          <Star size={18} className={isFav ? 'fill-[var(--gold)] text-[var(--gold)]' : ''} />
                        </button>
                      </div>
                      <p className="text-sm text-[var(--text-dim)] line-clamp-2">{g.meta.tagline}</p>
                      <div className="text-xs font-semibold text-[var(--text-dim)] pt-1 tabular-nums">
                        {g.meta.minPlayers}–{g.meta.maxPlayers} players · ~{g.meta.avgMinutes} min
                        {g.maps && g.maps.length > 0 ? ` · ${g.maps.length} maps` : ''} · {g.modes.length} {g.modes.length === 1 ? 'mode' : 'modes'}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-3 border-t border-[var(--border)]/60">
                    <span className="text-sm font-bold text-[var(--accent)] inline-flex items-center gap-1.5">
                      Open Game & Modes <ArrowRight size={16} />
                    </span>
                    <span className="text-xs text-[var(--text-dim)]">
                      {[
                        g.meta.supports.online && 'Online',
                        g.meta.supports.localParty && 'Local',
                        g.meta.supports.solo && 'Solo',
                      ]
                        .filter(Boolean)
                        .join(' / ')}
                    </span>
                  </div>
                </article>
              );
            })}

            {/* Coming Soon Roadmap Cards */}
            {filter === 'all' &&
              !search &&
              COMING_SOON_IDEAS.map((idea) => (
                <div
                  key={idea.id}
                  className="arena-glass rounded-[20px] p-5 flex flex-col justify-between opacity-65"
                >
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[var(--text-dim)]">Coming Soon</div>
                    <h3 className="text-xl font-bold text-[var(--text)]">{idea.name}</h3>
                    <p className="text-sm text-[var(--text-dim)]">{idea.players} · {idea.tags}</p>
                  </div>
                  <div className="pt-6 text-xs font-semibold text-[var(--text-dim)]">
                    Next up on Office Arena
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Recent Rooms */}
      {recentRooms.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[var(--text)]">Recent Rooms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recentRooms.map((r) => (
              <div
                key={r.code}
                className="arena-glass rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[var(--text)] truncate">{r.name}</div>
                  <div className="text-xs text-[var(--text-dim)] tabular-nums">
                    {r.code} · {r.gameName}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={() => onRejoinRoom(r.code)}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Users size={15} /> Rejoin
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
