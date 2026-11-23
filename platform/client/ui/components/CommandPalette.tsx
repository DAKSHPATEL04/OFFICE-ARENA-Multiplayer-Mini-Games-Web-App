import React, { useEffect, useMemo, useState } from 'react';
import { Command, Gamepad2, Hash, Play, Search, Settings, Sliders, SunMoon } from 'lucide-react';
import type { GameModule } from '../../../shared/GameModule.ts';

interface PaletteAction {
  id: string;
  group: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette: React.FC<{
  open: boolean;
  onClose: () => void;
  games: GameModule[];
  onOpenGame: (id: string) => void;
  onJoinCode: (code: string) => void;
  onQuickJoin: (gameId: string) => void;
  onNavigate: (route: string) => void;
  onToggleTheme: () => void;
}> = ({ open, onClose, games, onOpenGame, onJoinCode, onQuickJoin, onNavigate, onToggleTheme }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  const actions = useMemo(() => {
    const q = query.trim();
    const upper = q.toUpperCase();
    const list: PaletteAction[] = [];

    if (/^[A-HJ-NP-Z]{4}$/.test(upper)) {
      list.push({
        id: `join-${upper}`,
        group: 'Join Room',
        label: `Join Room ${upper}`,
        hint: 'Enter',
        icon: <Hash size={16} className="text-[var(--accent)]" />,
        run: () => {
          onJoinCode(upper);
          onClose();
        },
      });
    }

    for (const g of games) {
      list.push({
        id: `game-${g.id}`,
        group: 'Games',
        label: g.meta.name,
        hint: 'Open',
        icon: <Gamepad2 size={16} className="text-[var(--primary-2)]" />,
        run: () => {
          onOpenGame(g.id);
          onClose();
        },
      });
    }

    list.push(
      {
        id: 'act-quick-join',
        group: 'Action',
        label: 'Quick Join Tank Arena',
        hint: 'Join',
        icon: <Play size={16} className="text-[var(--success)]" />,
        run: () => {
          onQuickJoin('tank-arena');
          onClose();
        },
      },
      {
        id: 'act-create',
        group: 'Action',
        label: 'Create Room',
        hint: 'Go',
        icon: <Command size={16} />,
        run: () => {
          onNavigate('create-room');
          onClose();
        },
      },
      {
        id: 'act-controls',
        group: 'Action',
        label: 'Control Setup & Practice Range',
        hint: 'Open',
        icon: <Sliders size={16} />,
        run: () => {
          onNavigate('controls');
          onClose();
        },
      },
      {
        id: 'act-theme',
        group: 'Action',
        label: 'Cycle Theme (Dark / Light / High Contrast)',
        hint: 'Switch',
        icon: <SunMoon size={16} />,
        run: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'act-settings',
        group: 'Navigation',
        label: 'Settings',
        hint: 'Open',
        icon: <Settings size={16} />,
        run: () => {
          onNavigate('settings');
          onClose();
        },
      },
    );

    if (!q) return list;
    const ql = q.toLowerCase();
    return list.filter((a) => a.label.toLowerCase().includes(ql) || a.group.toLowerCase().includes(ql));
  }, [query, games, onOpenGame, onJoinCode, onQuickJoin, onNavigate, onToggleTheme, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => (actions.length ? (s + 1) % actions.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => (actions.length ? (s - 1 + actions.length) % actions.length : 0));
      } else if (e.key === 'Enter' && actions[selected]) {
        e.preventDefault();
        actions[selected].run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, actions, selected, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/65 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="arena-glass bg-[var(--surface-solid)] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <Search size={18} className="text-[var(--text-dim)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            placeholder="Search games, type a 4-letter room code, or run an action..."
            className="w-full bg-transparent text-[var(--text)] placeholder-[var(--text-dim)] outline-none text-base"
          />
          <span className="text-xs font-mono text-[var(--text-dim)] shrink-0">ESC</span>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {actions.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-dim)]">No matching games or commands.</div>
          ) : (
            actions.map((act, idx) => (
              <button
                key={act.id}
                type="button"
                onClick={act.run}
                onMouseEnter={() => setSelected(idx)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors ${
                  idx === selected ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-dim)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {act.icon}
                  <span className="text-xs font-semibold w-20 shrink-0 text-[var(--text-dim)]">{act.group}</span>
                  <span className="font-semibold text-[var(--text)] truncate">{act.label}</span>
                </div>
                <span className="text-xs font-mono text-[var(--text-dim)] shrink-0">{act.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
