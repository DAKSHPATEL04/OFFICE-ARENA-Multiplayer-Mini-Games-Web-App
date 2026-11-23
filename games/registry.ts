import type { GameModule } from '../platform/shared/GameModule.ts';

export const GAMES: Array<() => Promise<{ default: GameModule }>> = [
  () => import('./tank-arena/module.ts'),
  () => import('./_template/module.ts'),
];
