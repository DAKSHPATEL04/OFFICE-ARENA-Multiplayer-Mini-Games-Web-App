import type {
  ChatMessage,
  ControlDevice,
  MatchResult,
  RoomOptions,
  RoomPhase,
  RoomSnapshotState,
  RoomSummary,
  TeamId,
} from './types.ts';

export type ClientMessage =
  | { type: 'listGames' }
  | { type: 'listRooms' }
  | { type: 'quickJoin'; gameId: string }
  | {
      type: 'createRoom';
      gameId: string;
      options: Partial<RoomOptions>;
      gameSettings?: Record<string, unknown>;
      profile?: ClientProfilePayload;
    }
  | { type: 'joinRoom'; code: string; password?: string; asSpectator?: boolean; playerToken?: string; profile?: ClientProfilePayload }
  | { type: 'leaveRoom' }
  | { type: 'closeRoom' }
  | { type: 'setRoomOptions'; options: Partial<RoomOptions> }
  | { type: 'setProfile'; nickname: string; colorId: string; iconId: string; controlStyle: string; device: ControlDevice }
  | { type: 'setTeam'; team: TeamId }
  | { type: 'movePlayerTeam'; targetId: string; team: TeamId }
  | { type: 'shuffleTeams' }
  | { type: 'autoBalanceTeams' }
  | { type: 'setReady'; ready: boolean }
  | { type: 'setAway'; away: boolean }
  | { type: 'hostSettings'; settings: Record<string, unknown> }
  | { type: 'startMatch'; force?: boolean }
  | { type: 'cancelAutoStart' }
  | { type: 'loaded' }
  | { type: 'takeSeat' }
  | { type: 'joinMatch' }
  | { type: 'kick'; id: string }
  | { type: 'ban'; id: string }
  | { type: 'transferHost'; id: string }
  | { type: 'input'; t: number; payload: unknown }
  | { type: 'chat'; text: string }
  | { type: 'rematch' }
  | { type: 'backToLobby' }
  | { type: 'vote'; value: string }
  | { type: 'ping'; t: number };

export interface ClientProfilePayload {
  nickname: string;
  colorId: string;
  iconId: string;
  controlStyle: string;
  device: ControlDevice;
}

export type ServerMessage =
  | { type: 'games'; games: Array<{ id: string; name: string }> }
  | { type: 'rooms'; rooms: RoomSummary[] }
  | {
      type: 'roomJoined';
      playerId: string;
      playerToken: string;
      room: RoomSnapshotState;
      isSpectator: boolean;
    }
  | { type: 'roomUpdate'; room: RoomSnapshotState }
  | { type: 'chatMessage'; message: ChatMessage }
  | { type: 'toast'; level: 'info' | 'success' | 'warning' | 'error'; text: string }
  | { type: 'loading'; mapId: string; modeId: string; settings: Record<string, unknown>; seed: number }
  | { type: 'countdown'; sec: number }
  | {
      type: 'matchStart';
      mapId: string;
      seed: number;
      settings: Record<string, unknown>;
      styles: Record<string, string>;
      phase: RoomPhase;
      serverTime: number;
    }
  | { type: 'snapshot'; t: number; serverTime: number; payload: unknown }
  | { type: 'event'; t: number; payload: unknown }
  | { type: 'matchEnd'; result: MatchResult }
  | { type: 'roomClosed'; reason: string }
  | { type: 'kicked'; reason: string; banned?: boolean }
  | { type: 'error'; code: string; message: string; canSpectate?: boolean; needsPassword?: boolean; retryAfterSec?: number }
  | { type: 'pong'; t: number; serverTime: number };
