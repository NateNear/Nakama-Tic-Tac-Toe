export interface PlayerInfo {
  userId: string;
  username: string;
  symbol: 'X' | 'O';
}

export interface GameState {
  board: string[];
  currentTurn: string;
  players: { [userId: string]: PlayerInfo };
  playerOrder: string[];
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  moveCount: number;
  timedMode: boolean;
  turnTimeLimit: number;
  turnTimeRemaining: number;
  rematchVotes: string[];
}

export interface MatchInfo {
  matchId: string;
  label: {
    timedMode: boolean;
    players: number;
    status: string;
  };
  size: number;
}

export interface LeaderboardRecord {
  rank: number;
  userId: string;
  username: string;
  score: number;
  numScore: number;
  updateTime: string;
}

export interface PlayerStats {
  userId: string;
  wins: number;
  losses: number;
  games: number;
  draws: number;
  currentStreak: number;
  winRate: number;
}

export const OpCode = {
  GAME_STATE: 1,
  MOVE: 2,
  GAME_OVER: 3,
  PLAYER_JOINED: 4,
  PLAYER_LEFT: 5,
  TIMER_UPDATE: 6,
  ERROR: 7,
  REMATCH: 8,
} as const;
