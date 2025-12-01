# Cookie Conquest

A competitive incremental bluffing strategy game.

## Features

- Real-time multiplayer (2-10 players)
- Skill-based cookie clicking with perfect timing and crit zones
- Bluffing system (inflate/deflate public cookie counts)
- Cookie calls (challenge opponents' displayed stats)
- Sabotage and defense systems
- Multiple game phases (Early, Mid, Conflict, Bake-Off)
- Buy-in system with prize pools

## Quick Start

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## Deployment

This game is ready to deploy on Railway:

1. Push to GitHub
2. Connect to Railway
3. Deploy!

Environment variables:
- `PORT` - Automatically set by Railway

## Game Rules

### Core Systems

1. **Cookie Generation**
   - Normal click = +1 cookie
   - Perfect-timed click = +5 cookies
   - Crit-click zone offers 2x or 4x multipliers

2. **Generators**
   - Oven: +1/sec
   - Kitchen: +5/sec
   - Factory: +15/sec
   - AI Baker: +50/sec (auto-counters sabotages)

3. **Bluffing (BS Meter)**
   - Inflate/deflate your public cookie count
   - Stat mask to freeze displayed value
   - False crisis to fake being sabotaged

4. **Cookie Calls**
   - Challenge opponents' displayed stats
   - Correct call: steal 10% of their cookies
   - Wrong call: lose 10% of your cookies

5. **Sabotage**
   - Cookie Worm: 15% passive drain
   - Oven Overload: Shuts off generators
   - Fog of War: Hides opponent stats
   - Sugar Bomb: Halves public count
   - Stale Batch: Debuffs clicking accuracy

6. **Defense**
   - Antivirus, Cooling System, Firewall, etc.
   - Sabotage Trap reflects damage
   - AI Baker auto-blocks attacks

### Match Flow

- **Phase 1 (0:00-1:00)**: Build economy, establish clicking skill
- **Phase 2 (1:00-4:00)**: Leverage generators, start mind games
- **Phase 3 (4:00-6:00)**: Sabotage, call bluffs, steal resources
- **Phase 4 (Final 30s)**: Bake-Off! 2x multiplier, reduced sabotage costs

### Victory

Highest True Cookie Count at match end wins the entire prize pool!

## Tech Stack

- **Backend**: Node.js, Express, WebSocket
- **Frontend**: Vanilla JS, HTML5 Canvas
- **Styling**: Custom CSS with animations

## License

MIT
