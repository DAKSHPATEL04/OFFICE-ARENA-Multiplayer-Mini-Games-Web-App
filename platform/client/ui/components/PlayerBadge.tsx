import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Anchor,
  Award,
  Bot,
  Check,
  Compass,
  Copy,
  Crown,
  Download,
  Flame,
  Gem,
  Ghost,
  Heart,
  Rocket,
  Share2,
  Shield,
  Star,
  Sun,
  Sword,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { PLAYER_COLORS } from '../../../shared/config.ts';

export const ProfileIconSvg: React.FC<{ iconId: string; size?: number; className?: string }> = ({
  iconId,
  size = 18,
  className = '',
}) => {
  const props = { size, className };
  switch (iconId) {
    case 'flame':
      return <Flame {...props} />;
    case 'zap':
      return <Zap {...props} />;
    case 'star':
      return <Star {...props} />;
    case 'crown':
      return <Crown {...props} />;
    case 'target':
      return <Target {...props} />;
    case 'rocket':
      return <Rocket {...props} />;
    case 'sword':
      return <Sword {...props} />;
    case 'compass':
      return <Compass {...props} />;
    case 'anchor':
      return <Anchor {...props} />;
    case 'gem':
      return <Gem {...props} />;
    case 'award':
      return <Award {...props} />;
    case 'ghost':
      return <Ghost {...props} />;
    case 'bot':
      return <Bot {...props} />;
    case 'heart':
      return <Heart {...props} />;
    case 'sun':
      return <Sun {...props} />;
    default:
      return <Shield {...props} />;
  }
};

export const ShapeColorBadge: React.FC<{ colorId: string; size?: number }> = ({ colorId, size = 18 }) => {
  const def = PLAYER_COLORS.find((c) => c.id === colorId) ?? PLAYER_COLORS[0];
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-full border border-black/40"
      style={{ width: size, height: size, backgroundColor: def.hex }}
      title={`${def.name} (${def.shape})`}
      aria-label={`${def.name} ${def.shape}`}
    >
      <span className="text-[9px] font-bold text-black/75 leading-none select-none">
        {def.shape === 'circle'
          ? '●'
          : def.shape === 'square'
            ? '■'
            : def.shape === 'triangle'
              ? '▲'
              : def.shape === 'diamond'
                ? '◆'
                : def.shape === 'star'
                  ? '★'
                  : '⬢'}
      </span>
    </span>
  );
};

export interface ToastItem {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export const ToastStack: React.FC<{ toasts: ToastItem[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.slice(0, 3).map((t) => {
        const ring =
          t.level === 'error'
            ? 'border-[#FF4D6D]'
            : t.level === 'warning'
              ? 'border-[#FFC83D]'
              : t.level === 'success'
                ? 'border-[#3DDC97]'
                : 'border-[var(--primary)]';
        return (
          <div
            key={t.id}
            onClick={() => onDismiss(t.id)}
            className={`pointer-events-auto arena-glass rounded-xl px-4 py-3 border ${ring} flex items-center justify-between gap-3 cursor-pointer`}
            role="status"
          >
            <span className="text-sm font-semibold text-[var(--text)]">{t.text}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="text-[var(--text-dim)] hover:text-[var(--text)] shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="arena-glass bg-[var(--surface-solid)] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold text-[var(--text)]">{title}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};

export const ShareInvitePanel: React.FC<{
  code: string;
  gameName: string;
  bigQr?: boolean;
  onCopied?: (msg: string) => void;
}> = ({ code, gameName, bigQr = false, onCopied }) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<'code' | 'link' | 'slack' | null>(null);

  const joinLink = typeof window !== 'undefined' ? `${window.location.origin}/?room=${code}` : `/?room=${code}`;
  const inviteText = `Join my ${gameName} match! Room code: ${code}. Link: ${joinLink}`;

  useEffect(() => {
    QRCode.toDataURL(joinLink, {
      width: bigQr ? 260 : 180,
      margin: 2,
      color: { dark: '#0B1020', light: '#F4F6FF' },
    })
      .then(setQrUrl)
      .catch(() => {});
  }, [joinLink, bigQr]);

  const copyText = async (text: string, field: 'code' | 'link' | 'slack', label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
      onCopied?.(`${label} copied!`);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${gameName} — Room ${code}`, text: inviteText, url: joinLink });
      } catch {}
    } else {
      await copyText(inviteText, 'link', 'Invite message');
    }
  };

  const downloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `office-arena-${code}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--text-dim)]">Room Code</div>
          <div className="text-4xl font-bold tracking-[0.2em] font-display text-[var(--accent)] tabular-nums">
            {code}
          </div>
        </div>
        {qrUrl && (
          <div className="flex flex-col items-center gap-2">
            <img
              src={qrUrl}
              alt={`QR code for room ${code}`}
              className={`rounded-xl border border-[var(--border)] ${bigQr ? 'w-44 h-44' : 'w-28 h-28'}`}
            />
            <button
              type="button"
              onClick={downloadQr}
              className="text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] inline-flex items-center gap-1"
            >
              <Download size={14} /> Save QR
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => copyText(code, 'code', 'Room code')}
          className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {copiedField === 'code' ? <Check size={16} className="text-[var(--success)]" /> : <Copy size={16} />}
          Copy Code
        </button>
        <button
          type="button"
          onClick={() => copyText(joinLink, 'link', 'Invite link')}
          className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] hover:brightness-110 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {copiedField === 'link' ? <Check size={16} className="text-[var(--success)]" /> : <Copy size={16} />}
          Copy Link
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2.5 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 hover:bg-[#25D366]/30 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={handleNativeShare}
          className="px-3 py-2.5 rounded-xl arena-btn-primary text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Share2 size={16} />
          Share
        </button>
      </div>

      <button
        type="button"
        onClick={() => copyText(inviteText, 'slack', 'Slack / Teams invite')}
        className="w-full py-2.5 px-4 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-2)] text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
      >
        {copiedField === 'slack' ? 'Copied for Slack / Teams!' : 'Copy formatted message for Slack / Teams'}
      </button>
    </div>
  );
};
