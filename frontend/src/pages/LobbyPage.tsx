import { useState, useEffect, useCallback } from 'react';
import { Session } from '@heroiclabs/nakama-js';
import { MatchInfo, LeaderboardRecord, PlayerStats } from '../types/game';

interface Props {
  session: Session;
  onJoinMatch: (matchId: string) => void;
  sendRpc: (rpcId: string, payload: object) => Promise<any>;
  addToMatchmaker: (timedMode: boolean) => Promise<any>;
  removeFromMatchmaker: (ticket: string) => Promise<void>;
  onError: (msg: string) => void;
}

type Tab = 'play' | 'leaderboard' | 'stats';

export default function LobbyPage({
  session,
  onJoinMatch,
  sendRpc,
  addToMatchmaker,
  removeFromMatchmaker,
  onError,
}: Props) {
  const [tab, setTab] = useState<Tab>('play');
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [matchmakingTicket, setMatchmakingTicket] = useState<string | null>(null);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [timedMode, setTimedMode] = useState(false);
  const [joinMatchId, setJoinMatchId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      const result = await sendRpc('find_matches', {});
      setMatches(result?.matches || []);
    } catch (e) {}
  }, [sendRpc]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const result = await sendRpc('get_leaderboard', { leaderboardId: 'tictactoe_wins', limit: 20 });
      setLeaderboard(result?.records || []);
    } catch (e) {}
  }, [sendRpc]);

  const loadPlayerStats = useCallback(async () => {
    try {
      const result = await sendRpc('get_player_stats', {});
      setPlayerStats(result);
    } catch (e) {}
  }, [sendRpc]);

  useEffect(() => {
    loadMatches();
    loadPlayerStats();
    const interval = setInterval(loadMatches, 5000);
    return () => clearInterval(interval);
  }, [loadMatches, loadPlayerStats]);

  useEffect(() => {
    if (tab === 'leaderboard') loadLeaderboard();
  }, [tab, loadLeaderboard]);

  const handleCreateMatch = async () => {
    setIsLoading(true);
    try {
      const result = await sendRpc('create_match', { timedMode });
      await onJoinMatch(result.matchId);
    } catch (e: any) {
      onError(e.message || 'Failed to create match');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickMatch = async () => {
    setIsLoading(true);
    try {
      const ticket = await addToMatchmaker(timedMode);
      setMatchmakingTicket(ticket.ticket);
      setIsMatchmaking(true);
    } catch (e: any) {
      onError(e.message || 'Failed to start matchmaking');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelMatchmaking = async () => {
    if (matchmakingTicket) {
      await removeFromMatchmaker(matchmakingTicket);
      setMatchmakingTicket(null);
    }
    setIsMatchmaking(false);
  };

  const handleJoinById = async () => {
    if (!joinMatchId.trim()) return;
    try {
      await onJoinMatch(joinMatchId.trim());
    } catch (e: any) {
      onError(e.message || 'Failed to join match');
    }
  };

  if (isMatchmaking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-sm w-full">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-900 mb-4">
              <svg className="animate-spin h-10 w-10 text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Finding Match...</h2>
            <p className="text-slate-400 mt-2">Searching for an opponent{timedMode ? ' (Timed Mode)' : ''}</p>
          </div>
          <button onClick={handleCancelMatchmaking} className="btn-secondary w-full">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold">TicTacToe</h1>
          <p className="text-slate-400 text-sm">Hey, {session.username}!</p>
        </div>
        {playerStats && (
          <div className="text-right">
            <div className="text-green-400 font-bold">{playerStats.wins}W</div>
            <div className="text-slate-400 text-xs">{playerStats.losses}L · {playerStats.draws}D</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
        {(['play', 'leaderboard', 'stats'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Play Tab */}
      {tab === 'play' && (
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="card flex items-center justify-between">
            <div>
              <div className="font-semibold">Timed Mode</div>
              <div className="text-slate-400 text-sm">30 seconds per turn</div>
            </div>
            <button
              onClick={() => setTimedMode(!timedMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${timedMode ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${timedMode ? 'translate-x-7' : 'translate-x-1'}`}/>
            </button>
          </div>

          {/* Quick Match */}
          <button onClick={handleQuickMatch} disabled={isLoading} className="btn-primary w-full py-4 text-lg">
            🎮 Quick Match
          </button>

          {/* Create Match */}
          <button onClick={handleCreateMatch} disabled={isLoading} className="btn-secondary w-full py-3">
            + Create Private Match
          </button>

          {/* Join by ID */}
          <div className="card">
            <p className="text-sm font-medium text-slate-300 mb-2">Join by Match ID</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinMatchId}
                onChange={e => setJoinMatchId(e.target.value)}
                placeholder="Paste match ID..."
                className="flex-1 bg-slate-700 text-white placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleJoinById} className="btn-primary px-4">Join</button>
            </div>
          </div>

          {/* Open Matches */}
          {matches.length > 0 && (
            <div className="card">
              <div className="flex justify-between items-center mb-3">
                <p className="font-semibold">Open Matches</p>
                <button onClick={loadMatches} className="text-slate-400 hover:text-white text-sm">Refresh</button>
              </div>
              <div className="space-y-2">
                {matches.map(m => (
                  <div
                    key={m.matchId}
                    className="flex items-center justify-between bg-slate-700 rounded-lg p-3"
                  >
                    <div>
                      <div className="text-sm font-mono text-slate-300">{m.matchId.slice(0, 16)}...</div>
                      <div className="text-xs text-slate-400">
                        {m.size}/2 players · {m.label?.timedMode ? '⏱ Timed' : 'Classic'}
                      </div>
                    </div>
                    <button
                      onClick={() => onJoinMatch(m.matchId)}
                      className="btn-primary text-sm py-1 px-3"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">🏆 Top Players</h2>
          {leaderboard.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No records yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((r, i) => (
                <div
                  key={r.userId}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    r.userId === session.user_id ? 'bg-blue-900/50 border border-blue-700' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    i === 0 ? 'bg-yellow-500 text-yellow-900' :
                    i === 1 ? 'bg-slate-400 text-slate-900' :
                    i === 2 ? 'bg-amber-700 text-amber-100' :
                    'bg-slate-600 text-white'
                  }`}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : r.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{r.username}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-400">{r.score} wins</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {playerStats ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="card text-center">
                  <div className="text-2xl font-bold text-green-400">{playerStats.wins}</div>
                  <div className="text-slate-400 text-xs mt-1">Wins</div>
                </div>
                <div className="card text-center">
                  <div className="text-2xl font-bold text-red-400">{playerStats.losses}</div>
                  <div className="text-slate-400 text-xs mt-1">Losses</div>
                </div>
                <div className="card text-center">
                  <div className="text-2xl font-bold text-yellow-400">{playerStats.draws}</div>
                  <div className="text-slate-400 text-xs mt-1">Draws</div>
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Win Rate</span>
                  <span className="font-bold">{playerStats.winRate}%</span>
                </div>
                <div className="bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${playerStats.winRate}%` }}
                  />
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Current Streak</span>
                  <span className="font-bold text-orange-400">🔥 {playerStats.currentStreak}</span>
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Games Played</span>
                  <span className="font-bold">{playerStats.games}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-center py-8">Loading stats...</p>
          )}
        </div>
      )}
    </div>
  );
}
