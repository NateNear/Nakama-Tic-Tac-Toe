import { useState, useCallback } from 'react';
import { useNakama } from './hooks/useNakama';
import { useMatch } from './hooks/useMatch';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

type Page = 'login' | 'lobby' | 'game';

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { session, socket, isConnecting, error, authenticate, sendRpc } = useNakama();

  const handleError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }, []);

  const {
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
  } = useMatch({ socket, session, onError: handleError });

  const handleLogin = async (username: string) => {
    try {
      await authenticate(username);
      setPage('lobby');
    } catch (e: any) {
      handleError(e.message || 'Failed to connect');
    }
  };

  const handleJoinMatch = async (id: string) => {
    try {
      await joinMatch(id);
      setPage('game');
    } catch (e: any) {
      handleError(e.message || 'Failed to join match');
    }
  };

  const handleLeaveMatch = async () => {
    await leaveMatch();
    setPage('lobby');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Global error toast */}
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-fade-in">
          {errorMsg}
        </div>
      )}

      {page === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          isLoading={isConnecting}
          error={error}
        />
      )}

      {page === 'lobby' && session && (
        <LobbyPage
          session={session}
          onJoinMatch={handleJoinMatch}
          sendRpc={sendRpc}
          addToMatchmaker={addToMatchmaker}
          removeFromMatchmaker={removeFromMatchmaker}
          onError={handleError}
        />
      )}

      {page === 'game' && session && (
        <GamePage
          session={session}
          matchId={matchId}
          gameState={gameState}
          gameOverReason={gameOverReason}
          onMove={sendMove}
          onRematch={sendRematch}
          onLeave={handleLeaveMatch}
        />
      )}
    </div>
  );
}
