# Multiplayer Tic-Tac-Toe with Nakama

A production-ready, real-time multiplayer Tic-Tac-Toe game built with **Nakama** (server-authoritative backend) and **React** (frontend).

## Live Demo

- **Game URL**: `https://tictactoe.yourdomain.com` *(deploy frontend to Vercel/Netlify)*
- **Nakama Server**: `ws://your-server:7350` *(deploy via Docker on any VPS/cloud)*
- **Nakama Console**: `http://your-server:7351` (admin/password)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                   │
│  LoginPage → LobbyPage → GamePage                       │
│  useNakama (auth/socket) + useMatch (game state)        │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket (Nakama JS SDK)
┌──────────────────────▼──────────────────────────────────┐
│                   Nakama Server                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Match Handler (tictactoe_match.ts)       │    │
│  │  matchInit → matchJoin → matchLoop → matchLeave  │    │
│  │  - Server-side move validation                   │    │
│  │  - Win/draw detection (WIN_PATTERNS)             │    │
│  │  - Timer management (timed mode)                 │    │
│  │  - Leaderboard recording                         │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────┐    │
│  │  Matchmaker  │ │  Leaderboards │ │  Player Stats│    │
│  │  (auto pair) │ │  (wins/streak)│ │  (storage)   │    │
│  └──────────────┘ └───────────────┘ └──────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  PostgreSQL 14                           │
└─────────────────────────────────────────────────────────┘
```

### Design Decisions

- **Server-Authoritative**: All game logic runs in `matchLoop` on the server. Clients only send `position` numbers; the server validates moves, detects wins, manages timers, and broadcasts canonical state.
- **Op Code Protocol**: Typed integer op codes (1-8) for efficient message routing over WebSocket binary frames.
- **Tick Rate**: 5 ticks/second — balances responsiveness with server load. Timer decrements are computed from tick delta, not wall clock.
- **Leaderboards**: Nakama built-in leaderboards with `incr` score operator for wins/losses/games, and `best` for streaks.
- **Anonymous Auth**: Device-ID-based auth stored in `localStorage` — no signup required, session auto-refreshes.

---

## Setup & Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js 18+](https://nodejs.org/)

### 1. Build the Nakama Module

```bash
cd nakama
npm install
npm run build
# Output: nakama-data/modules/tictactoe.js
```

### 2. Start the Backend (Local)

```bash
# From project root
docker-compose up -d

# Verify Nakama is running
curl http://localhost:7350/healthcheck
```

- Nakama console: http://localhost:7351 (admin / password)
- Game socket: ws://localhost:7350

### 3. Configure Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env if needed (defaults work for local)
npm install
npm run dev
# Open http://localhost:3000
```

---

## Testing Multiplayer

1. Open **two browser tabs** at `http://localhost:3000`
2. Enter different names in each tab
3. In tab 1: Click **Quick Match**
4. In tab 2: Click **Quick Match**
5. The matchmaker pairs them → game starts automatically
6. Alternatively: Tab 1 → **Create Private Match** → copy Match ID → Tab 2 → **Join by Match ID**

### Timed Mode

Toggle **Timed Mode** in the lobby before creating/joining. Each player gets 30 seconds per turn; expiry auto-forfeits.

### Leaderboard

After games complete, check the **Leaderboard** tab to see win rankings, or **Stats** for personal win rate and streaks.

---

## Deployment

### Option A: VPS (DigitalOcean / Hetzner / AWS EC2)

```bash
# On your server
git clone <repo>
cd assignment

# Build Nakama module
cd nakama && npm install && npm run build && cd ..

# Set environment variables
export POSTGRES_PASSWORD=your_strong_password
export NAKAMA_CONSOLE_PASSWORD=your_admin_pass

# Start production stack
docker-compose -f deploy/docker-compose.prod.yml up -d
```

**Configure DNS**: Point `nakama.yourdomain.com` → server IP, update `VITE_NAKAMA_HOST` in frontend `.env`.

### Option B: Frontend on Vercel

```bash
cd frontend
# Set environment variables in Vercel dashboard:
#   VITE_NAKAMA_HOST=nakama.yourdomain.com
#   VITE_NAKAMA_PORT=7350
#   VITE_NAKAMA_USE_SSL=true
#   VITE_NAKAMA_SERVER_KEY=defaultkey

vercel --prod
```

### Option C: Render / Railway (Free Tier)

Both Render and Railway support Docker deployments. Use the `docker-compose.yml` as a reference and deploy the `registry.heroiclabs.com/heroiclabs/nakama:3.21.1` image with a managed PostgreSQL addon.

---

## API / Server Configuration

### RPC Endpoints

| RPC ID | Payload | Response |
|--------|---------|----------|
| `create_match` | `{ timedMode: bool }` | `{ matchId: string }` |
| `find_matches` | `{}` | `{ matches: MatchInfo[] }` |
| `get_leaderboard` | `{ leaderboardId, limit }` | `{ records: LeaderboardRecord[] }` |
| `get_player_stats` | `{}` | `PlayerStats` |

### WebSocket Op Codes

| Code | Direction | Description |
|------|-----------|-------------|
| 1 | Server→Client | Full game state update |
| 2 | Client→Server | Player move `{ position: 0-8 }` |
| 3 | Server→Client | Game over with reason |
| 4 | Server→Client | Player joined notification |
| 5 | Server→Client | Player left notification |
| 6 | Server→Client | Timer tick update |
| 7 | Server→Client | Error message |
| 8 | Client→Server | Rematch vote |

### Leaderboard IDs

| ID | Tracks |
|----|--------|
| `tictactoe_wins` | Total wins (ranked) |
| `tictactoe_losses` | Total losses |
| `tictactoe_games` | Total games played |
| `tictactoe_streak` | Best win streak |

---

## Features

### Core
- ✅ Server-authoritative game logic (no client-side cheating possible)
- ✅ Real-time WebSocket communication
- ✅ Automatic matchmaking
- ✅ Private match creation & join by ID
- ✅ Open match browser
- ✅ Graceful disconnect handling (opponent disconnect = auto win)
- ✅ Rematch system (both players must vote)

### Bonus
- ✅ Concurrent game support (each match is an isolated Nakama match)
- ✅ Global leaderboard (wins, streaks)
- ✅ Player statistics (win rate, streak, draws)
- ✅ Timed mode (30s per turn, auto-forfeit on timeout)
- ✅ Mobile-responsive UI

---

## Project Structure

```
assignment/
├── docker-compose.yml          # Local dev stack
├── nakama/
│   ├── src/
│   │   ├── main.ts             # Module init, RPC handlers, matchmaker hook
│   │   └── tictactoe_match.ts  # Match handler (game logic)
│   ├── package.json
│   └── tsconfig.json
├── nakama-data/
│   ├── local.yml               # Nakama server config
│   └── modules/
│       └── tictactoe.js        # Compiled output (git-ignored, built by npm run build)
├── frontend/
│   ├── src/
│   │   ├── types/game.ts       # Shared TypeScript types
│   │   ├── hooks/
│   │   │   ├── useNakama.ts    # Auth & connection management
│   │   │   └── useMatch.ts     # Match state & socket events
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── LobbyPage.tsx
│   │   │   └── GamePage.tsx
│   │   └── components/
│   │       ├── Board.tsx
│   │       ├── PlayerCard.tsx
│   │       ├── TimerBar.tsx
│   │       └── GameStatus.tsx
│   └── package.json
└── deploy/
    ├── docker-compose.prod.yml  # Production stack with Nginx
    └── nginx.conf               # Reverse proxy config
```
