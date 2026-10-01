/**
 * Dates « calendaires » dans le fuseau de l'appareil.
 *
 * Ne jamais utiliser `toISOString().slice(0, 10)` pour obtenir le jour : c'est la date UTC.
 * En France (UTC+1 l'hiver, UTC+2 l'été), entre minuit et 1 h / 2 h du matin elle donne encore la veille.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Jour local au format AAAA-MM-JJ. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Jour local d'un horodatage ISO (« 2026-10-01T22:30:00.000Z » → « 2026-10-02 » à Paris) ou d'une date AAAA-MM-JJ (inchangée). */
export function dayKey(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : localDate(new Date(iso));
}

/** Minuit local d'une date AAAA-MM-JJ. */
export function parseLocalDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Ajoute `n` jours calendaires (indépendant des changements d'heure). */
export function addDays(day: string, n: number): string {
  const d = parseLocalDate(day);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

/** Nombre de jours calendaires de `from` à `to` (AAAA-MM-JJ), sans effet des journées de 23 h / 25 h. */
export function daysBetween(from: string, to: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}
