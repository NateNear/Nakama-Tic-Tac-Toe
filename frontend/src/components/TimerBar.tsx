interface Props {
  timeRemaining: number;
  timeLimit: number;
  isMyTurn: boolean;
}

export default function TimerBar({ timeRemaining, timeLimit, isMyTurn }: Props) {
  const pct = timeLimit > 0 ? (timeRemaining / timeLimit) * 100 : 0;
  const isCritical = timeRemaining <= 10;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400">
          {isMyTurn ? 'Your time' : 'Opponent time'}
        </span>
        <span className={`text-sm font-bold ${isCritical ? 'timer-critical' : 'text-slate-300'}`}>
          {timeRemaining}s
        </span>
      </div>
      <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${
            isCritical ? 'bg-red-500' : pct > 50 ? 'bg-green-500' : 'bg-yellow-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
