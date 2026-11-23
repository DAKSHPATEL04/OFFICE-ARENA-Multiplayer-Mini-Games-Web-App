import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Bot,
  Check,
  Crown,
  DoorOpen,
  Eye,
  Gamepad2,
  Lock,
  Monitor,
  Play,
  Send,
  Settings2,
  Share2,
  Shuffle,
  Sliders,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PLAYER_COLORS, QUICK_CHAT_MESSAGES } from '../../../shared/config.ts';
import type { GameModule } from '../../../shared/GameModule.ts';
import type { RoomOptions, RoomPlayer, RoomSnapshotState, TeamId } from '../../../shared/types.ts';
import { Modal, ProfileIconSvg, ShareInvitePanel, ShapeColorBadge } from '../components/PlayerBadge.tsx';
import { GroupedMapSelector, MapPreviewCard } from '../components/MapSelectorPanel.tsx';

interface LobbyScreenProps {
  game: GameModule;
  room: RoomSnapshotState;
  selfId: string;
  onSendChat: (text: string) => void;
  onToggleReady: () => void;
  onSetTeam: (team: TeamId) => void;
  onMovePlayerTeam: (targetId: string, team: TeamId) => void;
  onShuffleTeams: () => void;
  onAutoBalance: () => void;
  onUpdateSettings: (patch: Record<string, unknown>) => void;
  onUpdateRoomOptions: (patch: Partial<RoomOptions>) => void;
  onStartMatch: (force?: boolean) => void;
  onCancelAutoStart: () => void;
  onTakeSeat: () => void;
  onKick: (id: string) => void;
  onBan: (id: string) => void;
  onTransferHost: (id: string) => void;
  onLeave: () => void;
  onCloseRoom: () => void;
  onOpenControls: () => void;
  onOpenPractice: () => void;
  onToast: (text: string) => void;
}

const DeviceIcon: React.FC<{ device: string }> = ({ device }) => {
  if (device === 'touch') return <Smartphone size={14} className="text-[var(--text-dim)] shrink-0" />;
  if (device === 'pad') return <Gamepad2 size={14} className="text-[var(--text-dim)] shrink-0" />;
  return <Monitor size={14} className="text-[var(--text-dim)] shrink-0" />;
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  game,
  room,
  selfId,
  onSendChat,
  onToggleReady,
  onSetTeam,
  onMovePlayerTeam,
  onShuffleTeams,
  onAutoBalance,
  onUpdateSettings,
  onUpdateRoomOptions,
  onStartMatch,
  onCancelAutoStart,
  onTakeSeat,
  onKick,
  onBan,
  onTransferHost,
  onLeave,
  onCloseRoom,
  onOpenControls,
  onOpenPractice,
  onToast,
}) => {
  const [phoneTab, setPhoneTab] = useState<'players' | 'settings' | 'chat'>('players');
  const [settingGroup, setSettingGroup] = useState<'match' | 'bots' | 'combat' | 'world' | 'controls'>('match');
  const [shareOpen, setShareOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [roomOptOpen, setRoomOptOpen] = useState(false);
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [menuPlayerId, setMenuPlayerId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');

  // Room options editor local state
  const [optName, setOptName] = useState(room.options.name);
  const [optVis, setOptVis] = useState(room.options.visibility);
  const [optMax, setOptMax] = useState(room.options.maxPlayers);
  const [optPassword, setOptPassword] = useState('');
  const [optSpec, setOptSpec] = useState(room.options.allowSpectators);
  const [optLate, setOptLate] = useState(room.options.allowLateJoin);
  const [optStart, setOptStart] = useState(room.options.startRule);

  const selfPlayer = room.players.find((p) => p.id === selfId);
  const isHost = Boolean(selfPlayer?.isHost);
  const isSpectator = Boolean(selfPlayer?.isSpectator);

  const activePlayers = useMemo(() => room.players.filter((p) => !p.isSpectator), [room.players]);
  const spectators = useMemo(() => room.players.filter((p) => p.isSpectator), [room.players]);

  const modeId = String(room.gameSettings.mode ?? game.modes[0]?.id ?? 'flag');
  const activeMode = game.modes.find((m) => m.id === modeId) ?? game.modes[0];
  const isTeamMode = activeMode?.teamType === 'teams';

  const redTeam = activePlayers.filter((p) => p.team === 'red');
  const blueTeam = activePlayers.filter((p) => p.team === 'blue');

  const readyCount = activePlayers.filter((p) => p.isReady || p.isHost || p.isBot).length;
  const unreadyHumans = activePlayers.filter((p) => !p.isBot && !p.isReady && !p.isHost);

  const resolvedMapId = useMemo(() => {
    const rawMap = String(room.gameSettings.map ?? 'auto');
    if (rawMap !== 'auto') return rawMap;
    if (modeId === 'ffa') return 'desert';
    if (modeId === 'team-fight') return activePlayers.length <= 4 ? 'snow' : 'grass';
    return 'lava';
  }, [room.gameSettings.map, modeId, activePlayers.length]);

  const mapDef = game.maps?.find((m) => m.id === resolvedMapId) ?? game.maps?.[0];
  const mapPreviewUrl = game.renderMapPreview?.(resolvedMapId, modeId);

  const autoSummary = game.computeAutoScaleSummary?.(room.gameSettings, activePlayers.length);

  const openRoomOptionsModal = () => {
    setOptName(room.options.name);
    setOptVis(room.options.visibility);
    setOptMax(room.options.maxPlayers);
    setOptPassword('');
    setOptSpec(room.options.allowSpectators);
    setOptLate(room.options.allowLateJoin);
    setOptStart(room.options.startRule);
    setRoomOptOpen(true);
  };

  const handleSaveRoomOptions = (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Partial<RoomOptions> = {
      name: optName,
      visibility: optVis,
      maxPlayers: optMax,
      allowSpectators: optSpec,
      allowLateJoin: optLate,
      startRule: optStart,
    };
    if (optPassword.length > 0) patch.password = optPassword;
    onUpdateRoomOptions(patch);
    setRoomOptOpen(false);
    onToast('Room options updated');
  };

  const handleStartClick = () => {
    if (unreadyHumans.length > 0) {
      setConfirmStartOpen(true);
    } else {
      onStartMatch(false);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;
    onSendChat(clean);
    setChatInput('');
  };

  const renderPlayerRow = (p: RoomPlayer) => {
    const styleObj = game.controlStyles.find((s) => s.id === p.controlStyle);
    const showMenu = menuPlayerId === p.id;
    return (
      <div
        key={p.id}
        className={`relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${
          p.id === selfId
            ? 'bg-[var(--surface-2)] border-[var(--accent)]/60'
            : 'bg-[var(--surface)] border-[var(--border)]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ShapeColorBadge colorId={p.colorId} size={22} />
          <ProfileIconSvg iconId={p.iconId} size={15} className="text-[var(--text-dim)] shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-[var(--text)] truncate">{p.nickname}</span>
              {p.isHost && <Crown size={14} className="text-[var(--gold)] shrink-0" aria-label="Host" />}
              {p.isBot && <Bot size={14} className="text-[var(--accent)] shrink-0" aria-label="Bot" />}
              {p.id === selfId && <span className="text-[11px] font-bold text-[var(--accent)]">(You)</span>}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
              <DeviceIcon device={p.device} />
              <span>{styleObj?.shortLabel ?? 'Arcade'}</span>
              {!p.isBot && <span className="tabular-nums">· {p.pingMs}ms</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {p.isDisconnected ? (
            <span className="text-xs font-bold text-[var(--gold)]">Reconnecting</span>
          ) : p.isHost ? (
            <span className="text-xs font-bold text-[var(--gold)]">Host</span>
          ) : p.isReady ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--success)]">
              <Check size={14} /> Ready
            </span>
          ) : (
            <span className="text-xs font-semibold text-[var(--text-dim)]">Waiting</span>
          )}

          {isHost && p.id !== selfId && !p.isBot && (
            <button
              type="button"
              onClick={() => setMenuPlayerId(showMenu ? null : p.id)}
              className="px-2 py-1 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold text-[var(--text)]"
            >
              •••
            </button>
          )}
        </div>

        {showMenu && isHost && (
          <div className="absolute right-2 top-12 z-30 arena-glass bg-[var(--surface-solid)] rounded-xl p-1.5 w-44 shadow-2xl border border-[var(--border)] flex flex-col gap-1">
            {isTeamMode && (
              <button
                type="button"
                onClick={() => {
                  onMovePlayerTeam(p.id, p.team === 'red' ? 'blue' : 'red');
                  setMenuPlayerId(null);
                }}
                className="px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] text-left text-xs font-bold flex items-center gap-2"
              >
                <ArrowLeftRight size={14} /> Move to {p.team === 'red' ? 'Blue' : 'Red'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onTransferHost(p.id);
                setMenuPlayerId(null);
              }}
              className="px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] text-left text-xs font-bold flex items-center gap-2"
            >
              <Crown size={14} className="text-[var(--gold)]" /> Make Host
            </button>
            <button
              type="button"
              onClick={() => {
                onKick(p.id);
                setMenuPlayerId(null);
              }}
              className="px-3 py-2 rounded-lg hover:bg-[#FF4D6D]/20 text-left text-xs font-bold text-[#FF4D6D]"
            >
              Kick Player
            </button>
            <button
              type="button"
              onClick={() => {
                onBan(p.id);
                setMenuPlayerId(null);
              }}
              className="px-3 py-2 rounded-lg hover:bg-[#FF4D6D]/30 text-left text-xs font-bold text-[#FF4D6D]"
            >
              Ban from Room
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderEmptySlot = (idx: number) => (
    <button
      key={`empty-${idx}`}
      type="button"
      onClick={() => setShareOpen(true)}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)]/60 hover:bg-[var(--surface)] transition-colors text-left"
    >
      <span className="text-xs text-[var(--text-dim)]">Waiting for a friend…</span>
      <span className="text-xs font-bold text-[var(--accent)] inline-flex items-center gap-1 whitespace-nowrap">
        <UserPlus size={13} /> Invite
      </span>
    </button>
  );

  const visibleSettings = game.settingsSchema.filter(
    (s) => s.group === settingGroup && (!s.visibleWhen || s.visibleWhen(room.gameSettings)),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Room Header Strip */}
      <div className="arena-glass rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onLeave}
            className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <ArrowLeft size={16} /> Leave
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] truncate">{room.options.name}</h1>
              {room.options.password && <Lock size={15} className="text-[var(--gold)] shrink-0" />}
            </div>
            <div className="text-xs sm:text-sm text-[var(--text-dim)] tabular-nums">
              {game.meta.name} · {room.options.visibility === 'open' ? 'Open Room' : 'Private Room'} ·{' '}
              {activePlayers.length}/{room.options.maxPlayers} players
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:brightness-110 border border-[var(--accent)]/40 inline-flex items-center gap-2.5 whitespace-nowrap"
          >
            <span className="text-xs uppercase font-bold text-[var(--text-dim)]">Code</span>
            <span className="text-lg font-display font-bold tracking-[0.18em] text-[var(--accent)] tabular-nums">
              {room.code}
            </span>
            <Share2 size={16} className="text-[var(--text)]" />
          </button>

          {isHost && (
            <button
              type="button"
              onClick={openRoomOptionsModal}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Settings2 size={16} /> Room Options
            </button>
          )}
        </div>
      </div>

      {/* Auto-Start Countdown Banner */}
      {room.autoStartRemainingSec !== null && (
        <div className="arena-glass rounded-2xl px-5 py-3.5 border border-[var(--accent)] flex flex-wrap items-center justify-between gap-3">
          <span className="font-bold text-[var(--text)] tabular-nums">
            Everyone is ready! Match starting in {room.autoStartRemainingSec}s…
          </span>
          {isHost && (
            <button
              type="button"
              onClick={onCancelAutoStart}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-2)] text-sm font-bold text-[var(--danger)]"
            >
              Cancel Auto-Start
            </button>
          )}
        </div>
      )}

      {/* Mobile Tabs */}
      <div className="flex lg:hidden items-center gap-1 p-1 rounded-xl bg-[var(--surface)]">
        {(['players', 'settings', 'chat'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPhoneTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize ${
              phoneTab === t ? 'arena-btn-primary text-white' : 'text-[var(--text-dim)]'
            }`}
          >
            {t === 'players' ? `Players (${activePlayers.length})` : t === 'settings' ? 'Game & Map' : 'Chat'}
          </button>
        ))}
      </div>

      {/* Main 3-Column Desktop Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Players & Teams (5 cols) */}
        <section className={`lg:col-span-5 space-y-4 ${phoneTab === 'players' ? 'block' : 'hidden lg:block'}`}>
          <div className="arena-glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
                <Users size={18} className="text-[var(--accent)]" />
                {isTeamMode ? 'Teams (up to 6v6)' : `Players (${activePlayers.length}/${room.options.maxPlayers})`}
              </h2>
              {isTeamMode && isHost && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onShuffleTeams}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Shuffle size={13} /> Shuffle
                  </button>
                  <button
                    type="button"
                    onClick={onAutoBalance}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold"
                  >
                    Balance
                  </button>
                </div>
              )}
            </div>

            {isTeamMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Red Team */}
                <div className="rounded-xl p-3 bg-[#F23A12]/10 border border-[#F23A12]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#FF6B4A]">Red Team ({redTeam.length})</span>
                    {!isSpectator && selfPlayer?.team !== 'red' && (
                      <button
                        type="button"
                        onClick={() => onSetTeam('red')}
                        className="px-2.5 py-1 rounded-lg bg-[#F23A12]/25 hover:bg-[#F23A12]/40 text-xs font-bold text-white"
                      >
                        Join Red
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {redTeam.map(renderPlayerRow)}
                    {redTeam.length < Math.ceil(room.options.maxPlayers / 2) && renderEmptySlot(0)}
                  </div>
                </div>

                {/* Blue Team */}
                <div className="rounded-xl p-3 bg-[#3F6FE0]/10 border border-[#3F6FE0]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#6E97FF]">Blue Team ({blueTeam.length})</span>
                    {!isSpectator && selfPlayer?.team !== 'blue' && (
                      <button
                        type="button"
                        onClick={() => onSetTeam('blue')}
                        className="px-2.5 py-1 rounded-lg bg-[#3F6FE0]/25 hover:bg-[#3F6FE0]/40 text-xs font-bold text-white"
                      >
                        Join Blue
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {blueTeam.map(renderPlayerRow)}
                    {blueTeam.length < Math.floor(room.options.maxPlayers / 2) && renderEmptySlot(1)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activePlayers.map(renderPlayerRow)}
                {activePlayers.length < room.options.maxPlayers && renderEmptySlot(99)}
              </div>
            )}

            {/* Spectators */}
            {room.options.allowSpectators && (
              <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-[var(--text-dim)] flex items-center gap-1.5">
                  <Eye size={14} />
                  <span>
                    Spectators ({spectators.length}):{' '}
                    {spectators.length > 0 ? spectators.map((s) => s.nickname).join(', ') : 'None'}
                  </span>
                </div>
                {isSpectator && activePlayers.length < room.options.maxPlayers && (
                  <button
                    type="button"
                    onClick={onTakeSeat}
                    className="px-3 py-1.5 rounded-lg arena-btn-primary text-xs font-bold inline-flex items-center gap-1"
                  >
                    <UserCheck size={13} /> Take a Seat
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Controls & Practice quick bar */}
          <div className="arena-glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--text-dim)]">
              Your controls:{' '}
              <span className="font-bold text-[var(--text)]">
                {game.controlStyles.find((s) => s.id === selfPlayer?.controlStyle)?.name ?? 'Arcade'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenPractice}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold"
              >
                Practice Range
              </button>
              <button
                type="button"
                onClick={onOpenControls}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold inline-flex items-center gap-1"
              >
                <Sliders size={13} /> Controls
              </button>
            </div>
          </div>
        </section>

        {/* Column 2: Map Preview + Settings Form (4 cols) */}
        <section className={`lg:col-span-4 space-y-4 ${phoneTab === 'settings' ? 'block' : 'hidden lg:block'}`}>
          {/* Live Map Preview */}
          <MapPreviewCard
            map={mapDef}
            resolvedMapId={resolvedMapId}
            previewUrl={mapPreviewUrl}
            modeName={activeMode?.name}
            modes={game.modes}
            footerText={autoSummary}
            actionSlot={
              isHost && game.maps && game.maps.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setMapPickerOpen(true)}
                  className="px-2.5 py-1 rounded-lg arena-btn-primary text-white text-[11px] font-bold whitespace-nowrap"
                >
                  Pick Map
                </button>
              ) : undefined
            }
          />

          {/* Game Presets & Settings */}
          <div className="arena-glass rounded-2xl p-4 space-y-4">
            {game.presets && game.presets.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">Presets</div>
                <div className="flex flex-wrap gap-1.5">
                  {game.presets.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => onUpdateSettings(pr.values)}
                      title={pr.description}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] hover:brightness-110 text-xs font-bold disabled:opacity-60"
                    >
                      {pr.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Setting Group Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface)] overflow-x-auto">
              {(['match', 'bots', 'combat', 'world', 'controls'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSettingGroup(g)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap ${
                    settingGroup === g ? 'arena-btn-primary text-white' : 'text-[var(--text-dim)]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Settings List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {visibleSettings.map((def) => {
                const val = room.gameSettings[def.key] ?? def.defaultValue;
                if (def.key === 'damagePct') {
                  const pct = Number(val);
                  const hits = Math.ceil(100 / Math.max(10, pct));
                  return (
                    <div key={def.key} className="py-2 space-y-2 border-b border-[var(--border)]/60">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <label className="text-sm font-semibold text-[var(--text)]">{def.label}</label>
                          <div className="text-[11px] text-[var(--text-dim)] tabular-nums">
                            {hits} {hits === 1 ? 'hit' : 'hits'} to destroy
                          </div>
                        </div>
                        <input
                          type="number"
                          disabled={!isHost}
                          value={pct}
                          min={def.min}
                          max={def.max}
                          step={def.step ?? 5}
                          onChange={(e) => onUpdateSettings({ damagePct: Number(e.target.value) })}
                          className="w-20 px-2.5 py-1 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-bold text-right tabular-nums disabled:opacity-60"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[25, 35, 50, 100].map((presetPct) => (
                          <button
                            key={presetPct}
                            type="button"
                            disabled={!isHost}
                            onClick={() => onUpdateSettings({ damagePct: presetPct })}
                            className={`py-1 rounded-lg text-[11px] font-bold tabular-nums disabled:opacity-60 ${
                              pct === presetPct ? 'arena-btn-primary text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
                            }`}
                          >
                            {presetPct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={def.key} className="flex items-center justify-between gap-3 py-1">
                    <label className="text-sm font-semibold text-[var(--text)]">{def.label}</label>
                    {def.type === 'select' && def.options && (
                      <select
                        disabled={!isHost}
                        value={String(val)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const matched = def.options?.find((o) => String(o.value) === raw);
                          onUpdateSettings({ [def.key]: matched ? matched.value : raw });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-semibold text-[var(--text)] disabled:opacity-60 max-w-[180px]"
                      >
                        {def.options.map((opt) => (
                          <option key={String(opt.value)} value={String(opt.value)}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {def.type === 'number' && (
                      <input
                        type="number"
                        disabled={!isHost}
                        value={Number(val)}
                        min={def.min}
                        max={def.max}
                        step={def.step ?? 1}
                        onChange={(e) => onUpdateSettings({ [def.key]: Number(e.target.value) })}
                        className="w-24 px-2.5 py-1.5 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-sm font-bold text-right tabular-nums disabled:opacity-60"
                      />
                    )}
                    {def.type === 'boolean' && (
                      <button
                        type="button"
                        disabled={!isHost}
                        onClick={() => onUpdateSettings({ [def.key]: !val })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-60 ${
                          val ? 'bg-[var(--success)]/25 text-[var(--success)]' : 'bg-[var(--surface-2)] text-[var(--text-dim)]'
                        }`}
                      >
                        {val ? 'On' : 'Off'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Column 3: Chat + Action Buttons (3 cols) */}
        <section className={`lg:col-span-3 space-y-4 ${phoneTab === 'chat' ? 'block' : 'hidden lg:block'}`}>
          <div className="arena-glass rounded-2xl p-4 flex flex-col h-80">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-dim)] mb-2">Room Chat</h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-sm">
              {room.chat.length === 0 ? (
                <div className="text-xs text-[var(--text-dim)] py-4 text-center">Say hello or tap a quick message below.</div>
              ) : (
                room.chat.map((c) => (
                  <div key={c.id} className="leading-snug">
                    <span className="font-bold mr-1.5" style={{ color: c.senderColor }}>
                      {c.senderName}:
                    </span>
                    <span className="text-[var(--text)] break-words">{c.text}</span>
                  </div>
                ))
              )}
            </div>

            {!isSpectator && (
              <>
                <div className="flex flex-wrap gap-1 pt-2 pb-2 border-t border-[var(--border)]">
                  {QUICK_CHAT_MESSAGES.map((qm) => (
                    <button
                      key={qm}
                      type="button"
                      onClick={() => onSendChat(qm)}
                      className="px-2 py-1 rounded-md bg-[var(--surface-2)] hover:brightness-110 text-xs font-semibold text-[var(--text)]"
                    >
                      {qm}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleSendChat} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={80}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message room..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm text-[var(--text)]"
                  />
                  <button
                    type="submit"
                    aria-label="Send chat"
                    className="p-2.5 rounded-xl arena-btn-primary text-white shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="arena-glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-[var(--text)] tabular-nums">
            Ready: {readyCount}/{activePlayers.length}
          </span>
          {!isHost && (
            <span className="text-xs text-[var(--text-dim)]">Waiting for host to start the match</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isSpectator && (
            <button
              type="button"
              onClick={onToggleReady}
              className={`px-5 py-3 rounded-xl font-bold inline-flex items-center gap-2 whitespace-nowrap ${
                selfPlayer?.isReady
                  ? 'bg-[var(--success)]/25 border border-[var(--success)] text-[var(--success)]'
                  : 'bg-[var(--surface-2)] hover:brightness-110 text-[var(--text)]'
              }`}
            >
              <Check size={18} />
              {selfPlayer?.isReady ? 'Ready!' : 'Mark Ready'}
            </button>
          )}

          {isHost && (
            <>
              <button
                type="button"
                onClick={handleStartClick}
                className="arena-btn-primary px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Play size={18} /> Start Match ({readyCount}/{activePlayers.length})
              </button>
              <button
                type="button"
                onClick={onCloseRoom}
                className="px-4 py-3 rounded-xl bg-[#FF4D6D]/15 hover:bg-[#FF4D6D]/25 text-[#FF4D6D] font-bold text-sm inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <DoorOpen size={16} /> Close Room
              </button>
            </>
          )}
        </div>
      </div>

      {/* Share Invite Modal */}
      <Modal open={shareOpen} title="Invite Players" onClose={() => setShareOpen(false)}>
        <ShareInvitePanel code={room.code} gameName={game.meta.name} bigQr onCopied={onToast} />
      </Modal>

      {/* Visual Map Picker Modal */}
      <Modal open={mapPickerOpen} title={`Select Arena Map (${activeMode?.name ?? 'All Modes'})`} onClose={() => setMapPickerOpen(false)}>
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-dim)]">
            Every map works in Flag, Team Fight, and Free For All. Click any arena below to apply immediately.
          </p>
          <div className="max-h-[62vh] overflow-y-auto pr-1">
            {game.maps && (
              <GroupedMapSelector
                maps={game.maps}
                selectedMapId={String(room.gameSettings.map ?? 'auto')}
                modeId={modeId}
                renderMapPreview={game.renderMapPreview}
                onSelect={(id) => {
                  onUpdateSettings({ map: id });
                  setMapPickerOpen(false);
                }}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Start Anyway Confirmation Modal */}
      <Modal open={confirmStartOpen} title="Some players are not ready" onClose={() => setConfirmStartOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-dim)]">
            {unreadyHumans.map((u) => u.nickname).join(', ')}{' '}
            {unreadyHumans.length === 1 ? 'is' : 'are'} not ready yet. Starting now will let them watch this round as spectators and return to their seats afterward.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmStartOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] font-bold text-sm"
            >
              Wait
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmStartOpen(false);
                onStartMatch(true);
              }}
              className="arena-btn-primary px-5 py-2.5 rounded-xl font-bold text-sm"
            >
              Start Anyway
            </button>
          </div>
        </div>
      </Modal>

      {/* Host Room Options Modal */}
      <Modal open={roomOptOpen} title="Room Options" onClose={() => setRoomOptOpen(false)}>
        <form onSubmit={handleSaveRoomOptions} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Room Name</label>
            <input
              type="text"
              maxLength={24}
              value={optName}
              onChange={(e) => setOptName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Visibility</label>
              <select
                value={optVis}
                onChange={(e) => setOptVis(e.target.value as 'private' | 'open')}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-solid)] border border-[var(--border)] text-sm"
              >
                <option value="private">Private</option>
                <option value="open">Open</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Max Players</label>
              <input
                type="number"
                min={Math.max(game.meta.minPlayers, activePlayers.length)}
                max={game.meta.maxPlayers}
                value={optMax}
                onChange={(e) => setOptMax(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">New Password (leave blank to keep)</label>
            <input
              type="password"
              maxLength={12}
              value={optPassword}
              onChange={(e) => setOptPassword(e.target.value)}
              placeholder="4–12 characters"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm"
            />
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between gap-2">
              <span className="font-semibold">Allow Spectators</span>
              <input type="checkbox" checked={optSpec} onChange={(e) => setOptSpec(e.target.checked)} className="w-4 h-4" />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="font-semibold">Allow Late Join</span>
              <input type="checkbox" checked={optLate} onChange={(e) => setOptLate(e.target.checked)} className="w-4 h-4" />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="font-semibold">Start Rule</span>
              <select
                value={optStart}
                onChange={(e) => setOptStart(e.target.value as 'host' | 'auto')}
                className="px-2.5 py-1 rounded-lg bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-bold"
              >
                <option value="host">Host Clicks Start</option>
                <option value="auto">Auto-Start When All Ready</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRoomOptOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] font-bold text-sm inline-flex items-center gap-1"
            >
              <X size={15} /> Cancel
            </button>
            <button type="submit" className="arena-btn-primary px-5 py-2.5 rounded-xl font-bold text-sm">
              Save Options
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
