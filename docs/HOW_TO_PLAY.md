# Desktop & Mobile App Experience Guide

Office Arena is designed from the ground up as both a **responsive Desktop Web App** and an **installable Mobile/Tablet PWA App**.

## Desktop Experience
- **Top Navigation Bar**: 3-zone header with Brand logo, section links (`Games`, `Controls`, `Profile`, `Settings`, `Credits`), ping chip, `Ctrl/Cmd+K` Command Palette trigger, and primary `Join Room` CTA.
- **Full Keyboard Shortcuts**:
  - `Ctrl/Cmd + K` — Open Command Palette (jump to games, type a 4-letter room code, switch themes)
  - `Ctrl/Cmd + M` — Toggle Mute anywhere
  - `Tab` (hold in match) — Live Scoreboard overlay
  - `Esc` — Pause Menu & match exit confirmation
  - `F` — Toggle Fullscreen arena
  - `?` — Quick Controls Reference overlay
- **Mouse + Keyboard Control Styles**: Choose **Arcade (Space + Click)**, **Standard (WASD)**, or **Mouse Steer** and test live in the **Practice Range**.

## Mobile & Tablet PWA App Experience
- **Installable App**: Click **Install** in the header (Android/Chrome/Edge) or follow the built-in iOS Safari **Add to Home Screen** guide. Launches standalone with custom icon (`pwa-512x512.png`, `apple-touch-icon.png`).
- **Offline Play**: Service Worker caches the shell and Phaser assets so **Solo vs Bots** and **Local Party** work without internet.
- **Touch Controls & Layout Editor**:
  - **Twin-Thumb Floating Stick** (left thumb steers with 60% pivot rule; right thumb taps/holds FIRE with optional light aim assist).
  - **Tank Pad Buttons** or **One-Thumb Arcade** modes.
  - Customize stick size, button size, opacity, dead zone, floating/fixed mode, and left-handed swap in **Settings → Touch Controls Layout Editor**.
- **Local Party (Same-Device 2–4 Players)**: Corner hold/tap pads (`Q/P/Z/M` on keyboard or 4-corner touch) with mirrored top-corner HUD labels so players can sit around a tablet or laptop.
