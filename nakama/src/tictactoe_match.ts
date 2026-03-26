// Op codes for client-server communication
export const OpCode = {
  GAME_STATE: 1,    // Server -> Client: full game state update
  MOVE: 2,          // Client -> Server: player move
  GAME_OVER: 3,     // Server -> Client: game ended
  PLAYER_JOINED: 4, // Server -> Client: player joined
  PLAYER_LEFT: 5,   // Server -> Client: player left
  TIMER_UPDATE: 6,  // Server -> Client: timer tick
  ERROR: 7,         // Server -> Client: error message
  REMATCH: 8,       // Client -> Server: request rematch
};

export interface PlayerInfo {
  userId: string;
  username: string;
  symbol: 'X' | 'O';
}

export interface GameState {
  board: string[];           // 9 cells: '' | 'X' | 'O'
  currentTurn: string;       // userId of the player whose turn it is
  players: { [userId: string]: PlayerInfo };
  playerOrder: string[];     // [player1Id, player2Id]
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;     // userId, 'draw', or null
  moveCount: number;
  timedMode: boolean;
  turnTimeLimit: number;     // seconds per turn (0 = no limit)
  turnTimeRemaining: number; // seconds remaining for current turn
  turnStartTick: number;     // tick when current turn started
  rematchVotes: string[];    // userIds who voted for rematch
}

const WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export function checkWinner(board: string[]): string | null {
  for (const [a, b, c] of WIN_PATTERNS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  if (board.every(cell => cell !== '')) return 'draw';
  return null;
}

export function createInitialState(timedMode: boolean): GameState {
  return {
    board: Array(9).fill(''),
    currentTurn: '',
    players: {},
    playerOrder: [],
    status: 'waiting',
    winner: null,
    moveCount: 0,
    timedMode,
    turnTimeLimit: timedMode ? 30 : 0,
    turnTimeRemaining: timedMode ? 30 : 0,
    turnStartTick: 0,
    rematchVotes: [],
  };
}

const matchInit: nkruntime.MatchInitFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  const timedMode = params['timed'] === 'true';
  const state: GameState = createInitialState(timedMode);

  logger.info('Match initialized, timedMode=%v', timedMode);

  return {
    state,
    tickRate: 5, // 5 ticks per second
    label: JSON.stringify({ timedMode, players: 0, status: 'waiting' }),
  };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState; accept: boolean; rejectMessage?: string } | null {
  const gs = state as GameState;

  if (gs.status === 'finished') {
    return { state, accept: false, rejectMessage: 'Game already finished' };
  }

  if (gs.playerOrder.length >= 2) {
    return { state, accept: false, rejectMessage: 'Match is full' };
  }

  return { state, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  const gs = state as GameState;

  for (const presence of presences) {
    const symbol: 'X' | 'O' = gs.playerOrder.length === 0 ? 'X' : 'O';
    gs.players[presence.userId] = {
      userId: presence.userId,
      username: presence.username,
      symbol,
    };
    gs.playerOrder.push(presence.userId);

    logger.info('Player %v joined as %v', presence.userId, symbol);
  }

  if (gs.playerOrder.length === 2) {
    gs.status = 'playing';
    gs.currentTurn = gs.playerOrder[0]; // X goes first
    gs.turnStartTick = tick;
    gs.turnTimeRemaining = gs.turnTimeLimit;

    // Broadcast game start to all players
    const msg = JSON.stringify({
      opCode: OpCode.GAME_STATE,
      data: sanitizeState(gs),
    });
    dispatcher.broadcastMessage(OpCode.GAME_STATE, msg, null, null, true);

    // Update match label
    try {
      dispatcher.matchLabelUpdate(JSON.stringify({
        timedMode: gs.timedMode,
        players: 2,
        status: 'playing',
      }));
    } catch (e) {}
  } else {
    // First player joined, notify them to wait
    const msg = JSON.stringify({
      opCode: OpCode.GAME_STATE,
      data: sanitizeState(gs),
    });
    dispatcher.broadcastMessage(OpCode.GAME_STATE, msg, null, null, true);
  }

  return { state: gs };
};

const matchLeave: nkruntime.MatchLeaveFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  const gs = state as GameState;

  for (const presence of presences) {
    logger.info('Player %v left the match', presence.userId);
  }

  if (gs.status === 'playing') {
    // The player who left loses; find the remaining player
    const leavingIds = presences.map(p => p.userId);
    const remainingId = gs.playerOrder.find(id => !leavingIds.includes(id));

    if (remainingId) {
      gs.status = 'finished';
      gs.winner = remainingId;

      // Award win to remaining player
      try {
        recordResult(nk, remainingId, gs.players[remainingId]?.username || '', 'win');
        for (const leavingId of leavingIds) {
          if (gs.players[leavingId]) {
            recordResult(nk, leavingId, gs.players[leavingId].username, 'loss');
          }
        }
      } catch (e) {}

      const msg = JSON.stringify({
        opCode: OpCode.GAME_OVER,
        data: { ...sanitizeState(gs), reason: 'opponent_disconnected' },
      });
      dispatcher.broadcastMessage(OpCode.GAME_OVER, msg, null, null, true);
    }
  }

  return { state: gs };
};

const matchLoop: nkruntime.MatchLoopFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  const gs = state as GameState;

  // Process incoming messages
  for (const msg of messages) {
    try {
      const data = JSON.parse(nk.binaryToString(msg.data));

      switch (msg.opCode) {
        case OpCode.MOVE:
          handleMove(nk, dispatcher, tick, gs, msg.sender, data);
          break;
        case OpCode.REMATCH:
          handleRematch(nk, dispatcher, tick, gs, msg.sender);
          break;
      }
    } catch (e) {
      logger.error('Error processing message: %v', e);
    }
  }

  // Handle timer if timed mode and game is playing
  if (gs.status === 'playing' && gs.timedMode && gs.turnTimeLimit > 0) {
    const ticksPerSecond = 5;
    const elapsedTicks = tick - gs.turnStartTick;
    const elapsedSeconds = Math.floor(elapsedTicks / ticksPerSecond);
    gs.turnTimeRemaining = Math.max(0, gs.turnTimeLimit - elapsedSeconds);

    // Broadcast timer update every second (every 5 ticks)
    if (elapsedTicks % ticksPerSecond === 0 && gs.turnTimeRemaining > 0) {
      const timerMsg = JSON.stringify({
        opCode: OpCode.TIMER_UPDATE,
        data: { timeRemaining: gs.turnTimeRemaining, currentTurn: gs.currentTurn },
      });
      dispatcher.broadcastMessage(OpCode.TIMER_UPDATE, timerMsg, null, null, true);
    }

    // Time expired - forfeit current player's turn
    if (gs.turnTimeRemaining === 0) {
      const forfeitedId = gs.currentTurn;
      const winnerId = gs.playerOrder.find(id => id !== forfeitedId)!;

      gs.status = 'finished';
      gs.winner = winnerId;

      try {
        recordResult(nk, winnerId, gs.players[winnerId]?.username || '', 'win');
        recordResult(nk, forfeitedId, gs.players[forfeitedId]?.username || '', 'loss');
      } catch (e) {}

      const gameOverMsg = JSON.stringify({
        opCode: OpCode.GAME_OVER,
        data: { ...sanitizeState(gs), reason: 'timeout' },
      });
      dispatcher.broadcastMessage(OpCode.GAME_OVER, gameOverMsg, null, null, true);
    }
  }

  // Terminate match if no players for more than 30 seconds (150 ticks at 5/s)
  if (gs.playerOrder.length === 0) {
    return null;
  }

  return { state: gs };
};

const matchTerminate: nkruntime.MatchTerminateFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  logger.info('Match terminating, grace=%v seconds', graceSeconds);
  return { state };
};

const matchSignal: nkruntime.MatchSignalFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  return { state, data };
};

function handleMove(
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  gs: GameState,
  sender: nkruntime.Presence,
  data: { position: number }
) {
  // Validate: game must be in playing state
  if (gs.status !== 'playing') {
    const errMsg = JSON.stringify({ opCode: OpCode.ERROR, data: { message: 'Game is not in playing state' } });
    dispatcher.broadcastMessage(OpCode.ERROR, errMsg, [sender], null, true);
    return;
  }

  // Validate: must be this player's turn
  if (gs.currentTurn !== sender.userId) {
    const errMsg = JSON.stringify({ opCode: OpCode.ERROR, data: { message: 'Not your turn' } });
    dispatcher.broadcastMessage(OpCode.ERROR, errMsg, [sender], null, true);
    return;
  }

  // Validate: position must be valid
  const pos = data.position;
  if (pos === undefined || pos < 0 || pos > 8 || !Number.isInteger(pos)) {
    const errMsg = JSON.stringify({ opCode: OpCode.ERROR, data: { message: 'Invalid position' } });
    dispatcher.broadcastMessage(OpCode.ERROR, errMsg, [sender], null, true);
    return;
  }

  // Validate: cell must be empty
  if (gs.board[pos] !== '') {
    const errMsg = JSON.stringify({ opCode: OpCode.ERROR, data: { message: 'Cell already occupied' } });
    dispatcher.broadcastMessage(OpCode.ERROR, errMsg, [sender], null, true);
    return;
  }

  // Apply move
  const playerInfo = gs.players[sender.userId];
  gs.board[pos] = playerInfo.symbol;
  gs.moveCount++;

  // Check for win/draw
  const result = checkWinner(gs.board);

  if (result) {
    gs.status = 'finished';
    if (result === 'draw') {
      gs.winner = 'draw';
      // Record draw for both players
      for (const playerId of gs.playerOrder) {
        try {
          recordResult(nk, playerId, gs.players[playerId]?.username || '', 'draw');
        } catch (e) {}
      }
    } else {
      // result is 'X' or 'O', find the winning player
      const winnerId = gs.playerOrder.find(id => gs.players[id]?.symbol === result)!;
      const loserId = gs.playerOrder.find(id => gs.players[id]?.symbol !== result)!;
      gs.winner = winnerId;

      try {
        recordResult(nk, winnerId, gs.players[winnerId]?.username || '', 'win');
        recordResult(nk, loserId, gs.players[loserId]?.username || '', 'loss');
      } catch (e) {}
    }

    const gameOverMsg = JSON.stringify({
      opCode: OpCode.GAME_OVER,
      data: { ...sanitizeState(gs), reason: 'game_complete' },
    });
    dispatcher.broadcastMessage(OpCode.GAME_OVER, gameOverMsg, null, null, true);
  } else {
    // Switch turns
    gs.currentTurn = gs.playerOrder.find(id => id !== sender.userId)!;
    gs.turnStartTick = tick;
    gs.turnTimeRemaining = gs.turnTimeLimit;

    const stateMsg = JSON.stringify({
      opCode: OpCode.GAME_STATE,
      data: sanitizeState(gs),
    });
    dispatcher.broadcastMessage(OpCode.GAME_STATE, stateMsg, null, null, true);
  }
}

function handleRematch(
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  gs: GameState,
  sender: nkruntime.Presence
) {
  if (gs.status !== 'finished') return;
  if (!gs.rematchVotes.includes(sender.userId)) {
    gs.rematchVotes.push(sender.userId);
  }

  if (gs.rematchVotes.length === 2) {
    // Both players want rematch - reset game, swap who goes first
    const newFirst = gs.playerOrder[1]; // swap order
    gs.playerOrder = [gs.playerOrder[1], gs.playerOrder[0]];
    // Swap symbols
    for (const id of gs.playerOrder) {
      gs.players[id].symbol = gs.players[id].symbol === 'X' ? 'O' : 'X';
    }
    gs.board = Array(9).fill('');
    gs.currentTurn = gs.playerOrder[0];
    gs.status = 'playing';
    gs.winner = null;
    gs.moveCount = 0;
    gs.rematchVotes = [];
    gs.turnStartTick = tick;
    gs.turnTimeRemaining = gs.turnTimeLimit;

    const stateMsg = JSON.stringify({
      opCode: OpCode.GAME_STATE,
      data: sanitizeState(gs),
    });
    dispatcher.broadcastMessage(OpCode.GAME_STATE, stateMsg, null, null, true);
  } else {
    // Notify both players one person voted for rematch
    const stateMsg = JSON.stringify({
      opCode: OpCode.GAME_STATE,
      data: sanitizeState(gs),
    });
    dispatcher.broadcastMessage(OpCode.GAME_STATE, stateMsg, null, null, true);
  }
}

function sanitizeState(gs: GameState): object {
  return {
    board: gs.board,
    currentTurn: gs.currentTurn,
    players: gs.players,
    playerOrder: gs.playerOrder,
    status: gs.status,
    winner: gs.winner,
    moveCount: gs.moveCount,
    timedMode: gs.timedMode,
    turnTimeLimit: gs.turnTimeLimit,
    turnTimeRemaining: gs.turnTimeRemaining,
    rematchVotes: gs.rematchVotes,
  };
}

function recordResult(nk: nkruntime.Nakama, userId: string, username: string, result: 'win' | 'loss' | 'draw') {
  const LEADERBOARD_ID = 'tictactoe_wins';
  const STREAK_LEADERBOARD_ID = 'tictactoe_streak';

  if (result === 'win') {
    nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, username, 1, 0, {});

    // Update streak - we use a storage object to track current streak
    const streakKey = [{ collection: 'player_stats', key: 'streak', userId }];
    const streakObjs = nk.storageRead(streakKey);
    let currentStreak = 0;
    if (streakObjs.length > 0) {
      currentStreak = (streakObjs[0].value as any).currentStreak || 0;
    }
    currentStreak++;
    nk.storageWrite([{
      collection: 'player_stats',
      key: 'streak',
      userId,
      value: { currentStreak },
      permissionRead: 2,
      permissionWrite: 1,
    }]);
    // Update streak leaderboard if current streak is best
    nk.leaderboardRecordWrite(STREAK_LEADERBOARD_ID, userId, username, currentStreak, 0, {});
  } else if (result === 'loss') {
    // Reset streak
    nk.storageWrite([{
      collection: 'player_stats',
      key: 'streak',
      userId,
      value: { currentStreak: 0 },
      permissionRead: 2,
      permissionWrite: 1,
    }]);
    // Record loss
    nk.leaderboardRecordWrite('tictactoe_losses', userId, username, 1, 0, {});
  }
  // Always record games played
  nk.leaderboardRecordWrite('tictactoe_games', userId, username, 1, 0, {});
}

export const TicTacToeMatch: nkruntime.MatchHandler = {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
};
