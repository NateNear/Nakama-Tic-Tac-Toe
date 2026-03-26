interface Props {
  username: string;
  symbol: 'X' | 'O' | null;
  isCurrentTurn: boolean;
  isMe: boolean;
}

export default function PlayerCard({ username, symbol, isCurrentTurn, isMe }: Props) {
  return (
    <div className={`flex-1 card text-center transition-all duration-300 ${
      isCurrentTurn ? 'ring-2 ring-yellow-400 shadow-yellow-400/20 shadow-lg' : ''
    }`}>
      {/* Symbol badge */}
      <div className={`text-2xl font-bold mb-1 ${
        symbol === 'X' ? 'text-red-400' :
        symbol === 'O' ? 'text-blue-400' :
        'text-slate-500'
      }`}>
        {symbol || '?'}
      </div>

      {/* Username */}
      <div className="text-xs font-medium text-slate-300 truncate">
        {username}
      </div>

      {/* Turn indicator */}
      {isCurrentTurn && (
        <div className="mt-1 text-xs text-yellow-400 animate-pulse">
          {isMe ? 'Your turn!' : 'Their turn'}
        </div>
      )}
    </div>
  );
}
