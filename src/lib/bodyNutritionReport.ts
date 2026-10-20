import { ACTIVITY_FACTORS, ACTIVITY_LABELS, ageFrom, composition, currentComposition, nutritionTargets, weightTrend } from './calc';
import { addDays, daysBetween, firstOfMonth, parseLocalDate } from './dates';
import { deficitTally, KCAL_PER_KG, type DeficitDay } from './deficit';
import { activityAverage } from './energy';
import { mondayOf } from './foodHistory';
import type { BodyEntry, CardioEntry, FoodEntry, Profile, Workout } from './types';

export interface BodyNutritionData {
  profile: Profile;
  body: BodyEntry[];
  food: FoodEntry[];
  workouts: Workout[];
  cardio: CardioEntry[];
  kcalAdjust: number;
}

const n = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
const signed = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n(Math.abs(v), d)}`;
const opt = (v: number | undefined, d = 1) => (v === undefined ? '—' : n(v, d));
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;
const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => firstOfMonth(parseLocalDate(day).toLocaleDateString('fr-FR', opts));
const longDay = (day: string) => fmt(day, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = (day: string) => fmt(day, { day: 'numeric', month: 'short' });
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const BRIEF = `## Ce que je te demande
Tu es expert en nutrition et en perte de gras, rigoureux et fondé sur les preuves. Voici mes pesées et ma nutrition jour par jour, exportées de mon appli de suivi « New Shape ». Réponds en français, de façon concrète et chiffrée :

1. **Suis-je bien en déficit tout le long ?** Jour par jour et semaine par semaine : repère les jours et les périodes en surplus ou proches de la maintenance.
2. **Le poids suit-il le déficit ?** Compare la perte attendue (déficit cumulé ÷ 7 700 kcal par kg de gras) à l'évolution réelle du poids lissé et de la masse grasse. S'il y a un écart, explique d'où il peut venir : repas oubliés ou sous-estimés, dépense surestimée, eau et glycogène, sel, transit, pesées irrégulières, % de gras par impédancemètre peu fiable…
3. **Ce qui va bien, ce qui ne va pas** : régularité des apports, protéines, week-ends, jours avec ou sans sport, fiabilité de mon suivi.
4. **Que faire** : 3 actions précises et chiffrées pour les 2 prochaines semaines.

Distingue ce qui est mesuré (pesées, repas notés) de ce qui est estimé (dépense, % de gras), et appuie-toi sur les tendances plutôt que sur une pesée isolée.`;

/**
 * Pesées et nutrition jour par jour, du `from` à `today`, en texte à donner à une IA : le profil en tête (taille, poids,
 * âge, métabolisme de base), puis un tableau daté avec la pesée et le déficit compté comme dans l'app
 * (voir lib/deficit), un résumé semaine par semaine et la synthèse de la période.
 */
export function bodyNutritionReport(data: BodyNutritionData, from: string, today: string): string {
  const { profile, kcalAdjust } = data;
  const start = from > today ? today : from;
  const days: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) days.push(d);
  const past = days.filter((d) => d < today);
  const asOf = new Date(parseLocalDate(today).getTime() + 12 * 3_600_000);
  const factor = ACTIVITY_FACTORS[profile.activity];

  const body = data.body.filter((e) => e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const latest = body.at(-1);
  const comp = currentComposition(body, profile);
  const act = comp ? activityAverage({ workouts: data.workouts, cardio: data.cardio, profile, bodyFatPct: comp.bodyFatPct }, comp.weightKg, asOf) : undefined;
  const t = latest && comp && act ? nutritionTargets(profile, { ...latest, weightKg: comp.weightKg }, comp.bodyFatPct, kcalAdjust, act.perDay) : undefined;

  // Même calcul que le compteur « Calories à perdre », sur la période choisie.
  const tally = deficitTally(data, start, today);
  const counted = new Map(tally.days.map((d) => [d.date, d]));
  const partial = new Set(tally.partial);
  const kcalOn = new Map<string, number>();
  const proteinOn = new Map<string, number>();
  for (const f of data.food) {
    if (f.date < start || f.date > today) continue;
    kcalOn.set(f.date, (kcalOn.get(f.date) ?? 0) + f.kcal);
    if (f.proteinG !== undefined) proteinOn.set(f.date, (proteinOn.get(f.date) ?? 0) + f.proteinG);
  }
  // Tendance calculée sur tout l'historique : le lissage du premier jour tient compte des pesées d'avant.
  const trend = new Map(weightTrend(body).map((x) => [x.date, x.trend]));
  const weighIns = body.filter((e) => e.date >= start);
  const weighIn = new Map(weighIns.map((e) => [e.date, e]));
  const compOn = (d: string) => {
    const e = weighIn.get(d);
    return e ? composition(e, profile) : undefined;
  };

  const out: string[] = [];
  const line = (s = '') => out.push(s);
  const y0 = parseLocalDate(start).getFullYear();
  const y1 = parseLocalDate(today).getFullYear();
  line(`# Mes pesées et ma nutrition, du ${fmt(start, { day: 'numeric', month: 'long', year: y0 !== y1 ? 'numeric' : undefined })} au ${longDay(today)} (${plural(days.length, 'jour')})`);

  // ---------- Profil ----------
  line();
  line('## Mon profil');
  line(`- Sexe : ${profile.sex === 'male' ? 'homme' : 'femme'}`);
  line(`- Âge : ${ageFrom(profile.birthYear, asOf)} ans`);
  line(`- Taille : ${profile.heightCm} cm`);
  if (latest && comp) line(`- Poids : ${n(latest.weightKg)} kg à la dernière pesée (${longDay(latest.date)}) ; poids lissé ${n(comp.weightKg)} kg`);
  else line('- Poids : aucune pesée enregistrée');
  if (comp?.bodyFatPct !== undefined && comp.bfDate) {
    const src = body.find((e) => e.date === comp.bfDate);
    const how = src?.bia ? 'balance à impédancemètre' : src?.bodyFatPct !== undefined ? 'valeur saisie' : 'mensurations, méthode US Navy';
    line(`- Masse grasse : ${n(comp.bodyFatPct)} % (${how}, ${longDay(comp.bfDate)}), soit ${n(comp.fatKg ?? 0)} kg de gras et ${n(comp.leanKg ?? 0)} kg de masse maigre`);
  }
  if (t && act) {
    const scale = latest?.bia?.kcal;
    line(`- Métabolisme de base : ${n(t.bmr, 0)} kcal/jour (formule ${t.method})${scale ? ` ; la balance affiche ${n(scale, 0)} kcal` : ''}`);
    line(`- Activité hors sport : ${ACTIVITY_LABELS[profile.activity].toLowerCase()}, soit un facteur de ${n(factor, 3)}`);
    line(`- Dépense estimée : ${n(t.bmr * factor, 0)} kcal/jour hors sport (métabolisme de base × ${n(factor, 3)}) ; ${n(t.tdee, 0)} kcal/jour avec mon sport moyen récent (+${n(act.perDay, 0)} kcal/jour)`);
    line(`- Cible de l'app : ${n(t.calories, 0)} kcal/jour et ${t.proteinG} g de protéines${kcalAdjust ? ` (ajustement de ${signed(kcalAdjust)} kcal inclus)` : ''}`);
  }
  const targets = [
    profile.targetWeightKg !== undefined ? `${n(profile.targetWeightKg)} kg` : undefined,
    profile.targetBodyFatPct !== undefined ? `${n(profile.targetBodyFatPct)} % de masse grasse` : undefined,
  ].filter(Boolean);
  if (targets.length) line(`- Objectif : ${targets.join(' et ')}`);

  line();
  line(BRIEF);

  // ---------- Jour par jour ----------
  line();
  line('## Jour par jour');
  line(
    `Déficit = dépense estimée − calories mangées : positif = déficit, négatif = surplus. Dépense estimée = métabolisme de base du jour × ${n(factor, 3)} + sport du jour (séances et marche notées). « — » : pas de donnée.`,
  );
  line();
  const dayLabel = (d: string) =>
    parseLocalDate(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: y0 !== y1 ? '2-digit' : undefined }) + (d === today ? ' (aujourd’hui)' : '');
  const eatenCell = (d: string) => {
    const kcal = kcalOn.get(d);
    if (kcal === undefined) return d === today ? '—' : 'non noté';
    return `${n(kcal, 0)}${d === today ? ' (en cours)' : partial.has(d) ? ' (incomplet ?)' : ''}`;
  };
  const deficitCell = (d: string) => {
    const c = counted.get(d);
    if (c) return signed(c.deficit);
    if (d === today) return 'journée en cours';
    return kcalOn.has(d) ? 'non compté' : '—';
  };
  const cols: { head: string; cell: (d: string) => string }[] = [
    { head: 'Date', cell: dayLabel },
    { head: 'Poids (kg)', cell: (d) => opt(weighIn.get(d)?.weightKg) },
    { head: 'Poids lissé (kg)', cell: (d) => (weighIn.has(d) ? opt(trend.get(d)) : '—') },
  ];
  if (weighIns.some((e) => composition(e, profile).bodyFatPct !== undefined))
    cols.push({ head: 'Gras (%)', cell: (d) => opt(compOn(d)?.bodyFatPct) }, { head: 'Masse grasse (kg)', cell: (d) => opt(compOn(d)?.fatKg) });
  if (weighIns.some((e) => e.bia?.muscleKg !== undefined)) cols.push({ head: 'Muscle (kg)', cell: (d) => opt(weighIn.get(d)?.bia?.muscleKg) });
  if (weighIns.some((e) => e.bia?.waterPct !== undefined)) cols.push({ head: 'Eau (%)', cell: (d) => opt(weighIn.get(d)?.bia?.waterPct) });
  cols.push(
    { head: 'Mangé (kcal)', cell: eatenCell },
    { head: 'Protéines (g)', cell: (d) => opt(proteinOn.get(d), 0) },
    { head: 'Sport (kcal)', cell: (d) => opt(counted.get(d)?.sport, 0) },
    { head: 'Dépense (kcal)', cell: (d) => opt(counted.get(d)?.burned, 0) },
    { head: 'Déficit (kcal)', cell: deficitCell },
  );
  line(`| ${cols.map((c) => c.head).join(' | ')} |`);
  line(`|${cols.map(() => '---').join('|')}|`);
  for (const d of days) line(`| ${cols.map((c) => c.cell(d)).join(' | ')} |`);

  // ---------- Semaine par semaine ----------
  line();
  line('## Semaine par semaine');
  line('| Semaine | Jours comptés | Mangé (moy./jour) | Protéines (moy./jour) | Déficit (moy./jour) | Déficit total | Poids lissé |');
  line('|---|---|---|---|---|---|---|');
  const weeks = new Map<string, string[]>();
  for (const d of days) {
    const monday = mondayOf(d);
    weeks.set(monday, [...(weeks.get(monday) ?? []), d]);
  }
  for (const ds of weeks.values()) {
    const c = ds.map((d) => counted.get(d)).filter((x): x is DeficitDay => x !== undefined);
    const done = ds.filter((d) => d < today).length;
    const prot = c.map((x) => proteinOn.get(x.date)).filter((v): v is number => v !== undefined);
    const tr = ds.filter((d) => weighIn.has(d)).map((d) => trend.get(d)).filter((v): v is number => v !== undefined);
    const label = ds.length > 1 ? `du ${shortDay(ds[0])} au ${shortDay(ds.at(-1)!)}` : `le ${shortDay(ds[0])}`;
    line(
      `| ${label} | ${done ? `${c.length}/${done}` : 'en cours'} | ${c.length ? `${n(mean(c.map((x) => x.eaten)), 0)} kcal` : '—'} | ${prot.length ? `${n(mean(prot), 0)} g` : '—'} | ${
        c.length ? `${signed(mean(c.map((x) => x.deficit)))} kcal` : '—'
      } | ${c.length ? `${signed(c.reduce((s, x) => s + x.deficit, 0))} kcal` : '—'} | ${tr.length > 1 ? `${n(tr[0])} → ${n(tr.at(-1)!)} kg` : tr.length ? `${n(tr[0])} kg` : '—'} |`,
    );
  }

  // ---------- Synthèse ----------
  line();
  line('## Synthèse de la période (calculée par l’app)');
  const missing = past.filter((d) => !kcalOn.has(d)).length;
  const left = [
    missing ? `${plural(missing, 'jour')} sans repas noté` : undefined,
    tally.partial.length ? `${plural(tally.partial.length, 'jour')} incomplet${tally.partial.length > 1 ? 's' : ''} (moins de la moitié du métabolisme de base noté)` : undefined,
  ].filter(Boolean);
  line(`- Jours comptés dans le déficit : ${tally.days.length} sur ${plural(past.length, 'jour')} passé${past.length > 1 ? 's' : ''}.${left.length ? ` Non comptés : ${left.join(', ')}.` : ''} Aujourd’hui n’est pas compté, la journée n’est pas finie.`);
  if (!latest) line('- Aucune pesée : sans poids, l’app ne peut pas estimer la dépense ni le déficit.');
  if (tally.days.length) {
    const surplus = tally.days.filter((d) => d.deficit < 0);
    line(`- Déficit cumulé : ${signed(tally.total)} kcal, soit environ ${n(tally.total / KCAL_PER_KG, 2)} kg de gras (÷ 7 700).`);
    line(
      `- Déficit moyen : ${signed(tally.total / tally.days.length)} kcal/jour ; ${
        surplus.length ? `${plural(surplus.length, 'jour')} en surplus : ${surplus.map((d) => `${dayLabel(d.date)} (${signed(d.deficit)})`).join(', ')}` : 'aucun jour en surplus'
      }.`,
    );
    const prot = tally.days.map((d) => proteinOn.get(d.date)).filter((v): v is number => v !== undefined);
    line(
      `- Apports moyens des jours comptés : ${n(mean(tally.days.map((d) => d.eaten)), 0)} kcal/jour${prot.length ? ` et ${n(mean(prot), 0)} g de protéines` : ''}${
        t ? ` (cible actuelle : ${n(t.calories, 0)} kcal et ${t.proteinG} g)` : ''
      }.`,
    );
  }
  const trendIn = weighIns.map((e) => ({ date: e.date, trend: trend.get(e.date) })).filter((x): x is { date: string; trend: number } => x.trend !== undefined);
  const first = trendIn[0];
  const last = trendIn.at(-1);
  if (first && last && first.date < last.date) {
    const delta = last.trend - first.trend;
    line(
      `- Poids lissé : ${n(first.trend)} kg le ${shortDay(first.date)} → ${n(last.trend)} kg le ${shortDay(last.date)}, soit ${signed(delta, 1)} kg (${signed(delta / Math.max(1, daysBetween(first.date, last.date) / 7), 2)} kg/semaine).`,
    );
    if (tally.days.length) line(`- Perte attendue d’après le déficit compté (jours comptés seulement) : ${n(tally.total / KCAL_PER_KG, 2)} kg ; évolution du poids lissé : ${signed(delta, 2)} kg.`);
  } else if (latest) line(`- ${trendIn.length ? 'Une seule pesée' : 'Aucune pesée'} sur la période : pas d’évolution du poids mesurable.`);
  const fat = weighIns.map((e) => ({ date: e.date, kg: composition(e, profile).fatKg })).filter((x): x is { date: string; kg: number } => x.kg !== undefined);
  if (fat.length > 1) {
    const a = fat[0];
    const b = fat.at(-1)!;
    line(`- Masse grasse : ${n(a.kg)} kg le ${shortDay(a.date)} → ${n(b.kg)} kg le ${shortDay(b.date)}, soit ${signed(b.kg - a.kg, 1)} kg (mesures brutes, sans lissage).`);
  }

  // ---------- Méthode ----------
  line();
  line('## Comment l’app calcule');
  line(`- Métabolisme de base de chaque jour : formule de l’onglet Nutrition${t ? ` (aujourd’hui ${t.method})` : ''}, sur le poids lissé et le dernier % de gras connus ce jour-là.`);
  line(`- Dépense estimée = métabolisme de base × ${n(factor, 3)} (activité quotidienne hors sport) + dépense nette des séances de musculation (selon leur durée) et de la marche notées ce jour-là.`);
  line('- Jours non comptés dans le déficit : aucun repas noté, moins de la moitié du métabolisme de base noté (repas sans doute oubliés), et la journée en cours.');
  line('- Poids lissé : moyenne mobile exponentielle des pesées, qui atténue les variations d’eau et de contenu digestif.');
  if (weighIns.some((e) => e.bia)) line('- % de gras, muscle et eau : balance à impédancemètre, des estimations sensibles à l’hydratation.');
  line('- 1 kg de gras ≈ 7 700 kcal.');
  return out.join('\n');
}
