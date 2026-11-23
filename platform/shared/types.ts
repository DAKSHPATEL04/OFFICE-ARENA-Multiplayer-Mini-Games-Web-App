export type ControlDevice = 'pc' | 'touch' | 'pad';

export type PlayModeType = 'online' | 'local-party' | 'solo';

export type RoomVisibility = 'private' | 'open';

export type StartRule = 'host' | 'auto';

export type RoomPhase = 'LOBBY' | 'LOADING' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS';

export type PresenceState = 'ready' | 'not-ready' | 'away' | 'disconnected' | 'spectating';

export type TeamId = 'red' | 'blue' | 'ffa';

export interface PlayerProfile {
  nickname: string;
  colorId: string;
  iconId: string;
  controlStyle: Record<ControlDevice, string>;
}

export interface RoomOptions {
  name: string;
  visibility: RoomVisibility;
  password: string;
  maxPlayers: number;
  allowSpectators: boolean;
  allowLateJoin: boolean;
  startRule: StartRule;
}

export interface RoomPlayer {
  id: string;
  nickname: string;
  colorId: string;
  iconId: string;
  team: TeamId;
  isHost: boolean;
  isBot: boolean;
  botDifficulty?: string;
  isSpectator: boolean;
  isReady: boolean;
  isAway: boolean;
  isDisconnected: boolean;
  disconnectExpiresAt?: number;
  controlStyle: string;
  device: ControlDevice;
  pingMs: number;
  rematchVoted: boolean;
  joinedAt: number;
  watchingThisMatch?: boolean;
}

export interface RoomSummary {
  code: string;
  name: string;
  gameId: string;
  gameName: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  spectators: number;
  status: RoomPhase;
  hasPassword: boolean;
  allowSpectators: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoomSnapshotState {
  code: string;
  gameId: string;
  phase: RoomPhase;
  options: RoomOptions;
  players: RoomPlayer[];
  gameSettings: Record<string, unknown>;
  chat: ChatMessage[];
  autoStartRemainingSec: number | null;
  countdownRemainingSec: number | null;
  matchStartedAt: number | null;
  serverTime: number;
  lateJoinAllowed: boolean;
}

export interface PlayerMatchStat {
  playerId: string;
  nickname: string;
  colorId: string;
  team: TeamId;
  isBot: boolean;
  leftEarly?: boolean;
  points: number;
  deaths: number;
  shotsFired: number;
  hits: number;
  accuracy: number;
  flagsPicked: number;
  captures: number;
  returns: number;
  powersCollected: number;
  pingMs: number;
  mvpScore: number;
}

export interface MatchAward {
  id: string;
  title: string;
  playerId: string;
  nickname: string;
  detail: string;
}

export interface MatchResult {
  winnerTeam: TeamId | 'draw';
  winnerLabel: string;
  durationSec: number;
  teamScores: { red: number; blue: number };
  stats: PlayerMatchStat[];
  awards: MatchAward[];
}

export interface RecentRoomEntry {
  code: string;
  name: string;
  gameId: string;
  gameName: string;
  lastVisitedAt: number;
}

export interface MatchHistoryEntry {
  id: string;
  gameId: string;
  modeId: string;
  mapId: string;
  playedAt: number;
  durationSec: number;
  winnerLabel: string;
  myPoints: number;
  myDeaths: number;
  won: boolean;
}

export interface GameStatsRecord {
  matches: number;
  wins: number;
  points: number;
  captures: number;
  deaths: number;
}
