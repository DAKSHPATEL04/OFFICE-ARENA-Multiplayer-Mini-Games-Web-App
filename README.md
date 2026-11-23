# Office Arena — Multiplayer Party & Tank Battle Platform

Office Arena is a cross-device multiplayer web game platform & Progressive Web App (PWA) supporting **Desktop (Keyboard + Mouse)**, **Mobile & Tablet (Touch)**, and **Gamepad**, with **Online Rooms (2–12 players + 20 spectators)**, **Local Party (2–4 players on one screen)**, and **Offline Solo vs Bots (1–11 bots)**.

## Quick Start

1. **Install dependencies:** `npm install`
2. **Start development server (Express + WebSockets + Vite):** `npm run dev`
3. **Open:** `http://localhost:3000`
4. **Build for production:** `npm run build` then `npm start`
5. **Run multiplayer stress test:** `npm run loadtest -- --rooms 5 --players 12 --duration 8`

## Included Games

- **Tank Arena** (`games/tank-arena`): 2D top-down cartoon tank warfare across 5 symmetrical maps (`A` Steel Yard, `E` Sand Camp, `G` Duel Field, `H` Sand Cross, `J` Grass Blocks), 3 modes (**Flag**, **Team Fight**, **Free For All**), auto-scaling rules (2–4, 5–8, 9–12 players), breakable bricks & crates, 3 power-ups (`Speed`, `Shield`, `Unlimited Fire`), smart AI bots (`Easy`, `Medium`, `Hard`), and multiple steering styles per device.
- **Target Sprint (Template)** (`games/_template`): Minimal playable reflex game demonstrating zero-edit platform extensibility.

## Architecture Overview

- `/platform/shared` — Shared protocol, room/match types, seeded PRNG, and `GameModule` contract.
- `/platform/server` — Authoritative Express + `ws` RoomManager, validation, and rate limiting.
- `/platform/client` — Arena Glass UI screens, PWA install hook, `SettingsStore`, and `NetworkManager`.
- `/games/registry.ts` — Single registration file for all game modules.
- `/docs` — Detailed engineering, UI/UX, Desktop & Mobile/App guides, Maps, Controls, and QA documentation.
