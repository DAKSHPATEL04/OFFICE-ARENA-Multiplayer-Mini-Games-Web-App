# Maps & Arena Series Architecture

Tank Arena includes **10 playable maps** grouped into **Arena Series (5 themes)** and **Classic Arenas (5 maps)**. Every map passes automated wall-clearance, solid-circle, and BFS reachability validation (`validateMap`) and works across **Flag**, **Team Fight**, and **Free For All**.

## Arena Series (Shared Layout · 5 Themes)

All 5 Arena Series maps share one procedural **`3440 × 1920`** (`1376 × 768` × `2.5`) collision geometry rendered crisp at **`1720 × 960`** (camera zoom `0.5`) with zero watermarked image overlays:
- Outer fortified perimeter walls with sealed Top/Bottom gates
- **4 circular corner stone platforms** (safe spawn bays for 6v6 teams and 12-tank FFA)
- **Left & Right gate alcoves** guarding the Red & Blue flag pads (`100` world px capture radius)
- Symmetrical **L-shaped and U-shaped inner ruins**, **10 power pads**, and **4 explosive barrels** (`45` blast dmg + knockback, `15s` respawn)

| ID | Name | Accent | Special Rules & Terrain | Best For |
| --- | --- | --- | --- | --- |
| `lava` | Lava Crater | `#FF6A2B` | Glowing lava fissures (`8 DPS` hazard zones), pulsing central eruption vent (`6s` cycle: `1s` warning glow → `25` dmg + knockback), safe corner spawns | Flag, Team Fight |
| `desert` | Desert Ruins | `#E8A24A` | Solid stepped center pyramid obstacle (blocks tanks & bounces shells), rocky pebble path (`0.85×` speed) | Flag, Team Fight, FFA |
| `snow` | Frozen Ruins | `#8FD3FF` | Low-friction ice physics (`0.3` friction + steering lag) across open ice, normal traction on corner platforms & gate alcoves, solid stepped ice pyramid | FFA, Flag |
| `grass` | Green Ruins | `#6CC04A` | Thick bush groves cloak tanks inside stealth circles from enemies > `300` world px unless firing (revealed `2s`) or carrying a flag | Flag, Team Fight, FFA |
| `swamp` | Swamp Ruins | `#5AD68D` | Murky mud bog zones (`0.65×` speed), glowing swamp mushrooms, reeds, and stealth ambush bushes | Team Fight, Flag |

> Press **`F3`** (or open with `?debug=1`) in-match to toggle the collision & zone debug overlay showing solid walls, circular obstacles, hazard/speed zones, bush radii, and spawn points.

## Classic Arenas (`1792 × 828`)

| ID | Name | Theme | Best For |
| --- | --- | --- | --- |
| `A` | Steel Yard | Classic Steel | Balanced steel flanks & center bunkers |
| `E` | Sand Camp | Classic Sand | Destructible brick forts & wide Flag runs |
| `G` | Duel Field | Classic River/Steel | Fast 2–6 player skirmishes & quick rounds |
| `H` | Sand Cross | Classic Sand | X-corridor Team Fight & Flag battles |
| `J` | Grass Blocks | Classic Grass | Bush stealth ambushes & 12-tank FFA |

Spawn points use precomputed safest-point pools (`shared/spawnPool.ts`) guaranteeing `80px` wall clearance on Arena Series maps and `40px` clearance on Classic maps, excluding solid obstacles and lava hazards.
