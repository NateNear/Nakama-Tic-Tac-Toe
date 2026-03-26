interface Props {
  board: string[];
  onCellClick: (index: number) => void;
  disabled: boolean;
  mySymbol: 'X' | 'O' | null;
}

export default function Board({ board, onCellClick, disabled, mySymbol }: Props) {
  return (
    <div className="w-full max-w-[320px] aspect-square">
      <div className="grid grid-cols-3 gap-3 w-full h-full">
        {board.map((cell, index) => (
          <Cell
            key={index}
            value={cell}
            index={index}
            onClick={onCellClick}
            disabled={disabled || cell !== ''}
            isMySymbol={cell === mySymbol}
          />
        ))}
      </div>
    </div>
  );
}

interface CellProps {
  value: string;
  index: number;
  onClick: (i: number) => void;
  disabled: boolean;
  isMySymbol: boolean;
}

function Cell({ value, index, onClick, disabled, isMySymbol }: CellProps) {
  return (
    <button
      onClick={() => !disabled && onClick(index)}
      className={`
        aspect-square rounded-2xl text-5xl font-bold flex items-center justify-center
        transition-all duration-200 shadow-lg
        ${!value && !disabled
          ? 'bg-slate-700 hover:bg-slate-600 hover:scale-105 cursor-pointer'
          : 'bg-slate-800 cursor-default'
        }
        ${value === 'X' ? 'text-red-400' : value === 'O' ? 'text-blue-400' : ''}
      `}
      disabled={disabled}
    >
      {value && (
        <span className={value === 'X' ? 'cell-x' : 'cell-o'}>
          {value}
        </span>
      )}
    </button>
  );
}
