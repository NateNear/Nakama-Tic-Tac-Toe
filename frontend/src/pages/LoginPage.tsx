import { useState } from 'react';

interface Props {
  onLogin: (username: string) => void;
  isLoading: boolean;
  error: string | null;
}

export default function LoginPage({ onLogin, isLoading, error }: Props) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim() || `Player_${Math.floor(Math.random() * 9999)}`;
    onLogin(name);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-900 rounded-3xl mb-4 shadow-2xl">
            <div className="grid grid-cols-3 gap-1 w-14 h-14">
              {['', '', '', '', '', '', '', '', ''].map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${
                    [0, 2, 4, 6, 8].includes(i)
                      ? i === 4 ? 'bg-blue-400' : 'bg-red-400'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">TicTacToe</h1>
          <p className="text-slate-400 mt-1">Online Multiplayer</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your name..."
                maxLength={20}
                className="w-full bg-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/30 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-lg"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Connecting...
                </span>
              ) : 'Play Now'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4">
          No account needed · Play instantly
        </p>
      </div>
    </div>
  );
}
