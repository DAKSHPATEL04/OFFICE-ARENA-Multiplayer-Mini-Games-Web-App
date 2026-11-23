# Room & Lobby System Guide

## Room Codes & Sharing
- Rooms use **4-letter uppercase codes** from `ABCDEFGHJKMNPQRSTUVWXYZ` (excluding `I`, `O`, `L` to prevent confusion) with profanity filtering.
- Share via **Room Code**, **Direct Invite URL** (`/?room=ABCD`), **Downloadable QR Code**, **WhatsApp**, **Slack/Teams formatted copy**, or native Web Share.

## Visibility, Capacity & Passwords
- **Private Rooms**: Joinable by code, link, or QR only.
- **Open Rooms**: Listed on the **Open Rooms** directory (refreshed every 5s) and eligible for **Quick Join**.
- **Capacity**: 2–12 active players + up to **20 spectators** per room.
- **Passwords**: Optional 4–12 character passwords hashed server-side with `scrypt`.

## Lobby Lifecycle & Host Controls
- **Teams & FFA**: Flag and Team Fight support Red vs Blue up to **6v6** with player self-switching, **Shuffle**, and **Auto-Balance**.
- **Unready Players**: Host can click **Start Match** anytime; unready players watch as spectators for that round and automatically return to their seats afterward.
- **Moderation & Continuity**: Host can **Kick** (60s cooldown), **Ban** (session token ban), **Transfer Host**, or **Close Room**. If the host disconnects, host ownership automatically migrates to the longest-connected player.
- **Reconnect & Late Join**: Disconnected players have a **60-second grace window** to reconnect seamlessly via `sessionStorage` token. Late joiners can enter mid-match when `allowLateJoin` is enabled.
