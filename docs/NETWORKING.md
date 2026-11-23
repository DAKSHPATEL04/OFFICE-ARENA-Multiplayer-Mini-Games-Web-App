# Networking & Authoritative Simulation

- **Server Authority**: `Room.ts` runs `TankArenaSim` at **30 Hz** fixed steps (`1/30 s`) and broadcasts compact integer snapshots at **20 Hz**.
- **Client Interpolation**: `TankArenaScene` interpolates remote tanks smoothly and supports optional network simulation via URL query params `?lag=120&loss=5`.
- **Bandwidth**: Snapshots encode tank positions/angles/ammo/flags as compact integer arrays, keeping per-client bandwidth well under **15 KB/s** even in full 12-player rooms.
- **Resilience & Security**:
  - Per-IP connection limits, per-minute room creation/join limits, and input rate limiting (`120 msg/s`).
  - Passwords hashed with Node `crypto.scryptSync`.
  - 60-second reconnect grace via `oa.playerToken`.
  - `/healthz` endpoint reports uptime, active rooms, and active connections.
