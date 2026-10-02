import { useId } from 'react';

/**
 * Logo New Shape : un kettlebell (la musculation) traversé par une courbe qui monte (la progression).
 * Même dessin que public/icon.svg, en couleur sur fond transparent.
 */
export function LogoMark({ size = 32, mono = false }: { size?: number; mono?: boolean }) {
  // Identifiant de dégradé unique, sans caractères spéciaux (useId en génère) pour rester valide dans url(#…).
  const id = 'ns-logo-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const fill = mono ? 'currentColor' : `url(#${id})`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      {!mono && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--brand-blue)' }} />
            <stop offset="1" style={{ stopColor: 'var(--brand-green)' }} />
          </linearGradient>
        </defs>
      )}
      <path d="M18 35L16 21Q15 8.5 27 8.5H37Q49 8.5 48 21L46 35" fill="none" stroke={fill} strokeWidth={7.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.6 58.5A21.5 19.5 0 1 1 43.4 58.5Z" fill={fill} />
      <path d="M19.5 48L27 41.5L32 46L41 37.5" fill="none" style={{ stroke: 'var(--logo-ink)' }} strokeWidth={5.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47.2 31.4L45.2 41.6L37.4 33.8Z" style={{ fill: 'var(--logo-ink)', stroke: 'var(--logo-ink)' }} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

/** Logo complet : pictogramme + « NEW SHAPE » en Barlow Condensed italique. */
export default function Logo({ size = 30, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <span className="logo" aria-label="New Shape">
      <LogoMark size={size} />
      {!compact && (
        <span className="logo-word" style={{ fontSize: size * 0.8 }} aria-hidden>
          New <b>Shape</b>
        </span>
      )}
    </span>
  );
}
