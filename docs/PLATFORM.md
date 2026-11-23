# Platform Architecture (`GameModule` Contract)

Office Arena separates platform infrastructure (`/platform/*`) from individual games (`/games/*`). Every game implements the `GameModule` interface in `/platform/shared/GameModule.ts` and is registered with one lazy import line in `/games/registry.ts`.

## Adding a New Game

1. Duplicate `/games/_template` into `/games/<your-game-id>`.
2. Implement `createServerRoom(ctx)` returning a `GameRoom` (`onPlayerJoin`, `onPlayerLeave`, `onInput`, `tick`, `getSnapshot`, `getEvents`, `isFinished`).
3. Implement `createClientScene(ctx)` returning a `GameClient` (`applySnapshot`, `applyEvent`, `setPaused`, `setControlStyle`, `setSpectatorMode`, `resize`, `destroy`).
   - Keep `module.ts` Node-safe (use dynamic `import()` inside a lazy wrapper for browser/Phaser code and static URL paths under `/src/assets/images/` for banners) so `server.ts` and `tools/loadtest.ts` can load `/games/registry.ts` directly in Node 22.
4. Register `() => import('./<your-game-id>/module.ts')` in `/games/registry.ts`.

No changes to `server.ts`, `RoomManager.ts`, `HubScreen.tsx`, `LobbyScreen.tsx`, or `ResultsScreen.tsx` are required—the platform dynamically generates settings forms, control style cards, map previews, scoreboards, and match awards from your `GameModule`.
