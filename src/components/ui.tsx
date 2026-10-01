import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  dumbbell: <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  body: <path d="M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 8h14M12 8v6M9 22l3-8 3 8" />,
  food: <path d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8M7 6h4M17 2c-2 2-2 6 0 8v12" />,
  chart: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  check: <path d="M5 12l5 5L20 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub !== undefined && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-FR', opts);

export const fmtNum = (n: number | undefined, d = 1) => (n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: d }));

export const signed = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n), d)}`;

/** Tooltip commun aux graphiques Recharts. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit = '',
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="t">{typeof label === 'string' ? fmtDate(label, { day: 'numeric', month: 'long', year: 'numeric' }) : label}</div>
      {payload.map((p) => (
        <div key={p.name}>
          <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 6 }} />
          {p.name} : <b>{fmtNum(p.value)}</b>
          {unit}
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={i.dashed ? { background: 'transparent', border: `2px dashed ${i.color}` } : { background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
