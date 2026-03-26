import { TicTacToeMatch } from './tictactoe_match';

const InitModule: nkruntime.InitModule = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  // Register the match handler
  initializer.registerMatch('tictactoe', TicTacToeMatch);

  // Register RPC functions
  initializer.registerRpc('create_match', rpcCreateMatch);
  initializer.registerRpc('find_matches', rpcFindMatches);
  initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);
  initializer.registerRpc('get_player_stats', rpcGetPlayerStats);

  // Create leaderboards (idempotent)
  try {
    nk.leaderboardCreate('tictactoe_wins', false, 'desc', 'incr', '', true);
    nk.leaderboardCreate('tictactoe_losses', false, 'desc', 'incr', '', true);
    nk.leaderboardCreate('tictactoe_games', false, 'desc', 'incr', '', true);
    nk.leaderboardCreate('tictactoe_streak', false, 'desc', 'best', '', true);
  } catch (e) {
    logger.info('Leaderboards already exist or error: %v', e);
  }

  // Register matchmaker matched hook
  initializer.registerMatchmakerMatched(matchmakerMatched);

  logger.info('TicTacToe module initialized');
};

const rpcCreateMatch: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let timedMode = false;
  try {
    const params = JSON.parse(payload);
    timedMode = params.timedMode === true;
  } catch (e) {}

  const matchId = nk.matchCreate('tictactoe', { timed: timedMode ? 'true' : 'false' });
  logger.info('Created match %v, timedMode=%v', matchId, timedMode);

  return JSON.stringify({ matchId });
};

const rpcFindMatches: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const matches = nk.matchList(10, true, null, 1, 1, '');
  const result = matches.map(m => ({
    matchId: m.matchId,
    label: m.label ? JSON.parse(m.label) : {},
    size: m.size,
  }));

  return JSON.stringify({ matches: result });
};

const rpcGetLeaderboard: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let leaderboardId = 'tictactoe_wins';
  let limit = 20;

  try {
    const params = JSON.parse(payload);
    if (params.leaderboardId) leaderboardId = params.leaderboardId;
    if (params.limit) limit = Math.min(params.limit, 100);
  } catch (e) {}

  const records = nk.leaderboardRecordsList(leaderboardId, [], limit, null, 0);

  // Enrich with per-player stats
  const enriched = (records.records || []).map((r: nkruntime.LeaderboardRecord) => ({
    rank: r.rank,
    userId: r.ownerId,
    username: r.username,
    score: r.score,
    numScore: r.numScore,
    updateTime: r.updateTime,
  }));

  return JSON.stringify({
    leaderboardId,
    records: enriched,
  });
};

const rpcGetPlayerStats: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const userId = ctx.userId;

  // Get wins
  let wins = 0, losses = 0, games = 0, streak = 0;

  try {
    const winsRecords = nk.leaderboardRecordsList('tictactoe_wins', [userId], 1, null, 0);
    if (winsRecords.ownerRecords && winsRecords.ownerRecords.length > 0) {
      wins = winsRecords.ownerRecords[0].score;
    }
  } catch (e) {}

  try {
    const lossRecords = nk.leaderboardRecordsList('tictactoe_losses', [userId], 1, null, 0);
    if (lossRecords.ownerRecords && lossRecords.ownerRecords.length > 0) {
      losses = lossRecords.ownerRecords[0].score;
    }
  } catch (e) {}

  try {
    const gameRecords = nk.leaderboardRecordsList('tictactoe_games', [userId], 1, null, 0);
    if (gameRecords.ownerRecords && gameRecords.ownerRecords.length > 0) {
      games = gameRecords.ownerRecords[0].score;
    }
  } catch (e) {}

  try {
    const streakObjs = nk.storageRead([{ collection: 'player_stats', key: 'streak', userId }]);
    if (streakObjs.length > 0) {
      streak = (streakObjs[0].value as any).currentStreak || 0;
    }
  } catch (e) {}

  return JSON.stringify({
    userId,
    wins,
    losses,
    games,
    draws: Math.max(0, games - wins - losses),
    currentStreak: streak,
    winRate: games > 0 ? Math.round((wins / games) * 100) : 0,
  });
};

const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string | void {
  const timedMode = matches[0]?.properties?.timedMode === 'true';
  const matchId = nk.matchCreate('tictactoe', { timed: timedMode ? 'true' : 'false' });
  logger.info('Matchmaker created match %v for %v players', matchId, matches.length);
  return matchId;
};

// Required by Nakama runtime
!InitModule && InitModule.bind(null);
