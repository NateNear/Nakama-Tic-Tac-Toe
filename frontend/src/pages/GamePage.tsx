import { Session } from '@heroiclabs/nakama-js';
import { GameState } from '../types/game';
import Board from '../components/Board';
import PlayerCard from '../components/PlayerCard';
import TimerBar from '../components/TimerBar';
import GameStatus from '../components/GameStatus';

interface Props {
  session: Session;
  matchId: string | null;
  gameState: GameState | null;
  gameOverReason: string | null;
  onMove: (position: number) => void;
  onRematch: () => void;
  onLeave: () => void;
}

export default function GamePage({
  session,
  matchId,
  gameState,
  gameOverReason,
  onMove,
  onRematch,
  onLeave,
}: Props) {
  const myUserId = session.user_id ?? '';
  const myPlayer = myUserId ? gameState?.players[myUserId] : undefined;
  const opponent = gameState ? Object.values(gameState.players).find(p => p.userId !== myUserId) : null;
  const isMyTurn = gameState?.status === 'playing' && gameState?.currentTurn === myUserId;

  const myVotedRematch = myUserId ? gameState?.rematchVotes.includes(myUserId) : false;

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <button onClick={onLeave} className="text-slate-400 hover:text-white p-2 -ml-2">
          ← Leave
        </button>
        <div className="text-xs text-slate-500 font-mono truncate max-w-[160px]">
          {matchId?.slice(0, 20)}...
        </div>
        <div className="w-12" />
      </div>

      {/* Players */}
      <div className="flex gap-3 mb-4">
        {/* Me */}
        <PlayerCard
          username={session.username || 'You'}
          symbol={myPlayer?.symbol || null}
          isCurrentTurn={isMyTurn}
          isMe={true}
        />
        <div className="flex items-center text-slate-500 font-bold">VS</div>
        {/* Opponent */}
        <PlayerCard
          username={opponent?.username || 'Waiting...'}
          symbol={opponent?.symbol || null}
          isCurrentTurn={!isMyTurn && gameState?.status === 'playing'}
          isMe={false}
        />
      </div>

      {/* Timer */}
      {gameState?.timedMode && gameState.status === 'playing' && (
        <TimerBar
          timeRemaining={gameState.turnTimeRemaining}
          timeLimit={gameState.turnTimeLimit}
          isMyTurn={isMyTurn}
        />
      )}

      {/* Game Status */}
      <GameStatus
        gameState={gameState}
        isMyTurn={isMyTurn}
        myUserId={myUserId}
        gameOverReason={gameOverReason}
      />

      {/* Board */}
      <div className="flex-1 flex items-center justify-center my-4">
        <Board
          board={gameState?.board || Array(9).fill('')}
          onCellClick={onMove}
          disabled={!isMyTurn || gameState?.status !== 'playing'}
          mySymbol={myPlayer?.symbol || null}
        />
      </div>

      {/* Game Over Actions */}
      {gameState?.status === 'finished' && (
        <div className="space-y-3 pb-4">
          {!myVotedRematch ? (
            <button onClick={onRematch} className="btn-success w-full py-3 text-lg">
              🔄 Rematch
            </button>
          ) : (
            <div className="card text-center text-slate-400">
              Waiting for opponent to accept rematch...
              {gameState.rematchVotes.length}/2 votes
            </div>
          )}
          <button onClick={onLeave} className="btn-secondary w-full py-2">
            Back to Lobby
          </button>
        </div>
      )}

      {/* Waiting state */}
      {gameState?.status === 'waiting' && (
        <div className="card text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Waiting for opponent to join...
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono">{matchId}</div>
        </div>
      )}
    </div>
  );
}
