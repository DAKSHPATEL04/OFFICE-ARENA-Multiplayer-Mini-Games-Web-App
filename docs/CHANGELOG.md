# Changelog

## v6.2.3 — Flat 2D Competitive Arcade In-Game HUD (UI-Only)
- **Flat 2D Interface**: Redesigned the in-game HUD (`MatchViewScreen`) and canvas overlays (`TankArenaScene`) into a crisp, minimal flat 2D arcade interface—removing glass blur, drop-shadows, gradients, and raised bevels while leaving gameplay, controls, physics, weapons, bots, scoring, and maps untouched.
- **Top HUD**: Added a compact 3-cell flat 2D Red vs Blue scoreboard with center `VS` + timer/`SUDDEN DEATH` block, flat FPS/Ping & Flag `Home`/`Taken!`/`Dropped` indicators on the top-left, and uniformly sized flat Sound, `Scores`, and Pause buttons in the top-right.
- **Bottom HUD, Joystick & Minimap**: Replaced the ammo bars with crisp flat 2D bullet SVG icons + numeric counter alongside active power badges, flattened the bottom-center minimap panel (`fillRect` + `1.5px` slate border), and restyled the virtual touch joystick as a clean flat 2D outer ring + inner circle with mobile-safe spacing.

## v6.2.2 — 3 Power Boxes, Protective Shield, 2× Speed, Fireball vs Default Missile & Larger Tanks
- **Increased Tank Size**: Scaled tanks up cleanly (`TANK.radius 24 → 27`, Arena Series `tankScale 1.35 → 1.68`) and widened inner L-to-U corridor clearance so bigger tanks glide through every lane.
- **3 Distinct Map Power Boxes**: Every map now spawns typed, clearly labeled & color-coded boxes (**🛡️ Shield**, **⚡ 2× SPD**, **🔥 FIREBALL**) encoded live in compact snapshots (`boxes` code `1 | 2 | 3`) and rotating cleanly on respawn:
  - **🛡️ Shield Power**: Wraps a glowing cyan energy bubble around the tank for `6s`, blocking opponent shells, barrel blasts, eruption vents, and lava hazards with an impact shockwave flash.
  - **⚡ Speed 2× Power**: Boosts tank movement to `2.0×` speed for `6s` with emerald speed particles.
  - **🔥 Fireball Unlimited Power**: Grants `7s` of unlimited rapid-fire blazing **Fireballs** (`isFireball: 1`, larger `radius 13` / `19` world px glowing orbs with thick flame trails).
- **Default Tank Missile Fire**: Normal ammo now fires crisp pointed **Tank Missiles** (`radius 7`), keeping blazing **Fireballs** exclusive to the Fireball Unlimited power box.

## v6.2.1 — One-Hand Spacebar + Mouse Fire Auto-Spin Controls & Big Shells
- Redesigned default **`PC_ARCADE`** ("Arcade (Space + Click)") for true two-button play with one hand on `Spacebar` and one hand on Mouse (`Left Click`), removing Arrow key dependencies:
  - Tuned tank movement (`145` base speed) and smooth auto-rotation (`100°/s`) for deliberate, easy-to-control steering and timing, with no cluttered aim line on the tank.
  - Holding **`Spacebar`** locks the tank's facing direction and drives straight forward.
  - **`Left Click`** fires a large glowing cannon shell (`radius 9` / `12` world px with bright halo, flame tracer trail, and muzzle blast) and immediately reverses the tank's auto-spin direction (applying recoil kick only when stationary so moving forward stays straight).
- Removed Arrow key steering fallbacks from `PC_ARCADE`, `PC_STANDARD` (`WASD`), and `PC_MOUSE_STEER` (Arrow keys are only bound if explicitly mapped in `PC_CUSTOM`), and updated the `"Space + Mouse (Auto-Spin)"` quick button in **Controls & Practice**.

## v6.2.0 — Arena Series Map Architecture
- Replaced static watermarked map images with procedural/vector **Arena Series** architecture (`3440 × 1920` world scaled cleanly onto `1720 × 960` canvas at `0.5` camera zoom) featuring one shared collision geometry and **5 distinct themes** (`lava` Lava Crater, `desert` Desert Ruins, `snow` Frozen Ruins, `grass` Green Ruins, `swamp` Swamp Ruins), alongside all 5 **Classic Arenas** (`A`, `E`, `G`, `H`, `J`).
- Implemented authentic theme gameplay mechanics in `TankArenaSim` & `TankBotBrain`:
  - **Lava Crater**: `8 DPS` lava fissures, `6s` periodic central eruption vent (`1s` glow warning → `25` dmg + knockback), safe corner spawn platforms.
  - **Desert Ruins**: solid stepped center pyramid obstacle with shell ricochet + `0.85×` rocky pebble path.
  - **Frozen Ruins**: low-friction `0.3` ice physics with steering lag (crisp grip on corner stone platforms & gate alcoves) + stepped center ice pyramid.
  - **Green Ruins & Swamp Ruins**: stealth ambush bushes hiding tanks beyond `300` world px (broken for `2s` on firing or while carrying flags), plus `0.65×` swamp mud bogs.
  - **Explosive Barrels**: destructible barrels dealing `45` area damage + knockback with `15s` respawn.
- Added **`F3`** (or `?debug=1`) collision/zone debug overlay in `TankArenaScene` and clean `520 × 292` (16:9) themed SVG map previews across Lobby, Create Room, Local Party, Solo, and Game Detail screens.
- Upgraded `validateMap()` with `solidCircles` checks, `80px` Arena Series spawn clearance, and BFS reachability verification across spawns, power pads, and flags.

## v6.1.0
- Added dynamic Tank Power (`damagePct` from 10% to 100%, with 100 HP per tank and live overhead HP bars when tanks take multi-hit damage).
- Added `PC_CUSTOM` key & mouse binding mapper (`SettingsStore` + `ControlSetupScreen` + `TankArenaScene`), supporting custom keys like `Space` to move and mouse clicks to fire, persisted automatically.
- Upgraded `CreateRoomScreen`, `LobbyScreen`, `SoloSetupScreen`, `LocalPartySetupScreen`, `HubScreen`, and `GameDetailScreen` with visual map pickers, mode/power configuration, and custom showcase banners.

## v6.0.0
- Built full Office Arena multiplayer platform supporting 2–12 online players, 20 spectators, 2–4 Local Party, and 1–11 Solo vs Bots.
- Implemented Tank Arena with Flag, Team Fight, and Free For All modes across 5 classic symmetrical maps (`A`, `E`, `G`, `H`, `J`).
- Added Arena Glass UI with Dark/Light/High-Contrast themes, `Ctrl/Cmd+K` Command Palette, Practice Range, Touch Controls Layout Editor, and PWA offline support.
- Added Target Sprint (`_template`) proving modular `GameModule` extensibility.
