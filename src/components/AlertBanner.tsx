import type { Alert, StatusLevel } from '../types/farm';

const COLORS: Record<StatusLevel, { bg: string; border: string; color: string }> = {
  safe: { bg: '#ecfdf3', border: '#bbf0d0', color: '#16a34a' },
  warn: { bg: '#fff7ed', border: '#fde3b8', color: '#b45309' },
  danger: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
};

export default function AlertBanner({ alert }: { alert: Alert }) {
  const c = COLORS[alert.level];
  return (
    <div
      className="flex gap-2.5 items-start rounded-2xl px-4 py-3 mb-3"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-px">
        <path d="M12 3L2 20h20L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
      </svg>
      <div className="text-sm font-semibold leading-relaxed">{alert.message}</div>
    </div>
  );
}
