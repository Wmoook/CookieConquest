# 🍪 Cookie Conquest

A real-time multiplayer cookie clicker game with trading mechanics. Click cookies, buy generators, and trade against your friends' cookie counts!

## 🎮 How to Play

1. **Create or Join a Lobby** - Enter your name and create a lobby (get a 4-letter code) or join with a friend's code
2. **Click Cookies** - Build your cookie empire by clicking and buying generators
3. **Trade Positions** - Open LONG or SHORT positions on other players' cookie counts
4. **Win** - First player to reach 100,000,000 cookies wins!

## 💹 Trading Mechanics

- **LONG**: Bet that a player's cookies will go UP
- **SHORT**: Bet that a player's cookies will go DOWN
- **Leverage**: 1x to 10x - Higher leverage = higher risk/reward
- **Liquidation**: If price moves against you enough, you lose your stake
- **Max Payout**: Auto-close when your profit exceeds what the target can pay

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open http://localhost:3000
```

## 📦 Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Deploy! (Railway auto-detects the Procfile)

The game uses no database - everything is in-memory, perfect for quick multiplayer sessions.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JS, HTML5 Canvas (charts)
- **Hosting**: Railway (or any Node.js host)

## 📁 Project Structure

```
├── server/
│   └── index-simple.js    # Main server
├── public/
│   ├── index.html         # Lobby page
│   ├── js/
│   │   ├── game-client.js # Multiplayer game client
│   │   └── tutorial.js    # Single-player tutorial
│   └── pages/
│       ├── game.html      # Multiplayer game
│       └── tutorial.html  # Tutorial mode
├── package.json
├── Procfile               # Railway/Heroku
└── railway.json           # Railway config
```

## 🎯 Features

- ✅ Real-time multiplayer (2-4 players)
- ✅ Lobby system with shareable codes
- ✅ Long/Short trading positions
- ✅ 1-10x leverage
- ✅ Liquidation mechanics
- ✅ Live position tracking
- ✅ Smooth price charts
- ✅ No account required

---

Made with 🍪 by the Cookie Conquest Team
