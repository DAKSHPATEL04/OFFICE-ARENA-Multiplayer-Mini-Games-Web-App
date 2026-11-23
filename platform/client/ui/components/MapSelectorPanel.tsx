import React from 'react';
import { Bomb, Droplets, EyeOff, Flame, Footprints, Snowflake, Triangle } from 'lucide-react';
import type { MapDef, ModeDef } from '../../../shared/GameModule.ts';

interface RuleMeta {
  label: string;
  color: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}

const RULE_META: Record<string, RuleMeta> = {
  'lava-hazards': { label: 'Lava 8 DPS', color: '#FF6A2B', Icon: Flame },
  'eruption-vent': { label: 'Erupting Vent', color: '#FFB347', Icon: Flame },
  'center-pyramid': { label: 'Center Pyramid', color: '#E8A24A', Icon: Triangle },
  'rocky-slow': { label: 'Rocky Path 85%', color: '#D7B98A', Icon: Footprints },
  'ice-physics': { label: 'Low-Friction Ice', color: '#8FD3FF', Icon: Snowflake },
  'bush-stealth': { label: 'Bush Stealth', color: '#6CC04A', Icon: EyeOff },
  'swamp-mud': { label: 'Mud Bog 65%', color: '#5AD68D', Icon: Droplets },
  'explosive-barrels': { label: 'Barrels', color: '#FF7847', Icon: Bomb },
};

export function formatBestModes(bestFor: string[], modes: ModeDef[]): string {
  return bestFor
    .map((id) => modes.find((m) => m.id === id)?.name ?? id)
    .join(' · ');
}

export const MapRuleLine: React.FC<{
  ruleTags?: string[];
  compact?: boolean;
}> = ({ ruleTags, compact = false }) => {
  if (!ruleTags || ruleTags.length === 0) return null;
  const items = compact ? ruleTags.slice(0, 2) : ruleTags;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
      {items.map((tag) => {
        const meta = RULE_META[tag];
        if (!meta) return null;
        const Icon = meta.Icon;
        return (
          <span key={tag} className="inline-flex items-center gap-1 whitespace-nowrap" style={{ color: meta.color }}>
            <Icon size={12} className="shrink-0" />
            <span>{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
};

export const MapPreviewCard: React.FC<{
  map?: MapDef;
  resolvedMapId: string;
  previewUrl?: string;
  modeName?: string;
  modes: ModeDef[];
  actionSlot?: React.ReactNode;
  footerText?: string;
}> = ({ map, resolvedMapId, previewUrl, modeName, modes, actionSlot, footerText }) => {
  const accent = map?.accentColor ?? 'var(--accent)';
  const bestLabel = map?.bestFor?.length ? formatBestModes(map.bestFor, modes) : '';
  const seriesLabel = map?.series === 'arena-series' ? 'Arena Series' : 'Classic Arena';

  return (
    <div className="arena-glass rounded-2xl overflow-hidden border border-[var(--border)]">
      {previewUrl && (
        <div
          key={`${resolvedMapId}-${modeName ?? ''}`}
          className="arena-map-preview-in aspect-video w-full bg-black/45 relative"
        >
          <img
            src={previewUrl}
            alt={map?.name ?? 'Map Preview'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ backgroundColor: accent }}
          />
          <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-sm flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: accent }}
              />
              <span className="font-bold text-white truncate">
                {map?.series === 'arena-series' ? map.name : `${resolvedMapId} · ${map?.name ?? 'Arena'}`}
              </span>
              <span className="text-[11px] text-white/60 hidden sm:inline whitespace-nowrap">
                · {seriesLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {modeName && <span className="font-semibold whitespace-nowrap" style={{ color: accent }}>{modeName}</span>}
              {actionSlot}
            </div>
          </div>
        </div>
      )}

      {(map?.ruleTags?.length || bestLabel || footerText) && (
        <div className="px-4 py-2.5 space-y-1.5 border-t border-[var(--border)]">
          {map?.ruleTags && map.ruleTags.length > 0 && <MapRuleLine ruleTags={map.ruleTags} />}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-dim)]">
            {bestLabel && <span>Best for: <strong className="text-[var(--text)]">{bestLabel}</strong></span>}
            {map?.recommendedPlayers && <span className="tabular-nums">{map.recommendedPlayers}</span>}
          </div>
          {footerText && (
            <div className="text-xs font-semibold text-[var(--text-dim)] pt-0.5">
              {footerText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const GroupedMapSelector: React.FC<{
  maps: MapDef[];
  selectedMapId: string;
  modeId: string;
  renderMapPreview?: (mapId: string, modeId: string) => string;
  onSelect: (mapId: string) => void;
  showAuto?: boolean;
  compact?: boolean;
}> = ({ maps, selectedMapId, modeId, renderMapPreview, onSelect, showAuto = true, compact = false }) => {
  const arenaSeries = maps.filter((m) => m.series === 'arena-series');
  const classicMaps = maps.filter((m) => m.series !== 'arena-series');

  const renderTile = (m: MapDef) => {
    const thumb = renderMapPreview?.(m.id, modeId);
    const selected = selectedMapId === m.id;
    const accent = m.accentColor ?? 'var(--accent)';
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => onSelect(m.id)}
        title={`${m.name} — ${m.description}`}
        style={selected ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : undefined}
        className={`rounded-xl border overflow-hidden text-left transition-all duration-150 ${
          selected
            ? 'bg-[var(--surface-2)]'
            : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
        }`}
      >
        {thumb && (
          <div className="aspect-video w-full bg-black/40 relative">
            <img src={thumb} alt={m.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} />
          </div>
        )}
        <div className={compact ? 'px-2 py-1.5 space-y-0.5' : 'p-2 space-y-1'}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-bold text-[var(--text)] truncate`}>
              {m.series === 'arena-series' ? m.name : `${m.id} · ${m.name}`}
            </span>
          </div>
          {!compact && <MapRuleLine ruleTags={m.ruleTags} compact />}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {showAuto && (
        <button
          type="button"
          onClick={() => onSelect('auto')}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
            selectedMapId === 'auto'
              ? 'border-[var(--accent)] bg-[var(--surface-2)]'
              : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-bold text-[var(--accent)] whitespace-nowrap">AUTO</span>
            <span className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">Best Fit for Mode & Player Count</span>
          </div>
          <span className="text-[11px] text-[var(--text-dim)] whitespace-nowrap shrink-0">Recommended</span>
        </button>
      )}

      {arenaSeries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
              Arena Series · Shared Layout, 5 Themes
            </span>
            <span className="text-[11px] text-[var(--text-dim)] whitespace-nowrap">16:9 · 4 Corner Pads</span>
          </div>
          <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {arenaSeries.map(renderTile)}
          </div>
        </div>
      )}

      {classicMaps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
              Classic Arenas
            </span>
            <span className="text-[11px] text-[var(--text-dim)] whitespace-nowrap">Maps A · E · G · H · J</span>
          </div>
          <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {classicMaps.map(renderTile)}
          </div>
        </div>
      )}
    </div>
  );
};
