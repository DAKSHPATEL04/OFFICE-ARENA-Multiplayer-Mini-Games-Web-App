import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart2,
  Eye,
  Flag,
  Flame,
  HelpCircle,
  Pause,
  Play,
  Settings,
  Shield,
  Sliders,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { GameClient, GameModule } from '../../../shared/GameModule.ts';
import type { MatchResult, PlayModeType, RoomPhase, RoomPlayer, TeamId } from '../../../shared/types.ts';
import type { HudSnapshot } from '../../../../games/tank-arena/client/TankArenaScene.ts';
import { ShapeColorBadge } from '../components/PlayerBadge.tsx';

export interface ActiveMatchContext {
  game: GameModule;
  playMode: PlayModeType;
  phase: RoomPhase;
  countdownSec: number | null;
  mapId: string;
  seed: number;
  settings: Record<string, unknown>;
  players: RoomPlayer[];
  localPlayerId: string;
  localPlayers?: Array<{ id: string; nickname: string; colorId: string; team: TeamId; inputSlot: number }>;
  isSpectator: boolean;
  lateJoinAllowed?: boolean;
  controlStyle: string;
  pingMs: number;
}

const FlatBulletIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg width="11" height="20" viewBox="0 0 11 20" fill="none" aria-hidden="true" className="shrink-0">
    <path
      d="M5.5 1.2C7.5 1.2 9.1 3.8 9.1 6.7V14.8H1.9V6.7C1.9 3.8 3.5 1.2 5.5 1.2Z"
      fill={filled ? '#F59E0B' : '#1E293B'}
      stroke={filled ? '#FDE68A' : '#475569'}
      strokeWidth="1.2"
    />
    <rect
      x="1.9"
      y="16.2"
      width="7.2"
      height="2.6"
      rx="0.5"
      fill={filled ? '#D97706' : '#334155'}
    />
  </svg>
);

const FlatMatchModal: React.FC<{
  open: boolean;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-[#0B111E] border border-slate-600/45 rounded-lg w-full max-w-md p-5">
        <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-slate-700/60">
          <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-md bg-slate-800/80 border border-slate-600/40 hover:bg-slate-700 text-slate-300 hover:text-white inline-flex items-center justify-center transition-colors"
              aria-label="Close modal"
            >
              <X size={17} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};

export const MatchViewScreen: React.FC<{
  match: ActiveMatchContext;
  showFpsPing: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onSendInput: (payload: unknown) => void;
  onJoinMatchLate: () => void;
  onLeaveMatch: () => void;
  onLocalMatchEnd: (result: MatchResult) => void;
  onOpenSettings: () => void;
  onOpenControls: () => void;
  onOpenHowTo: () => void;
  onRegisterClient: (client: GameClient | null) => void;
}> = ({
  match,
  showFpsPing,
  muted,
  onToggleMute,
  onSendInput,
  onJoinMatchLate,
  onLeaveMatch,
  onLocalMatchEnd,
  onOpenSettings,
  onOpenControls,
  onOpenHowTo,
  onRegisterClient,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<GameClient | null>(null);

  const [paused, setPaused] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [controlsOverlayOpen, setControlsOverlayOpen] = useState(false);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [showOnboardingHint, setShowOnboardingHint] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowOnboardingHint(false), 10000);
    return () => clearTimeout(t);
  }, []);

  // Mount GameClient when phase enters PLAYING (or offline immediately)
  useEffect(() => {
    if (match.phase !== 'PLAYING' || !stageRef.current) return;
    const client = match.game.createClientScene({
      container: stageRef.current,
      localPlayerId: match.localPlayerId,
      localPlayers: match.localPlayers,
      playMode: match.playMode,
      isSpectator: match.isSpectator,
      mapId: match.mapId,
      seed: match.seed,
      settings: match.settings,
      players: match.players,
      controlStyle: match.controlStyle,
      onSendInput,
      onRequestPause: () => setPaused((p) => !p),
      onRequestJoinMatch: onJoinMatchLate,
      onLocalMatchEnd,
      onHudUpdate: (s) => setHud(s as HudSnapshot),
    });
    clientRef.current = client;
    onRegisterClient(client);

    const onResize = () => {
      if (stageRef.current) {
        client.resize(stageRef.current.clientWidth, stageRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      client.destroy();
      clientRef.current = null;
      onRegisterClient(null);
    };
    // Intentionally keyed to match instance lifecycle
  }, [match.phase, match.seed, match.game.id]);

  // Sync controlStyle or spectator updates dynamically
  useEffect(() => {
    clientRef.current?.setControlStyle(match.controlStyle);
  }, [match.controlStyle]);

  useEffect(() => {
    clientRef.current?.setSpectatorMode(match.isSpectator);
  }, [match.isSpectator]);

  useEffect(() => {
    if (match.playMode !== 'online') {
      clientRef.current?.setPaused(paused);
    }
  }, [paused, match.playMode]);

  // Keyboard shortcuts during match
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setScoreboardOpen(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === '?') {
        setControlsOverlayOpen((c) => !c);
      } else if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setScoreboardOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const modeId = String(match.settings.mode ?? 'flag');
  const activeMode = match.game.modes.find((m) => m.id === modeId) ?? match.game.modes[0];
  const styleObj = match.game.controlStyles.find((s) => s.id === match.controlStyle);

  const fmtTime = (sec: number) => {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  const flagStatusText = (state: 'home' | 'carried' | 'dropped') =>
    state === 'home' ? 'Home' : state === 'carried' ? 'Taken!' : 'Dropped';

  // Phase: LOADING (The Plan Screen)
  if (match.phase === 'LOADING') {
    return (
      <div className="fixed inset-0 z-40 bg-[#070B16] flex items-center justify-center p-4">
        <div className="bg-[#0B111E] border border-slate-600/45 rounded-lg max-w-xl w-full p-7 text-center space-y-5">
          <div className="text-xs font-bold uppercase tracking-widest text-teal-400">The Plan</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">{activeMode?.name}</h1>
          <p className="text-base sm:text-lg text-slate-100 font-semibold">{activeMode?.planText}</p>
          <p className="text-sm text-slate-400">{activeMode?.tip}</p>

          {styleObj && (
            <div className="rounded-md bg-[#11192B] border border-slate-700/70 p-4 text-left space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Controls · {styleObj.name}
              </div>
              {styleObj.summaryLines.map((line, i) => (
                <div key={i} className="text-sm text-slate-200">
                  • {line}
                </div>
              ))}
            </div>
          )}

          <div className="text-xs font-semibold text-slate-400">Syncing arena with all players…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-[#070B16] flex flex-col overflow-hidden select-none">
      {/* Phaser Container */}
      <div ref={stageRef} className="w-full h-full game-stage-lock relative" />

      {/* Countdown Overlay (3 - 2 - 1) */}
      {match.phase === 'COUNTDOWN' && (
        <div className="fixed inset-0 z-40 bg-black/65 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="text-xs font-bold uppercase tracking-widest text-teal-400">{activeMode?.name}</div>
          <div className="text-8xl sm:text-9xl font-display font-bold text-white tabular-nums">
            {match.countdownSec ?? 3}
          </div>
          <div className="text-sm text-slate-200 font-semibold">{activeMode?.planText}</div>
        </div>
      )}

      {/* Flat 2D Top HUD */}
      {match.phase === 'PLAYING' && hud && match.playMode !== 'local-party' && (
        <div className="fixed top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 z-30 pointer-events-none grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          {/* Top-Left: Flat FPS Counter & Flag Home Status */}
          <div className="flex flex-col items-start gap-1.5 min-w-0">
            {showFpsPing && (
              <div className="hud-flat-panel px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold text-slate-300 tabular-nums inline-flex items-center gap-2 whitespace-nowrap">
                <span>{hud.fps} FPS</span>
                {match.playMode === 'online' && <span className="text-slate-400">{match.pingMs}ms</span>}
              </div>
            )}
            {hud.flags && (
              <div className="hud-flat-panel rounded-md overflow-hidden inline-flex items-center text-[11px] sm:text-xs font-bold whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-red-400 border-l-2 border-l-red-500">
                  <Flag size={12} className="shrink-0" />
                  <span>{flagStatusText(hud.flags.red.state)}</span>
                </span>
                <span className="w-px h-4 bg-slate-600/50" />
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-blue-400 border-r-2 border-r-blue-500">
                  <Flag size={12} className="shrink-0" />
                  <span>{flagStatusText(hud.flags.blue.state)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Top-Center: Flat 2D Scoreboard */}
          {hud.mode === 'ffa' ? (
            <div className="hud-flat-panel rounded-md overflow-hidden flex items-stretch justify-self-center">
              <div className="px-3 py-1.5 flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-100 tabular-nums whitespace-nowrap border-r border-slate-600/50">
                <span>
                  YOU <strong className="text-teal-400">{hud.myPoints}</strong>
                </span>
                <span className="text-slate-500">·</span>
                <span>
                  TOP <strong>{hud.leaderPoints}</strong>
                </span>
              </div>
              <div
                className={`px-3 py-1.5 flex items-center justify-center text-sm sm:text-base font-mono font-bold tabular-nums whitespace-nowrap ${
                  hud.suddenDeath
                    ? 'text-amber-400'
                    : hud.timeLeftSec <= 30
                      ? 'text-rose-400'
                      : 'text-white'
                }`}
              >
                {hud.suddenDeath ? 'SUDDEN DEATH' : fmtTime(hud.timeLeftSec)}
              </div>
            </div>
          ) : (
            <div className="hud-flat-panel rounded-md overflow-hidden flex items-stretch justify-self-center">
              {/* Red Team Score */}
              <div className="bg-red-600 px-3 sm:px-4 py-1.5 min-w-[40px] sm:min-w-[50px] flex items-center justify-center">
                <span className="text-base sm:text-lg font-extrabold text-white tabular-nums leading-none">
                  {hud.scores.red}
                </span>
              </div>

              {/* Center VS + Timer / SUDDEN DEATH */}
              <div className="bg-[#0B111E] px-2.5 sm:px-4 py-1 min-w-[74px] sm:min-w-[96px] flex flex-col items-center justify-center border-x border-slate-600/50">
                <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-slate-400 uppercase leading-none mb-0.5">
                  VS
                </span>
                <span
                  className={`text-xs sm:text-sm font-mono font-bold tabular-nums leading-none whitespace-nowrap ${
                    hud.suddenDeath
                      ? 'text-amber-400'
                      : hud.timeLeftSec <= 30
                        ? 'text-rose-400'
                        : 'text-white'
                  }`}
                >
                  {hud.suddenDeath ? 'SUDDEN DEATH' : fmtTime(hud.timeLeftSec)}
                </span>
              </div>

              {/* Blue Team Score */}
              <div className="bg-blue-600 px-3 sm:px-4 py-1.5 min-w-[40px] sm:min-w-[50px] flex items-center justify-center">
                <span className="text-base sm:text-lg font-extrabold text-white tabular-nums leading-none">
                  {hud.scores.blue}
                </span>
              </div>
            </div>
          )}

          {/* Top-Right: Flat 2D Action Buttons */}
          <div className="pointer-events-auto flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={onToggleMute}
              title="Mute / Unmute"
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="hud-flat-btn w-9 h-9 sm:w-10 sm:h-10 rounded-md text-slate-100 inline-flex items-center justify-center"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setScoreboardOpen((s) => !s)}
              title="Scoreboard (Tab)"
              aria-label="Toggle scoreboard"
              className="hud-flat-btn h-9 sm:h-10 w-9 sm:w-auto sm:px-3 rounded-md text-xs font-bold text-slate-100 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <BarChart2 size={16} className="shrink-0" />
              <span className="hidden sm:inline">Scores</span>
            </button>
            <button
              type="button"
              onClick={() => setPaused(true)}
              title="Pause (Esc)"
              aria-label="Pause match"
              className="hud-flat-btn w-9 h-9 sm:w-10 sm:h-10 rounded-md text-slate-100 inline-flex items-center justify-center"
            >
              <Pause size={17} />
            </button>
          </div>
        </div>
      )}

      {/* Local Party Pause Corner */}
      {match.phase === 'PLAYING' && match.playMode === 'local-party' && (
        <button
          type="button"
          onClick={() => setPaused(true)}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-30 hud-flat-btn px-4 h-9 rounded-md text-xs font-bold text-slate-100 inline-flex items-center gap-1.5"
        >
          <Pause size={15} /> Pause
        </button>
      )}

      {/* Kill Feed (top-right under controls) */}
      {match.phase === 'PLAYING' && hud && hud.killFeed.length > 0 && (
        <div className="fixed top-14 sm:top-16 right-2.5 sm:right-3 z-20 flex flex-col items-end gap-1 pointer-events-none max-w-xs">
          {hud.killFeed.slice(-4).map((kf) => (
            <div
              key={kf.id}
              className="hud-flat-panel px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5"
            >
              <span style={{ color: kf.killerColor }}>{kf.killer}</span>
              <span className="text-slate-400">hit</span>
              <span style={{ color: kf.victimColor }}>{kf.victim}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom-Left HUD: Flat Bullet Ammo Counter & Active Power */}
      {match.phase === 'PLAYING' && hud && !match.isSpectator && match.playMode !== 'local-party' && (
        <div className="fixed bottom-32 left-3 sm:bottom-4 sm:left-4 z-20 pointer-events-none flex flex-wrap items-center gap-2">
          <div className="hud-flat-panel px-3 py-2 rounded-md flex items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ammo</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: hud.ammoMax }).map((_, i) => (
                <FlatBulletIcon key={i} filled={i < hud.ammo} />
              ))}
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 tabular-nums pl-1 border-l border-slate-700">
              {hud.ammo}/{hud.ammoMax}
            </span>
          </div>

          {hud.activePower && (
            <div
              className={`bg-[#0B111E]/92 px-3 py-2 rounded-md border text-xs font-bold inline-flex items-center gap-1.5 ${
                hud.activePower === 'shield'
                  ? 'border-sky-400 text-sky-300'
                  : hud.activePower === 'unlimited'
                    ? 'border-orange-500 text-amber-300'
                    : 'border-emerald-400 text-emerald-300'
              }`}
            >
              {hud.activePower === 'speed' ? (
                <Zap size={14} />
              ) : hud.activePower === 'shield' ? (
                <Shield size={14} />
              ) : (
                <Flame size={14} />
              )}
              {hud.activePower === 'speed'
                ? 'Speed 2×'
                : hud.activePower === 'shield'
                  ? 'Shield Active'
                  : 'Fireball Unlimited'}
            </div>
          )}
        </div>
      )}

      {/* Respawn Overlay */}
      {match.phase === 'PLAYING' && hud && hud.respawnSec > 0 && !match.isSpectator && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-20 hud-flat-panel px-4 py-2 rounded-md text-sm font-bold text-amber-400 tabular-nums pointer-events-none">
          Respawn in {hud.respawnSec}s…
        </div>
      )}

      {/* First 10s Hint */}
      {match.phase === 'PLAYING' && showOnboardingHint && styleObj && !match.isSpectator && (
        <div className="fixed bottom-32 sm:bottom-36 left-1/2 -translate-x-1/2 z-20 hud-flat-panel px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-200 pointer-events-none whitespace-nowrap max-w-[92vw] truncate">
          {styleObj.summaryLines.join(' · ')}
        </div>
      )}

      {/* Spectator Banner */}
      {match.phase === 'PLAYING' && match.isSpectator && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 hud-flat-panel px-4 py-2.5 rounded-md flex items-center gap-4">
          <span className="text-sm font-bold text-slate-100 inline-flex items-center gap-2">
            <Eye size={16} className="text-teal-400" /> Watching Match
          </span>
          {match.lateJoinAllowed && (
            <button
              type="button"
              onClick={onJoinMatchLate}
              className="px-3.5 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <UserPlus size={14} /> Join Match Now
            </button>
          )}
        </div>
      )}

      {/* Tab Scoreboard Overlay */}
      {scoreboardOpen && hud && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-[#0B111E] border border-slate-600/50 rounded-lg w-full max-w-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <h3 className="text-base sm:text-lg font-bold text-white">{activeMode?.name} Scoreboard</h3>
              <span className="text-xs font-mono text-slate-400 tabular-nums">{fmtTime(hud.timeLeftSec)} left</span>
            </div>
            <div className="divide-y divide-slate-800">
              {hud.scoreboard.map((row) => (
                <div key={row.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <ShapeColorBadge colorId={row.colorId} size={18} />
                    <span className={`font-bold ${row.isSelf ? 'text-teal-400' : 'text-slate-100'}`}>
                      {row.nickname}
                    </span>
                  </div>
                  <div className="flex items-center gap-5 tabular-nums text-xs text-slate-300">
                    <span>
                      Points: <strong className="text-sm text-white">{row.points}</strong>
                    </span>
                    <span>Deaths: {row.deaths}</span>
                    {match.playMode === 'online' && <span className="text-slate-400">{row.pingMs}ms</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls Quick Reference Modal (?) */}
      <FlatMatchModal
        open={controlsOverlayOpen}
        title="Controls Quick Reference"
        onClose={() => setControlsOverlayOpen(false)}
      >
        <div className="space-y-3">
          {styleObj && (
            <div className="p-3.5 rounded-md bg-[#11192B] border border-teal-500/40">
              <div className="font-bold text-sm text-teal-400 mb-1.5">{styleObj.name}</div>
              {styleObj.summaryLines.map((l, i) => (
                <div key={i} className="text-sm text-slate-200">
                  • {l}
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-slate-400">
            Shortcuts: Tab = Scoreboard · Esc = Pause · F = Fullscreen · ? = Toggle this reference
          </div>
        </div>
      </FlatMatchModal>

      {/* Pause Modal */}
      <FlatMatchModal
        open={paused}
        title={leaveConfirm ? 'Leave Match?' : 'Match Paused'}
        onClose={() => {
          setLeaveConfirm(false);
          setPaused(false);
        }}
      >
        {leaveConfirm ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you sure you want to leave the current match and return to the hub?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveConfirm(false)}
                className="px-4 py-2 rounded-md bg-slate-800 border border-slate-600/50 hover:bg-slate-700 text-slate-100 font-bold text-sm transition-colors"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={onLeaveMatch}
                className="px-5 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-colors"
              >
                Leave Match
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="py-2.5 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Play size={16} /> Resume
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(false);
                onOpenControls();
              }}
              className="py-2.5 rounded-md bg-slate-800 border border-slate-600/45 hover:bg-slate-700 text-slate-100 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Sliders size={16} /> Control Style
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(false);
                onOpenSettings();
              }}
              className="py-2.5 rounded-md bg-slate-800 border border-slate-600/45 hover:bg-slate-700 text-slate-100 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Settings size={16} /> Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(false);
                onOpenHowTo();
              }}
              className="py-2.5 rounded-md bg-slate-800 border border-slate-600/45 hover:bg-slate-700 text-slate-100 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <HelpCircle size={16} /> How to Play
            </button>
            <button
              type="button"
              onClick={() => setLeaveConfirm(true)}
              className="py-2.5 rounded-md bg-rose-500/15 border border-rose-500/40 hover:bg-rose-500/25 text-rose-400 font-bold text-sm transition-colors"
            >
              Leave Match
            </button>
          </div>
        )}
      </FlatMatchModal>
    </div>
  );
};

