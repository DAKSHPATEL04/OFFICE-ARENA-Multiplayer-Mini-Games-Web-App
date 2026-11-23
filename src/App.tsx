import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Command,
  Download,
  Gamepad2,
  Home,
  Settings,
  Sliders,
  User,
  Users,
  WifiOff,
} from 'lucide-react';
import { GAMES } from '../games/registry.ts';
import { tankAudio } from '../games/tank-arena/client/TankArenaAudio.ts';
import type { GameClient, GameModule } from '../platform/shared/GameModule.ts';
import type { ServerMessage } from '../platform/shared/protocol.ts';
import type {
  ControlDevice,
  MatchResult,
  PlayModeType,
  RoomOptions,
  RoomPhase,
  RoomPlayer,
  RoomSnapshotState,
  RoomSummary,
  TeamId,
} from '../platform/shared/types.ts';
import { networkManager } from '../platform/client/core/NetworkManager.ts';
import { SettingsStore, type PlatformSettings, type ThemeMode } from '../platform/client/core/SettingsStore.ts';
import { useOnlineStatus, usePWAInstall } from '../platform/client/core/usePWAInstall.ts';
import { CommandPalette } from '../platform/client/ui/components/CommandPalette.tsx';
import { Modal, ProfileIconSvg, ShapeColorBadge, ToastStack, type ToastItem } from '../platform/client/ui/components/PlayerBadge.tsx';
import { GameDetailScreen } from '../platform/client/ui/screens/GameDetailScreen.tsx';
import { HubScreen } from '../platform/client/ui/screens/HubScreen.tsx';
import { LobbyScreen } from '../platform/client/ui/screens/LobbyScreen.tsx';
import { LocalPartySetupScreen, SoloSetupScreen, type LocalPartyConfig } from '../platform/client/ui/screens/LocalAndSoloScreens.tsx';
import { MatchViewScreen, type ActiveMatchContext } from '../platform/client/ui/screens/MatchViewScreen.tsx';
import { ResultsScreen } from '../platform/client/ui/screens/ResultsScreen.tsx';
import { CreateRoomScreen, JoinRoomScreen } from '../platform/client/ui/screens/RoomScreens.tsx';
import {
  ControlSetupScreen,
  CreditsScreen,
  HowToPlayScreen,
  ProfileScreen,
  SettingsScreen,
  TouchControlsEditorScreen,
} from '../platform/client/ui/screens/SettingsAndProfileScreens.tsx';

type RouteView =
  | 'hub'
  | 'detail'
  | 'create-room'
  | 'join-room'
  | 'lobby'
  | 'local-setup'
  | 'solo-setup'
  | 'match'
  | 'results'
  | 'profile'
  | 'settings'
  | 'controls'
  | 'touch-editor'
  | 'howto'
  | 'credits';

export default function App() {
  const [games, setGames] = useState<GameModule[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('tank-arena');
  const [preselectedMapId, setPreselectedMapId] = useState<string>('auto');
  const [route, setRoute] = useState<RouteView>('hub');
  const [prevRoute, setPrevRoute] = useState<RouteView>('hub');

  const [profile, setProfile] = useState(() => SettingsStore.getProfile());
  const [settings, setSettings] = useState<PlatformSettings>(() => SettingsStore.getSettings());
  const [favorites, setFavorites] = useState<string[]>(() => SettingsStore.getFavorites());
  const [recentRooms, setRecentRooms] = useState(() => SettingsStore.getRecentRooms());
  const [history, setHistory] = useState(() => SettingsStore.getHistory());

  const [welcomeOpen, setWelcomeOpen] = useState(() => !SettingsStore.getSettings().onboarding.welcomed);
  const [welcomeName, setWelcomeName] = useState(() => SettingsStore.getProfile().nickname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [iosInstallOpen, setIosInstallOpen] = useState(false);

  // Network & Room state
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [pingMs, setPingMs] = useState(0);
  const [connStatus, setConnStatus] = useState(networkManager.status);
  const [openRooms, setOpenRooms] = useState<RoomSummary[]>([]);
  const [selfId, setSelfId] = useState<string>('local');
  const [room, setRoom] = useState<RoomSnapshotState | null>(null);
  const [joinInitialCode, setJoinInitialCode] = useState<string>('');
  const [joinNeedsPw, setJoinNeedsPw] = useState(false);
  const [joinCanSpec, setJoinCanSpec] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [systemBanner, setSystemBanner] = useState<{ title: string; body: string } | null>(null);

  // Match & Results state
  const [activeMatch, setActiveMatch] = useState<ActiveMatchContext | null>(null);
  const [matchResult, setMatchResult] = useState<{ result: MatchResult; playMode: PlayModeType; gameId: string } | null>(null);
  const gameClientRef = useRef<GameClient | null>(null);
  const lastOfflineLaunchRef = useRef<{
    playMode: 'solo' | 'local-party';
    players: RoomPlayer[];
    localPlayers?: LocalPartyConfig['localPlayers'];
    settings: Record<string, unknown>;
  } | null>(null);

  const pushToast = useCallback((text: string, level: ToastItem['level'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, level, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Load games & apply theme on boot
  useEffect(() => {
    SettingsStore.applyThemeToDocument(settings);
    tankAudio.setVolumes({
      master: settings.audio.master,
      music: settings.audio.music,
      effects: settings.audio.effects,
      muted: settings.audio.muted,
    });

    Promise.all(GAMES.map((loader) => loader())).then((mods) => {
      const list = mods.map((m) => m.default);
      setGames(list);
    });
  }, []);

  // Sync audio volumes whenever settings change
  useEffect(() => {
    tankAudio.setVolumes({
      master: settings.audio.master,
      music: settings.audio.music,
      effects: settings.audio.effects,
      muted: settings.audio.muted,
    });
  }, [settings.audio]);

  const currentGame = games.find((g) => g.id === (room?.gameId ?? selectedGameId)) ?? games[0];

  // Deep link ?room=ABCD and Ctrl/Cmd+K palette shortcut
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && /^[A-HJ-NP-Z]{4}$/i.test(roomParam.trim())) {
      const code = roomParam.trim().toUpperCase();
      setJoinInitialCode(code);
      setRoute('join-room');
      const curProf = SettingsStore.getProfile();
      const dev = SettingsStore.detectDevice();
      networkManager.send({
        type: 'joinRoom',
        code,
        profile: {
          nickname: curProf.nickname,
          colorId: curProf.colorId,
          iconId: curProf.iconId,
          controlStyle: curProf.controlStyle[dev],
          device: dev,
        },
      });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setSettings((prev) => {
          const next = { ...prev, audio: { ...prev.audio, muted: !prev.audio.muted } };
          SettingsStore.saveSettings(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Connect WebSocket & subscribe to server events
  useEffect(() => {
    networkManager.connect();
    const pollId = window.setInterval(() => {
      setPingMs(networkManager.pingMs);
      setConnStatus(networkManager.status);
    }, 1000);

    const unsub = networkManager.subscribe((msg: ServerMessage) => {
      if (msg.type === 'rooms') {
        setOpenRooms(msg.rooms);
      } else if (msg.type === 'toast') {
        pushToast(msg.text, msg.level);
      } else if (msg.type === 'error') {
        setJoinError(msg.message);
        if (msg.needsPassword) setJoinNeedsPw(true);
        if (msg.canSpectate) {
          setJoinCanSpec((prev) => prev || joinInitialCode);
        }
        pushToast(msg.message, 'error');
      } else if (msg.type === 'roomJoined') {
        setSelfId(msg.playerId);
        setRoom(msg.room);
        setSelectedGameId(msg.room.gameId);
        setJoinError(null);
        setJoinNeedsPw(false);
        setJoinCanSpec(null);

        const gMod = games.find((g) => g.id === msg.room.gameId);
        SettingsStore.pushRecentRoom({
          code: msg.room.code,
          name: msg.room.options.name,
          gameId: msg.room.gameId,
          gameName: gMod?.meta.name ?? msg.room.gameId,
          lastVisitedAt: Date.now(),
        });
        setRecentRooms(SettingsStore.getRecentRooms());

        if (msg.room.phase === 'LOBBY') {
          setRoute('lobby');
        } else if (msg.room.phase === 'PLAYING' || msg.room.phase === 'LOADING' || msg.room.phase === 'COUNTDOWN') {
          const me = msg.room.players.find((p) => p.id === msg.playerId);
          const gameObj = games.find((g) => g.id === msg.room.gameId) ?? games[0];
          if (gameObj) {
            setActiveMatch({
              game: gameObj,
              playMode: 'online',
              phase: msg.room.phase,
              countdownSec: msg.room.countdownRemainingSec,
              mapId: String(msg.room.gameSettings.map ?? 'A'),
              seed: 1,
              settings: msg.room.gameSettings,
              players: msg.room.players,
              localPlayerId: msg.playerId,
              isSpectator: msg.isSpectator,
              lateJoinAllowed: msg.room.lateJoinAllowed,
              controlStyle: me?.controlStyle ?? SettingsStore.getProfile().controlStyle[SettingsStore.detectDevice()],
              pingMs: networkManager.pingMs,
            });
            setRoute('match');
          }
        }
      } else if (msg.type === 'roomUpdate') {
        setRoom(msg.room);
        setActiveMatch((prev) => {
          if (!prev) return null;
          const me = msg.room.players.find((p) => p.id === networkManager.playerId);
          return {
            ...prev,
            players: msg.room.players,
            isSpectator: Boolean(me?.isSpectator),
            lateJoinAllowed: msg.room.lateJoinAllowed,
            pingMs: networkManager.pingMs,
          };
        });
        if (msg.room.phase === 'LOBBY' && (route === 'results' || route === 'match')) {
          setActiveMatch(null);
          setMatchResult(null);
          setRoute('lobby');
        }
      } else if (msg.type === 'loading') {
        const latestRoom = networkManager.currentRoom;
        const gObj = games.find((g) => g.id === (latestRoom?.gameId ?? selectedGameId)) ?? games[0];
        const myId = networkManager.playerId ?? selfId;
        const me = latestRoom?.players.find((p) => p.id === myId);
        if (gObj && latestRoom) {
          setActiveMatch({
            game: gObj,
            playMode: 'online',
            phase: 'LOADING',
            countdownSec: 3,
            mapId: msg.mapId,
            seed: msg.seed,
            settings: msg.settings,
            players: latestRoom.players,
            localPlayerId: myId,
            isSpectator: Boolean(me?.isSpectator),
            lateJoinAllowed: latestRoom.lateJoinAllowed,
            controlStyle: me?.controlStyle ?? SettingsStore.getProfile().controlStyle[SettingsStore.detectDevice()],
            pingMs: networkManager.pingMs,
          });
          setRoute('match');
          window.setTimeout(() => {
            networkManager.send({ type: 'loaded' });
          }, 1200);
        }
      } else if (msg.type === 'countdown') {
        setActiveMatch((prev) => (prev ? { ...prev, phase: 'COUNTDOWN', countdownSec: msg.sec } : prev));
      } else if (msg.type === 'matchStart') {
        setActiveMatch((prev) =>
          prev
            ? {
                ...prev,
                phase: 'PLAYING',
                mapId: msg.mapId,
                seed: msg.seed,
                settings: msg.settings,
                countdownSec: null,
              }
            : prev,
        );
      } else if (msg.type === 'snapshot') {
        gameClientRef.current?.applySnapshot(msg.payload, msg.serverTime);
      } else if (msg.type === 'event') {
        gameClientRef.current?.applyEvent(msg.payload);
      } else if (msg.type === 'matchEnd') {
        const myId = networkManager.playerId ?? selfId;
        const latestRoom = networkManager.currentRoom;
        const gameId = latestRoom?.gameId ?? selectedGameId;
        const myStat = msg.result.stats.find((s) => s.playerId === myId);
        if (myStat) {
          const won =
            msg.result.winnerTeam === 'ffa'
              ? msg.result.stats[0]?.playerId === myId
              : msg.result.winnerTeam === myStat.team;
          SettingsStore.recordMatchStats(
            gameId,
            {
              id: `${Date.now()}`,
              gameId,
              modeId: String(latestRoom?.gameSettings.mode ?? 'flag'),
              mapId: String(latestRoom?.gameSettings.map ?? 'A'),
              playedAt: Date.now(),
              durationSec: msg.result.durationSec,
              winnerLabel: msg.result.winnerLabel,
              myPoints: myStat.points,
              myDeaths: myStat.deaths,
              won,
            },
            myStat.captures,
          );
          setHistory(SettingsStore.getHistory());
        }
        setActiveMatch(null);
        setMatchResult({ result: msg.result, playMode: 'online', gameId });
        setRoute('results');
      } else if (msg.type === 'roomClosed' || msg.type === 'kicked') {
        setRoom(null);
        setActiveMatch(null);
        setMatchResult(null);
        setRoute('hub');
        setSystemBanner({
          title: msg.type === 'kicked' ? (msg.banned ? 'Banned from Room' : 'Removed from Room') : 'Room Closed',
          body: msg.reason,
        });
      }
    });

    return () => {
      clearInterval(pollId);
      unsub();
    };
  }, [games, route, selfId, selectedGameId, joinInitialCode, pushToast]);

  const navigate = (next: RouteView) => {
    setPrevRoute(route);
    setRoute(next);
  };

  const buildProfilePayload = () => {
    const dev = SettingsStore.detectDevice();
    return {
      nickname: profile.nickname,
      colorId: profile.colorId,
      iconId: profile.iconId,
      controlStyle: profile.controlStyle[dev],
      device: dev,
    };
  };

  const handleCreateRoomSubmit = (options: Partial<RoomOptions>, gameSettings: Record<string, unknown>) => {
    networkManager.send({
      type: 'createRoom',
      gameId: selectedGameId,
      options,
      gameSettings,
      profile: buildProfilePayload(),
    });
  };

  const handleJoinRoom = (code: string, password?: string, asSpectator?: boolean) => {
    setJoinError(null);
    setJoinCanSpec(code);
    networkManager.send({
      type: 'joinRoom',
      code,
      password,
      asSpectator,
      profile: buildProfilePayload(),
    });
  };

  const handleQuickJoin = (gameId: string) => {
    if (!isOnline) {
      pushToast('You are offline — try Solo vs Bots!', 'warning');
      return;
    }
    networkManager.send({ type: 'quickJoin', gameId });
  };

  const handleLeaveRoom = () => {
    networkManager.send({ type: 'leaveRoom' });
    networkManager.clearRoomTracking();
    setRoom(null);
    setActiveMatch(null);
    setMatchResult(null);
    setRoute('hub');
  };

  const startOfflineMatch = (
    playMode: 'solo' | 'local-party',
    players: RoomPlayer[],
    gameSettings: Record<string, unknown>,
    localPlayers?: LocalPartyConfig['localPlayers'],
  ) => {
    if (!currentGame) return;
    lastOfflineLaunchRef.current = { playMode, players, localPlayers, settings: gameSettings };
    const dev = SettingsStore.detectDevice();
    setActiveMatch({
      game: currentGame,
      playMode,
      phase: 'PLAYING',
      countdownSec: null,
      mapId: String(gameSettings.map ?? 'auto'),
      seed: Math.floor(Math.random() * 0x7fffffff) || 1,
      settings: gameSettings,
      players,
      localPlayerId: players[0]?.id ?? 'solo_human',
      localPlayers,
      isSpectator: false,
      controlStyle: profile.controlStyle[dev],
      pingMs: 0,
    });
    setRoute('match');
  };

  const handleLocalMatchEnd = (result: MatchResult) => {
    if (!activeMatch) return;
    const myStat = result.stats.find((s) => s.playerId === activeMatch.localPlayerId);
    if (myStat) {
      const won =
        result.winnerTeam === 'ffa'
          ? result.stats[0]?.playerId === myStat.playerId
          : result.winnerTeam === myStat.team;
      SettingsStore.recordMatchStats(
        activeMatch.game.id,
        {
          id: `${Date.now()}`,
          gameId: activeMatch.game.id,
          modeId: String(activeMatch.settings.mode ?? 'flag'),
          mapId: activeMatch.mapId,
          playedAt: Date.now(),
          durationSec: result.durationSec,
          winnerLabel: result.winnerLabel,
          myPoints: myStat.points,
          myDeaths: myStat.deaths,
          won,
        },
        myStat.captures,
      );
      setHistory(SettingsStore.getHistory());
    }
    setActiveMatch(null);
    setMatchResult({ result, playMode: activeMatch.playMode, gameId: activeMatch.game.id });
    setRoute('results');
  };

  const handleCycleTheme = () => {
    const order: ThemeMode[] = ['dark', 'light', 'high-contrast'];
    const idx = order.indexOf(settings.theme);
    const nextTheme = order[(idx + 1) % order.length];
    const next = { ...settings, theme: nextTheme };
    setSettings(next);
    SettingsStore.saveSettings(next);
    pushToast(`Theme: ${nextTheme}`);
  };

  const handleWelcomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = welcomeName.trim().slice(0, 14) || 'Player';
    const nextProf = { ...profile, nickname: clean };
    setProfile(nextProf);
    SettingsStore.saveProfile(nextProf);
    const nextSet = {
      ...settings,
      onboarding: { ...settings.onboarding, welcomed: true },
    };
    setSettings(nextSet);
    SettingsStore.saveSettings(nextSet);
    setWelcomeOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col pb-16 sm:pb-0">
      {/* Top Bar (3 zones: Brand | Links | Right Utility + CTA) */}
      {route !== 'match' && (
        <header className="sticky top-0 z-40 arena-glass border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Left Zone: Brand */}
            <button
              type="button"
              onClick={() => setRoute('hub')}
              className="flex items-center gap-2.5 shrink-0 text-left"
            >
              <img
                src="/src/assets/images/office_arena_logo_1795319703637.jpg"
                alt="Office Arena"
                className="w-9 h-9 rounded-xl object-cover border border-[var(--border)]"
              />
              <span className="font-display font-bold text-xl tracking-tight text-[var(--text)] whitespace-nowrap">
                Office Arena
              </span>
            </button>

            {/* Center Zone: Nav links */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRoute('hub')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${
                  route === 'hub' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                Games
              </button>
              <button
                type="button"
                onClick={() => navigate('controls')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${
                  route === 'controls' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                Controls
              </button>
              <button
                type="button"
                onClick={() => navigate('profile')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${
                  route === 'profile' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => navigate('settings')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${
                  route === 'settings' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => navigate('credits')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${
                  route === 'credits' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                Credits
              </button>
            </nav>

            {/* Right Zone: Status + Install + Join Room CTA */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                title="Command Palette (Ctrl+K)"
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text-dim)] hover:text-[var(--text)] whitespace-nowrap"
              >
                <Command size={13} /> K
              </button>

              {!isInstalled && (isInstallable || isIOS) && (
                <button
                  type="button"
                  onClick={() => {
                    if (isInstallable) void install();
                    else setIosInstallOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Download size={14} /> Install
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('profile')}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm font-bold whitespace-nowrap"
              >
                <ShapeColorBadge colorId={profile.colorId} size={18} />
                <ProfileIconSvg iconId={profile.iconId} size={14} className="text-[var(--accent)]" />
                <span className="max-w-[100px] truncate">{profile.nickname}</span>
                {isOnline && connStatus === 'connected' && (
                  <span className="text-[11px] font-mono text-[var(--text-dim)] tabular-nums">{pingMs}ms</span>
                )}
              </button>

              {room ? (
                <button
                  type="button"
                  onClick={() => setRoute('lobby')}
                  className="arena-btn-primary px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shrink-0"
                >
                  Room {room.code}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={() => {
                    networkManager.send({ type: 'listRooms' });
                    setRoute('join-room');
                  }}
                  className="arena-btn-primary px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  Join Room
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Offline Banner */}
      {!isOnline && route !== 'match' && (
        <div className="bg-[#FFC83D]/15 border-b border-[#FFC83D]/40 px-4 py-2 text-center text-xs font-bold text-[#FFC83D] flex items-center justify-center gap-2">
          <WifiOff size={14} /> Offline — Online rooms unavailable, but Solo vs Bots and Local Party work anytime!
        </div>
      )}

      {/* Active Route View */}
      <main className="flex-1">
        {route === 'hub' && (
          <HubScreen
            games={games}
            favorites={favorites}
            recentRooms={recentRooms}
            isOnline={isOnline}
            onSelectGame={(id) => {
              setSelectedGameId(id);
              setPreselectedMapId('auto');
              setRoute('detail');
            }}
            onToggleFavorite={(id) => setFavorites(SettingsStore.toggleFavorite(id))}
            onRejoinRoom={(code) => handleJoinRoom(code)}
            onOpenJoin={() => {
              networkManager.send({ type: 'listRooms' });
              setRoute('join-room');
            }}
            onOpenCreate={(id) => {
              setSelectedGameId(id);
              setPreselectedMapId('auto');
              setRoute('create-room');
            }}
            showCoachMarks={!settings.onboarding.hubCoachDone && !welcomeOpen}
            onDismissCoach={() => {
              const next = { ...settings, onboarding: { ...settings.onboarding, hubCoachDone: true } };
              setSettings(next);
              SettingsStore.saveSettings(next);
            }}
          />
        )}

        {route === 'detail' && currentGame && (
          <GameDetailScreen
            game={currentGame}
            isOnline={isOnline}
            suggestSolo={!settings.onboarding.soloSuggested}
            onBack={() => setRoute('hub')}
            onCreateRoom={(mapId) => {
              setPreselectedMapId(mapId ?? 'auto');
              setRoute('create-room');
            }}
            onJoinRoom={() => {
              networkManager.send({ type: 'listRooms' });
              setRoute('join-room');
            }}
            onQuickJoin={() => handleQuickJoin(currentGame.id)}
            onLocalParty={() => setRoute('local-setup')}
            onSolo={(mapId) => {
              setPreselectedMapId(mapId ?? 'auto');
              setRoute('solo-setup');
            }}
            onOpenHowTo={() => navigate('howto')}
            onDismissSoloSuggest={() => {
              const next = { ...settings, onboarding: { ...settings.onboarding, soloSuggested: true } };
              setSettings(next);
              SettingsStore.saveSettings(next);
            }}
          />
        )}

        {route === 'create-room' && currentGame && (
          <CreateRoomScreen
            game={currentGame}
            hostNickname={profile.nickname}
            initialMapId={preselectedMapId}
            onCancel={() => setRoute('detail')}
            onSubmit={handleCreateRoomSubmit}
          />
        )}

        {route === 'join-room' && (
          <JoinRoomScreen
            initialCode={joinInitialCode}
            openRooms={openRooms}
            needsPassword={joinNeedsPw}
            canSpectatePrompt={joinCanSpec}
            errorMsg={joinError}
            onBack={() => setRoute('hub')}
            onRefresh={() => networkManager.send({ type: 'listRooms' })}
            onJoin={handleJoinRoom}
            onQuickJoin={handleQuickJoin}
            onCreateRoom={() => setRoute('create-room')}
          />
        )}

        {route === 'lobby' && room && currentGame && (
          <LobbyScreen
            game={currentGame}
            room={room}
            selfId={selfId}
            onSendChat={(text) => networkManager.send({ type: 'chat', text })}
            onToggleReady={() => {
              const me = room.players.find((p) => p.id === selfId);
              networkManager.send({ type: 'setReady', ready: !me?.isReady });
            }}
            onSetTeam={(team: TeamId) => networkManager.send({ type: 'setTeam', team })}
            onMovePlayerTeam={(targetId, team) => networkManager.send({ type: 'movePlayerTeam', targetId, team })}
            onShuffleTeams={() => networkManager.send({ type: 'shuffleTeams' })}
            onAutoBalance={() => networkManager.send({ type: 'autoBalanceTeams' })}
            onUpdateSettings={(patch) => networkManager.send({ type: 'hostSettings', settings: patch })}
            onUpdateRoomOptions={(patch) => networkManager.send({ type: 'setRoomOptions', options: patch })}
            onStartMatch={(force) => networkManager.send({ type: 'startMatch', force })}
            onCancelAutoStart={() => networkManager.send({ type: 'cancelAutoStart' })}
            onTakeSeat={() => networkManager.send({ type: 'takeSeat' })}
            onKick={(id) => networkManager.send({ type: 'kick', id })}
            onBan={(id) => networkManager.send({ type: 'ban', id })}
            onTransferHost={(id) => networkManager.send({ type: 'transferHost', id })}
            onLeave={handleLeaveRoom}
            onCloseRoom={() => networkManager.send({ type: 'closeRoom' })}
            onOpenControls={() => navigate('controls')}
            onOpenPractice={() => navigate('controls')}
            onToast={(t) => pushToast(t, 'success')}
          />
        )}

        {route === 'local-setup' && currentGame && (
          <LocalPartySetupScreen
            game={currentGame}
            onBack={() => setRoute('detail')}
            onStart={(cfg) => startOfflineMatch('local-party', cfg.players, cfg.settings, cfg.localPlayers)}
          />
        )}

        {route === 'solo-setup' && currentGame && (
          <SoloSetupScreen
            game={currentGame}
            selfProfile={buildProfilePayload()}
            initialMapId={preselectedMapId}
            onBack={() => setRoute('detail')}
            onStart={(players, gameSettings) => startOfflineMatch('solo', players, gameSettings)}
          />
        )}

        {route === 'match' && activeMatch && (
          <MatchViewScreen
            match={activeMatch}
            showFpsPing={settings.graphics.showFpsPing}
            muted={settings.audio.muted}
            onToggleMute={() => {
              const next = { ...settings, audio: { ...settings.audio, muted: !settings.audio.muted } };
              setSettings(next);
              SettingsStore.saveSettings(next);
            }}
            onSendInput={(payload) => networkManager.send({ type: 'input', t: Date.now(), payload })}
            onJoinMatchLate={() => networkManager.send({ type: 'joinMatch' })}
            onLeaveMatch={() => {
              if (activeMatch.playMode === 'online') {
                handleLeaveRoom();
              } else {
                setActiveMatch(null);
                setRoute('detail');
              }
            }}
            onLocalMatchEnd={handleLocalMatchEnd}
            onOpenSettings={() => navigate('settings')}
            onOpenControls={() => navigate('controls')}
            onOpenHowTo={() => navigate('howto')}
            onRegisterClient={(c) => {
              gameClientRef.current = c;
            }}
          />
        )}

        {route === 'results' && matchResult && currentGame && (
          <ResultsScreen
            game={currentGame}
            result={matchResult.result}
            playMode={matchResult.playMode}
            room={room}
            selfId={matchResult.playMode === 'online' ? selfId : (lastOfflineLaunchRef.current?.players[0]?.id ?? 'solo_human')}
            onRematchVote={() => {
              if (matchResult.playMode === 'online') {
                networkManager.send({ type: 'rematch' });
              } else if (lastOfflineLaunchRef.current) {
                const l = lastOfflineLaunchRef.current;
                setMatchResult(null);
                startOfflineMatch(l.playMode, l.players, l.settings, l.localPlayers);
              }
            }}
            onBackToLobby={() => networkManager.send({ type: 'backToLobby' })}
            onTakeSeat={() => networkManager.send({ type: 'takeSeat' })}
            onLeave={() => {
              if (matchResult.playMode === 'online') handleLeaveRoom();
              else {
                setMatchResult(null);
                setRoute('hub');
              }
            }}
          />
        )}

        {route === 'profile' && (
          <ProfileScreen
            profile={profile}
            gameId={selectedGameId}
            history={history}
            onSaveProfile={(p) => {
              setProfile(p);
              SettingsStore.saveProfile(p);
              if (room) {
                const dev = SettingsStore.detectDevice();
                networkManager.send({
                  type: 'setProfile',
                  nickname: p.nickname,
                  colorId: p.colorId,
                  iconId: p.iconId,
                  controlStyle: p.controlStyle[dev],
                  device: dev,
                });
              }
            }}
            onResetAll={() => {
              SettingsStore.resetAllData();
              setProfile(SettingsStore.getProfile());
              setSettings(SettingsStore.getSettings());
              setFavorites([]);
              setRecentRooms([]);
              setHistory([]);
              pushToast('All saved data cleared');
            }}
            onBack={() => setRoute(prevRoute === 'profile' ? 'hub' : prevRoute)}
            onToast={(m) => pushToast(m, 'success')}
          />
        )}

        {route === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdate={(next) => {
              setSettings(next);
              SettingsStore.saveSettings(next);
            }}
            onOpenControls={() => navigate('controls')}
            onOpenTouchEditor={() => navigate('touch-editor')}
            onResetAll={() => {
              SettingsStore.resetAllData();
              setProfile(SettingsStore.getProfile());
              setSettings(SettingsStore.getSettings());
              pushToast('All data reset');
            }}
            onBack={() => setRoute(activeMatch ? 'match' : prevRoute === 'settings' ? 'hub' : prevRoute)}
            onToast={(m) => pushToast(m, 'success')}
          />
        )}

        {route === 'controls' && currentGame && (
          <ControlSetupScreen
            game={currentGame}
            profile={profile}
            onSelectStyle={(device: ControlDevice, styleId: string) => {
              const nextProf = {
                ...profile,
                controlStyle: { ...profile.controlStyle, [device]: styleId },
              };
              setProfile(nextProf);
              SettingsStore.saveProfile(nextProf);
              if (activeMatch) {
                setActiveMatch({ ...activeMatch, controlStyle: styleId });
              }
              if (room) {
                networkManager.send({
                  type: 'setProfile',
                  nickname: nextProf.nickname,
                  colorId: nextProf.colorId,
                  iconId: nextProf.iconId,
                  controlStyle: styleId,
                  device,
                });
              }
              pushToast('Control style updated', 'success');
            }}
            onBack={() => setRoute(activeMatch ? 'match' : prevRoute === 'controls' ? 'hub' : prevRoute)}
          />
        )}

        {route === 'touch-editor' && (
          <TouchControlsEditorScreen
            onBack={() => setRoute('settings')}
            onToast={(m) => pushToast(m, 'success')}
          />
        )}

        {route === 'howto' && currentGame && (
          <HowToPlayScreen
            game={currentGame}
            onBack={() => setRoute(activeMatch ? 'match' : 'detail')}
          />
        )}

        {route === 'credits' && <CreditsScreen onBack={() => setRoute('hub')} />}
      </main>

      {/* Mobile Bottom Tab Bar */}
      {route !== 'match' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden arena-glass border-t border-[var(--border)] flex items-center justify-around h-16 px-2">
          <button
            type="button"
            onClick={() => setRoute('hub')}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              route === 'hub' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
            }`}
          >
            <Home size={19} /> Games
          </button>
          <button
            type="button"
            onClick={() => {
              networkManager.send({ type: 'listRooms' });
              setRoute(room ? 'lobby' : 'join-room');
            }}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              route === 'join-room' || route === 'lobby' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
            }`}
          >
            <Users size={19} /> {room ? 'Lobby' : 'Join'}
          </button>
          <button
            type="button"
            onClick={() => navigate('controls')}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              route === 'controls' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
            }`}
          >
            <Sliders size={19} /> Controls
          </button>
          <button
            type="button"
            onClick={() => navigate('profile')}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              route === 'profile' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
            }`}
          >
            <User size={19} /> Profile
          </button>
          <button
            type="button"
            onClick={() => navigate('settings')}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              route === 'settings' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
            }`}
          >
            <Settings size={19} /> Settings
          </button>
        </nav>
      )}

      {/* Welcome Onboarding Modal */}
      <Modal open={welcomeOpen} title="Welcome to Office Arena!">
        <form onSubmit={handleWelcomeSubmit} className="space-y-4">
          <p className="text-sm text-[var(--text-dim)]">
            Jump into Tank Arena or party mini-games with up to 12 friends online, 4 locally on one screen, or solo vs bots.
          </p>
          <div>
            <label className="block text-sm font-bold mb-1">Pick your nickname</label>
            <input
              type="text"
              minLength={1}
              maxLength={14}
              value={welcomeName}
              onChange={(e) => setWelcomeName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-base font-bold"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" className="arena-btn-primary px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2">
              <Gamepad2 size={18} /> Enter Arena
            </button>
          </div>
        </form>
      </Modal>

      {/* System Notice Modal (Kicked / Banned / Room Closed) */}
      <Modal
        open={Boolean(systemBanner)}
        title={systemBanner?.title ?? ''}
        onClose={() => setSystemBanner(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text)]">{systemBanner?.body}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSystemBanner(null)}
              className="arena-btn-primary px-5 py-2.5 rounded-xl font-bold text-sm"
            >
              Back to Games
            </button>
          </div>
        </div>
      </Modal>

      {/* iOS Safari Install Prompt */}
      <Modal open={iosInstallOpen} title="Install Office Arena on iOS" onClose={() => setIosInstallOpen(false)}>
        <div className="space-y-3 text-sm text-[var(--text)]">
          <p>1. Tap the <strong>Share</strong> button in Safari's toolbar.</p>
          <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
          <p>3. Launch Office Arena fullscreen from your Home Screen anytime — including offline Solo matches!</p>
        </div>
      </Modal>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        games={games}
        onOpenGame={(id) => {
          setSelectedGameId(id);
          setRoute('detail');
        }}
        onJoinCode={(code) => handleJoinRoom(code)}
        onQuickJoin={handleQuickJoin}
        onNavigate={(r) => navigate(r as RouteView)}
        onToggleTheme={handleCycleTheme}
      />

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
