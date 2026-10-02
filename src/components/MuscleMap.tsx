import type { Muscle } from '../lib/types';

type Region = { m: Muscle; d: React.ReactNode };

/** Silhouette simplifiée (vue de face et de dos) avec les muscles sollicités en couleur. */
function Body({ regions, primary, secondary, label }: { regions: Region[]; primary: Muscle[]; secondary: Muscle[]; label: string }) {
  const cls = (m: Muscle) => (primary.includes(m) ? 'mm-primary' : secondary.includes(m) ? 'mm-secondary' : 'mm-idle');
  return (
    <figure className="mm-body">
      <svg viewBox="0 0 80 152" role="img" aria-label={label}>
        <g className="mm-base">
          <circle cx={40} cy={12} r={9} />
          <rect x={36} y={19} width={8} height={8} rx={2} />
          <rect x={23} y={25} width={34} height={58} rx={10} />
          <rect x={11} y={29} width={10} height={52} rx={5} />
          <rect x={59} y={29} width={10} height={52} rx={5} />
          <rect x={27} y={80} width={12} height={66} rx={6} />
          <rect x={41} y={80} width={12} height={66} rx={6} />
        </g>
        {regions.map((r, i) => (
          <g key={i} className={cls(r.m)}>
            {r.d}
          </g>
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

const pair = (x1: number, x2: number, cy: number, rx: number, ry: number) => (
  <>
    <ellipse cx={x1} cy={cy} rx={rx} ry={ry} />
    <ellipse cx={x2} cy={cy} rx={rx} ry={ry} />
  </>
);

const FRONT: Region[] = [
  { m: 'shoulders', d: pair(22, 58, 33, 6, 6) },
  { m: 'chest', d: pair(33, 47, 39, 8, 6) },
  { m: 'biceps', d: pair(16, 64, 49, 4, 9) },
  { m: 'abs', d: <rect x={34} y={49} width={12} height={28} rx={4} /> },
  { m: 'quads', d: pair(33, 47, 101, 5.5, 15) },
  { m: 'calves', d: pair(33, 47, 128, 4, 9) },
];
const BACK: Region[] = [
  { m: 'shoulders', d: pair(22, 58, 33, 6, 6) },
  { m: 'back', d: <path d="M27 31h26l-4 38H31z" /> },
  { m: 'triceps', d: pair(16, 64, 49, 4, 9) },
  { m: 'glutes', d: pair(34, 46, 86, 6.5, 6.5) },
  { m: 'hamstrings', d: pair(33, 47, 106, 5.5, 12) },
  { m: 'calves', d: pair(33, 47, 129, 5, 9) },
];

export default function MuscleMap({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  return (
    <div className="mm-row">
      <Body regions={FRONT} primary={primary} secondary={secondary} label="Face" />
      <Body regions={BACK} primary={primary} secondary={secondary} label="Dos" />
    </div>
  );
}
