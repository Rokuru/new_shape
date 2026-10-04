import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  dumbbell: <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  body: <path d="M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 8h14M12 8v6M9 22l3-8 3 8" />,
  food: <path d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8M7 6h4M17 2c-2 2-2 6 0 8v12" />,
  chart: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  users: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21a8 8 0 0 1 16 0M16 3.1a4 4 0 0 1 0 7.8M23 21a8 8 0 0 0-5-7.4" />,
  check: <path d="M5 12l5 5L20 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  scale: <path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM8 10a4 4 0 0 1 8 0M12 10l2-2.5" />,
  drop: <path d="M12 3l5.4 6a7.2 7.2 0 1 1-10.8 0z" />,
  // Buste avec un mètre ruban à la taille : masse grasse.
  waist: <path d="M8.5 2.5C8.5 6 5 8 5 12.5S7.5 19 8.5 21.5M15.5 2.5C15.5 6 19 8 19 12.5S16.5 19 15.5 21.5M5 11h14v3H5zM9 11v1.5M12 11v1.5M15 11v1.5" />,
  flame: <path d="M12 22c3.9 0 7-2.8 7-6.6 0-3.1-1.9-5.2-3.5-7-.5 1.6-1.4 2.6-2.6 3.1.4-3.4-1.4-6.3-4-8.5-.2 3.5-1.9 5.5-3.3 7.2C4.6 11.4 5 12.9 5 15.4 5 19.2 8.1 22 12 22z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  walk: <path d="M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9 21l2.5-6.5L14 17v4M7.5 11l2.5-3.5 4 1 2.5 3.5M10 7.5l1.5 7" />,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  calendar: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-5M12 8h.01" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.4 5.7M20 4v7h-7" />,
  filter: <path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  compare: <path d="M8 3v18M16 3v18M3 8l5-5 5 5M11 16l5 5 5-5" />,
  copy: <path d="M9 9h11v11H9zM5 15H4V4h11v1" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  target: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function Tile({ label, value, sub, icon, tone = 'blue' }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: string; tone?: 'blue' | 'green' }) {
  return (
    <div className={`tile ${icon ? `tone-${tone}` : ''}`}>
      <div className="tile-head">
        <div className="label">{label}</div>
        {icon && (
          <span className="tile-icon">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
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
  payload?: { name?: string; dataKey?: unknown; value?: number; color?: string; payload?: { date?: unknown } }[];
  label?: string | number;
  unit?: string;
}) {
  // L'abscisse numérique (`t`) d'un nuage de points n'est pas une valeur à afficher.
  payload = payload?.filter((p) => p.dataKey !== 't' && p.value !== undefined && p.value !== null);
  if (!active || !payload?.length) return null;
  // Axe de temps numérique : la date lisible est dans le point lui-même.
  const date = typeof label === 'string' ? label : typeof payload[0].payload?.date === 'string' ? payload[0].payload.date : undefined;
  return (
    <div className="tooltip">
      <div className="t">{date !== undefined ? fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' }) : label}</div>
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
