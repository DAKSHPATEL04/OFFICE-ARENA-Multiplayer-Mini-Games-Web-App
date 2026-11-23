# Games, Modes & Tank Power

## Office Arena Platform Flow
1. **Games Hub**: Browse playable games (**Tank Arena**, **Target Sprint**) or enter a 4-letter room code.
2. **Game Detail**: Pick a mode, inspect all **10 arenas** (5 **Arena Series** themes + 5 **Classic Arenas**) with live `520×292` previews and rule tags, or jump directly into **Create Room**, **Solo vs Bots**, or **Local Party** on a chosen map.
3. **Room Creation & Lobby**: Pre-configure **Mode**, **Arena Map**, **Tank Power (`damagePct`)**, **Speed %**, and **Bots** before creating a room, or fine-tune everything live in the Lobby.

## Tank Arena Modes

### 1. Flag (Default)
- Two bases (**Red** and **Blue**) each guard a flag pad inside the left/right gate alcoves.
- Carry the enemy flag back to your own pad to score!
- Flag carriers move at **90% speed** and remain visible even in stealth bushes. Touching a dropped friendly flag returns it to base immediately; unclaimed dropped flags auto-return after 10 seconds.
- Optional **Own Flag Must Be Home** toggle for classic competitive rules.

### 2. Team Fight
- Red vs Blue team battle (up to **6v6**).
- Score points by destroying enemy tanks until reaching the target score or leading when the timer expires.

### 3. Free For All (FFA)
- Up to **12 tanks** competing individually across spaced corner & courtyard spawns.
- Every takedown scores **+1 point**; highest score wins (or **Sudden Death** on ties).

## Dynamic Tank Power (`damagePct`)
- Every tank spawns with **100 HP**.
- Configure **Tank Power (Shell Damage %)** from `10%` to `100%` (quick presets: `25% · 4 hits`, `35% · 3 hits`, `50% · 2 hits`, `100% · 1 hit`):
  - **100%**: 1 hit destroys an enemy tank immediately.
  - **50%**: 2 hits to destroy.
  - **30%–35%**: 3–4 hits to destroy, displaying live HP bars above damaged tanks.

## Power-Ups, Hazards & Arena World
- **Default Weapon — Tank Missile**: Every tank fires crisp standard missiles from a 5-shot rack (`1.5s` reload per missile).
- **3 Distinct Map Power Boxes**:
  - **🛡️ Shield Power (Cyan-Blue Box)**: Wraps a glowing protective Shield bubble around your tank for **6 seconds**, blocking opponent attacks and hazards on impact.
  - **⚡ Speed 2× Power (Teal-Green Box)**: Boosts tank movement to **2× speed** for **6 seconds**.
  - **🔥 Fireball Unlimited Power (Orange-Gold Box)**: Grants **unlimited rapid-fire blazing Fireballs** (`0.14s` cooldown, oversized fiery projectiles) for **7 seconds**.
- **Destructibles**: Brick walls take **2 hits**; wooden crates take **1 hit** (`40%` power-up drop chance); **Explosive Barrels** detonate for **45 area damage** + knockback and respawn every **15s**.
- **Theme Mechanics**: Lava fissures (`8 DPS`) & erupting magma vents (`25` dmg), low-friction ice drift (`snow`), rocky/mud speed zones (`desert`/`swamp`), and stealth bushes (`grass`/`swamp`).

## PC Controls (One-Hand Spacebar + One-Hand Mouse)
- **Arcade (`PC_ARCADE`, Default)**:
  - **Auto-Rotate**: Your tank rotates smoothly (`100°/s`) on its own while `Spacebar` is released.
  - **Hold `Spacebar`**: Stops rotation and drives forward along the direction your tank is facing (no arrow keys or `A`/`D` needed).
  - **Left Mouse Click**: Fires a high-visibility cannon shell and reverses your tank's auto-rotation direction (`clockwise ↔ counter-clockwise`).
- **Alternative PC Styles**: **Standard (`WASD`)**, **Mouse Steer**, and **Custom Keys & Mouse** (key mapper) remain available in **Controls & Practice**.

