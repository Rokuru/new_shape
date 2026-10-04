/**
 * Axe de temps régulier pour les graphiques : les dates deviennent des nombres (jours UTC), si bien que
 * deux pesées à 3 mois d'écart sont espacées comme 3 mois, et non comme deux pesées consécutives.
 */

export type ChartRange = 'all' | '5y' | '1y' | '6m';

export const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '6m', label: '6 mois' },
  { value: '1y', label: '1 an' },
  { value: '5y', label: '5 ans' },
  { value: 'all', label: 'Tout' },
];

const RANGE_MONTHS: Record<Exclude<ChartRange, 'all'>, number> = { '6m': 6, '1y': 12, '5y': 60 };
const DAY = 86_400_000;

/** Jour YYYY-MM-DD → horodatage UTC à minuit (indépendant du fuseau). */
export const dayToTime = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));

const timeToDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Premier jour inclus pour la période choisie (undefined = tout). */
export function rangeStart(range: ChartRange, today: string): string | undefined {
  if (range === 'all') return undefined;
  const d = new Date(dayToTime(today));
  d.setUTCMonth(d.getUTCMonth() - RANGE_MONTHS[range]);
  return timeToDay(d.getTime());
}

/** Garde les points de la période et leur ajoute `t` (horodatage) pour l'axe numérique. */
export function inRange<T extends { date: string }>(data: T[], range: ChartRange, today: string): (T & { t: number })[] {
  const start = rangeStart(range, today);
  return data.filter((d) => start === undefined || d.date >= start).map((d) => ({ ...d, t: dayToTime(d.date) }));
}

/**
 * Insère une ligne vide au milieu de chaque interruption de plus de `maxGapDays` jours, pour couper la courbe
 * (avec `connectNulls={false}`) au lieu de relier deux mesures séparées de plusieurs années.
 */
export function breakGaps<T extends { date: string; t: number }>(data: T[], maxGapDays = 90): (T | { date: string; t: number })[] {
  const out: (T | { date: string; t: number })[] = [];
  data.forEach((d, i) => {
    const prev = data[i - 1];
    if (prev && d.t - prev.t > maxGapDays * DAY) {
      const t = prev.t + Math.round((d.t - prev.t) / 2 / DAY) * DAY;
      out.push({ date: timeToDay(t), t });
    }
    out.push(d);
  });
  return out;
}

export interface TimeAxis {
  domain: [number, number];
  ticks: number[];
  format: (t: number) => string;
}

const fmt = (t: number, opts: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString('fr-FR', { ...opts, timeZone: 'UTC' });

/**
 * Graduations régulières adaptées à la durée affichée :
 * semaines (≤ 2 mois), puis 1, 2, 3 ou 6 mois, puis années ; toujours au 1er du mois ou au lundi.
 */
export function timeAxis(times: number[]): TimeAxis {
  const min = Math.min(...times);
  const max = Math.max(...times);
  const spanDays = (max - min) / DAY;
  const ticks: number[] = [];

  if (spanDays <= 62) {
    const step = spanDays <= 21 ? 7 : 14;
    // Premier lundi à partir du début.
    const first = new Date(min);
    first.setUTCDate(first.getUTCDate() + ((8 - first.getUTCDay()) % 7));
    for (let t = first.getTime(); t <= max; t += step * DAY) ticks.push(t);
    return { domain: [min, max], ticks, format: (t) => fmt(t, { day: 'numeric', month: 'short' }) };
  }

  const months = spanDays <= 250 ? 1 : spanDays <= 450 ? 2 : spanDays <= 1000 ? 3 : spanDays <= 2000 ? 6 : 12;
  const start = new Date(min);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth() + 1; // premier 1er du mois après le début
  if (m === 12) {
    m = 0;
    y++;
  }
  // Aligner sur le pas (janvier, avril… pour 3 mois ; janvier pour 1 an).
  while (m % months !== 0) {
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  for (let t = Date.UTC(y, m, 1); t <= max; ) {
    ticks.push(t);
    m += months;
    y += Math.floor(m / 12);
    m %= 12;
    t = Date.UTC(y, m, 1);
  }
  if (months === 12) return { domain: [min, max], ticks, format: (t) => fmt(t, { year: 'numeric' }) };
  // Mois abrégé, avec l'année sur janvier et sur la première graduation.
  return {
    domain: [min, max],
    ticks,
    format: (t) => {
      const d = new Date(t);
      return d.getUTCMonth() === 0 || t === ticks[0] ? fmt(t, { month: 'short', year: '2-digit' }) : fmt(t, { month: 'short' });
    },
  };
}

/** Période mémorisée par graphique (confort local, sans incidence si le stockage est indisponible). */
export function loadRange(key: string, fallback: ChartRange): ChartRange {
  try {
    const v = localStorage.getItem(`new-shape-range-${key}`);
    return RANGE_OPTIONS.some((o) => o.value === v) ? (v as ChartRange) : fallback;
  } catch {
    return fallback;
  }
}

export function saveRange(key: string, range: ChartRange) {
  try {
    localStorage.setItem(`new-shape-range-${key}`, range);
  } catch {
    /* stockage indisponible */
  }
}
