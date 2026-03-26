import { GameState } from '../types/game';

interface Props {
  gameState: GameState | null;
  isMyTurn: boolean;
  myUserId: string;
  gameOverReason: string | null;
}

export default function GameStatus({ gameState, isMyTurn, myUserId, gameOverReason }: Props) {
  if (!gameState) {
    return (
      <div className="text-center text-slate-400 text-sm py-2">
        Connecting to match...
      </div>
    );
  }

  if (gameState.status === 'waiting') {
    return null;
  }

  if (gameState.status === 'playing') {
    return (
      <div className={`text-center py-2 px-4 rounded-xl text-sm font-medium ${
        isMyTurn ? 'bg-yellow-600/20 text-yellow-300' : 'bg-slate-700/50 text-slate-400'
      }`}>
        {isMyTurn ? '🎯 Your turn — tap a cell' : '⏳ Waiting for opponent...'}
      </div>
    );
  }

  if (gameState.status === 'finished') {
    const isDraw = gameState.winner === 'draw';
    const iWon = gameState.winner === myUserId;
    const winnerName = gameState.winner && !isDraw
      ? gameState.players[gameState.winner]?.username
      : null;

    const reasonMap: Record<string, string> = {
      opponent_disconnected: '(opponent disconnected)',
      timeout: '(time ran out)',
      game_complete: '',
    };
    const reasonStr = gameOverReason ? (reasonMap[gameOverReason] || '') : '';

    return (
      <div className={`text-center py-3 px-4 rounded-xl font-bold text-lg ${
        isDraw ? 'bg-yellow-600/20 text-yellow-300' :
        iWon ? 'bg-green-600/20 text-green-300' :
        'bg-red-600/20 text-red-300'
      }`}>
        {isDraw ? "It's a Draw! 🤝" :
         iWon ? '🎉 You Won!' : `😔 ${winnerName} Won`}
        {reasonStr && <div className="text-xs opacity-70 mt-1">{reasonStr}</div>}
      </div>
    );
  }

  return null;
}
