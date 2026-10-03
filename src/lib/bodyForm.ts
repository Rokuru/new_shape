import { readBia } from '../components/BiaPanel';
import { BIA_FIELDS, SEGMENTS } from './bia';
import type { BodyEntry } from './types';

/** Champs de saisie d'une mesure (hors balance). */
export const BODY_FIELDS: { key: keyof BodyEntry; label: string; hint?: string }[] = [
  { key: 'weightKg', label: 'Poids (kg) *', hint: 'le matin, à jeun, après les toilettes' },
  { key: 'bodyFatPct', label: '% masse grasse', hint: 'balance, pince, DEXA… (prioritaire sur le calcul)' },
  { key: 'waistCm', label: 'Tour de taille (cm)', hint: 'au niveau du nombril, relâché' },
  { key: 'neckCm', label: 'Tour de cou (cm)', hint: 'sous la pomme d’Adam' },
  { key: 'hipCm', label: 'Tour de hanches (cm)', hint: 'au plus large des fessiers' },
  { key: 'chestCm', label: 'Poitrine (cm)' },
  { key: 'armCm', label: 'Bras contracté (cm)' },
  { key: 'thighCm', label: 'Cuisse (cm)' },
];

type Form = Record<string, string>;

const parse = (form: Form, k: string) => {
  const n = Number((form[k] ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Pré-remplit le formulaire avec une mesure existante (pour la modifier). */
export function entryToForm(e: BodyEntry): Form {
  const form: Form = {};
  const str = (n: number | undefined) => (n === undefined ? undefined : String(n).replace('.', ','));
  const put = (k: string, n: number | undefined) => {
    const s = str(n);
    if (s !== undefined) form[k] = s;
  };
  for (const f of BODY_FIELDS) put(f.key, e[f.key] as number | undefined);
  for (const f of BIA_FIELDS) put(`bia.${f.key}`, e.bia?.[f.key]);
  for (const s of SEGMENTS) {
    put(`segFat.${s.key}`, e.bia?.segFat?.[s.key]);
    put(`segMuscle.${s.key}`, e.bia?.segMuscle?.[s.key]);
  }
  if (e.note) form.note = e.note;
  return form;
}

/**
 * Construit une mesure à partir du formulaire, avec les mêmes garde-fous en création et en modification.
 * Renvoie un message d'erreur en français si une valeur est hors limites.
 */
export function buildBodyEntry(form: Form, opts: { id: string; date: string; todayKey: string; tanita: boolean }): { entry: BodyEntry } | { error: string } {
  // Safari iOS n'applique pas l'attribut max du sélecteur de date : on refuse ici une date future.
  if (!opts.date) return { error: 'Choisis une date.' };
  if (opts.date > opts.todayKey) return { error: 'La date est dans le futur : choisis aujourd’hui ou un jour passé.' };
  const weightKg = parse(form, 'weightKg');
  if (!weightKg) return { error: 'Le poids est obligatoire.' };
  if (weightKg < 25 || weightKg > 350) return { error: 'Poids hors limites : entre 25 et 350 kg.' };
  const bf = parse(form, 'bodyFatPct');
  if (bf !== undefined && (bf < 2 || bf > 70)) return { error: '% de masse grasse hors limites : entre 2 et 70 %.' };
  const badCm = BODY_FIELDS.find((f) => f.key.endsWith('Cm') && parse(form, f.key) !== undefined && (parse(form, f.key)! < 10 || parse(form, f.key)! > 250));
  if (badCm) return { error: `${badCm.label} : valeur hors limites (10 à 250 cm).` };

  const entry: BodyEntry = { id: opts.id, date: opts.date, weightKg };
  for (const f of BODY_FIELDS) if (f.key !== 'weightKg' && parse(form, f.key)) (entry as unknown as Record<string, number>)[f.key] = parse(form, f.key)!;
  if (form.note?.trim()) entry.note = form.note.trim();
  if (opts.tanita) {
    // Une valeur de balance hors plage serait ignorée en silence : on prévient plutôt.
    const badBia = BIA_FIELDS.find((f) => {
      const v = parse(form, `bia.${f.key}`);
      return v !== undefined && (v < f.min || v > f.max);
    });
    if (badBia) return { error: `${badBia.label} : valeur hors limites (${badBia.min} à ${badBia.max}).` };
    const bia = readBia(form);
    // Le % de gras saisi en mode balance vient de la bio-impédance.
    if (bia || entry.bodyFatPct !== undefined) entry.bia = bia ?? {};
  }
  return { entry };
}
