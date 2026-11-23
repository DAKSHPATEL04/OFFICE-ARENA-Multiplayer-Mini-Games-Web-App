import React from 'react';
import { Award, Check, DoorOpen, RotateCcw, Trophy, UserCheck, Users } from 'lucide-react';
import type { GameModule } from '../../../shared/GameModule.ts';
import type { MatchResult, PlayModeType, RoomSnapshotState } from '../../../shared/types.ts';
import { ShapeColorBadge } from '../components/PlayerBadge.tsx';

export const ResultsScreen: React.FC<{
  game: GameModule;
  result: MatchResult;
  playMode: PlayModeType;
  room: RoomSnapshotState | null;
  selfId: string;
  onRematchVote: () => void;
  onBackToLobby: () => void;
  onTakeSeat: () => void;
  onLeave: () => void;
}> = ({
  game,
  result,
  playMode,
  room,
  selfId,
  onRematchVote,
  onBackToLobby,
  onTakeSeat,
  onLeave,
}) => {
  const selfMember = room?.players.find((p) => p.id === selfId);
  const isHost = Boolean(selfMember?.isHost);
  const isSpectator = Boolean(selfMember?.isSpectator);
  const humanPlayers = room?.players.filter((p) => !p.isBot && !p.isSpectator) ?? [];
  const votedCount = humanPlayers.filter((p) => p.rematchVoted).length;

  const bannerGradient =
    result.winnerTeam === 'red'
      ? 'from-[#F23A12]/35 to-transparent border-[#F23A12]/60'
      : result.winnerTeam === 'blue'
        ? 'from-[#3F6FE0]/35 to-transparent border-[#3F6FE0]/60'
        : 'from-[#7C5CFF]/35 to-transparent border-[#00E5C3]/60';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Winner Banner */}
      <section className={`arena-glass bg-gradient-to-br ${bannerGradient} rounded-3xl p-8 text-center space-y-3`}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--gold)]/20 text-[var(--gold)] mb-1">
          <Trophy size={32} />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-[var(--text)]">{result.winnerLabel}</h1>
        <div className="text-sm sm:text-base font-semibold text-[var(--text-dim)] tabular-nums">
          {result.winnerTeam !== 'ffa' && (
            <span className="mr-3">
              Score: <strong className="text-[#FF6B4A]">{result.teamScores.red}</strong> –{' '}
              <strong className="text-[#6E97FF]">{result.teamScores.blue}</strong> ·
            </span>
          )}
          Duration: {Math.floor(result.durationSec / 60)}m {result.durationSec % 60}s
        </div>
      </section>

      {/* Awards */}
      {result.awards.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {result.awards.map((aw) => (
            <div key={aw.id} className="arena-glass rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/15 text-[var(--gold)] flex items-center justify-center shrink-0">
                <Award size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase text-[var(--gold)]">{aw.title}</div>
                <div className="font-bold text-[var(--text)] truncate">{aw.nickname}</div>
                <div className="text-xs text-[var(--text-dim)]">{aw.detail}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Scoreboard Table */}
      <section className="arena-glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
            <Users size={18} className="text-[var(--accent)]" /> Match Scoreboard
          </h2>
          <span className="text-xs text-[var(--text-dim)]">{game.meta.name}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase text-[var(--text-dim)] border-b border-[var(--border)]">
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-3">Team</th>
                <th className="py-3 px-3 text-right">Points</th>
                <th className="py-3 px-3 text-right">Deaths</th>
                <th className="py-3 px-3 text-right">Accuracy</th>
                <th className="py-3 px-4 text-right">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              {result.stats.map((st, idx) => (
                <tr key={st.playerId} className={st.playerId === selfId ? 'bg-[var(--surface-2)]' : ''}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono text-[var(--text-dim)] w-4 tabular-nums">#{idx + 1}</span>
                      <ShapeColorBadge colorId={st.colorId} size={18} />
                      <span className="font-bold text-[var(--text)]">{st.nickname}</span>
                      {st.isBot && <span className="text-[11px] text-[var(--text-dim)]">Bot</span>}
                      {st.leftEarly && <span className="text-[11px] text-[#FF4D6D]">(Left)</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs font-bold capitalize">
                    <span
                      className={
                        st.team === 'red'
                          ? 'text-[#FF6B4A]'
                          : st.team === 'blue'
                            ? 'text-[#6E97FF]'
                            : 'text-[var(--text-dim)]'
                      }
                    >
                      {st.team}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums">{st.points}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[var(--text-dim)]">{st.deaths}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[var(--text-dim)]">{st.accuracy}%</td>
                  <td className="py-3 px-4 text-right tabular-nums">{st.captures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="arena-glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onLeave}
          className="px-5 py-3 rounded-xl bg-[var(--surface-2)] hover:brightness-110 font-bold text-sm inline-flex items-center gap-2"
        >
          <DoorOpen size={17} /> Leave to Hub
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {playMode === 'online' ? (
            <>
              {isSpectator ? (
                <button
                  type="button"
                  onClick={onTakeSeat}
                  className="arena-btn-primary px-6 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2"
                >
                  <UserCheck size={17} /> Take a Seat
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRematchVote}
                  className={`px-6 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2 ${
                    selfMember?.rematchVoted
                      ? 'bg-[var(--success)]/25 border border-[var(--success)] text-[var(--success)]'
                      : 'arena-btn-primary text-white'
                  }`}
                >
                  <Check size={17} /> Play Again ({votedCount}/{humanPlayers.length})
                </button>
              )}

              {isHost && (
                <button
                  type="button"
                  onClick={onBackToLobby}
                  className="px-5 py-3 rounded-xl bg-[var(--surface-2)] hover:brightness-110 font-bold text-sm"
                >
                  Back to Lobby
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onRematchVote}
              className="arena-btn-primary px-6 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2"
            >
              <RotateCcw size={17} /> Play Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
