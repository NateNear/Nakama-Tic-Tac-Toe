import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket, Session } from '@heroiclabs/nakama-js';
import { GameState, OpCode } from '../types/game';

interface UseMatchOptions {
  socket: Socket | null;
  session: Session | null;
  onError?: (msg: string) => void;
}

export function useMatch({ socket, session, onError }: UseMatchOptions) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isInMatch, setIsInMatch] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);
  const matchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !session) return;

    socket.onmatchdata = (matchData) => {
      try {
        const payload = JSON.parse(new TextDecoder().decode(matchData.data));

        switch (matchData.op_code) {
          case OpCode.GAME_STATE: {
            const data = payload.data || payload;
            setGameState(data as GameState);
            setGameOverReason(null);
            break;
          }
          case OpCode.GAME_OVER: {
            const data = payload.data || payload;
            setGameState(data as GameState);
            setGameOverReason(data.reason || 'game_complete');
            break;
          }
          case OpCode.TIMER_UPDATE: {
            const data = payload.data || payload;
            setGameState(prev => prev ? {
              ...prev,
              turnTimeRemaining: data.timeRemaining,
              currentTurn: data.currentTurn,
            } : prev);
            break;
          }
          case OpCode.ERROR: {
            const data = payload.data || payload;
            onError?.(data.message || 'Unknown error');
            break;
          }
        }
      } catch (e) {
        console.error('Error parsing match data:', e);
      }
    };

    socket.onmatchpresence = (presence) => {
      console.log('Match presence event:', presence);
    };

    return () => {
      socket.onmatchdata = () => {};
      socket.onmatchpresence = () => {};
    };
  }, [socket, session, onError]);

  const joinMatch = useCallback(async (id: string) => {
    if (!socket) throw new Error('Not connected');
    await socket.joinMatch(id);
    matchRef.current = id;
    setMatchId(id);
    setIsInMatch(true);
    setGameState(null);
    setGameOverReason(null);
  }, [socket]);

  const leaveMatch = useCallback(async () => {
    if (!socket || !matchRef.current) return;
    try {
      await socket.leaveMatch(matchRef.current);
    } catch (e) {}
    matchRef.current = null;
    setMatchId(null);
    setIsInMatch(false);
    setGameState(null);
    setGameOverReason(null);
  }, [socket]);

  const sendMove = useCallback((position: number) => {
    if (!socket || !matchRef.current) return;
    const data = new TextEncoder().encode(JSON.stringify({ position }));
    socket.sendMatchState(matchRef.current, OpCode.MOVE, data);
  }, [socket]);

  const sendRematch = useCallback(() => {
    if (!socket || !matchRef.current) return;
    const data = new TextEncoder().encode('{}');
    socket.sendMatchState(matchRef.current, OpCode.REMATCH, data);
  }, [socket]);

  const addToMatchmaker = useCallback(async (timedMode: boolean) => {
    if (!socket) throw new Error('Not connected');
    const ticket = await socket.addMatchmaker(
      '*',
      2,
      2,
      { timedMode: timedMode ? 'true' : 'false' },
      {}
    );
    return ticket;
  }, [socket]);

  const removeFromMatchmaker = useCallback(async (ticket: string) => {
    if (!socket) return;
    try {
      await socket.removeMatchmaker(ticket);
    } catch (e) {}
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.onmatchmakermatched = async (matched) => {
      if (matched.match_id) {
        await joinMatch(matched.match_id);
      }
    };
    return () => {
      socket.onmatchmakermatched = () => {};
    };
  }, [socket, joinMatch]);

  return {
    matchId,
    gameState,
    isInMatch,
    gameOverReason,
    joinMatch,
    leaveMatch,
    sendMove,
    sendRematch,
    addToMatchmaker,
    removeFromMatchmaker,
  };
}
