/**
 * Bilan en texte (Markdown) à coller ou partager dans Claude pour une analyse de coach : une semaine,
 * ou une période libre (depuis une date choisie, ou depuis la première donnée).
 * Les chiffres viennent des mêmes calculs que les écrans de l'app. Rien n'est envoyé :
 * l'utilisateur copie, partage ou télécharge le texte lui-même. Le prénom n'y figure pas.
 */
import { EQUIPMENT_LABELS, LEVEL_LABELS } from '../components/ProfileForm';
import { getExercise, MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { cardioStats, isValidCardio } from './cardio';
import {
  ACTIVITY_LABELS,
  ageFrom,
  bodyweightAt,
  computeBmr,
  currentComposition,
  GOAL_LABELS,
  initialComposition,
  nutritionTargets,
  setE1rm,
  tonnage,
  VOLUME_LANDMARKS,
  volumeFromSets,
  weeklyRate,
  weightTrend,
  type NutritionTargets,
} from './calc';
import { addDays, dayKey, daysBetween, firstOfMonth, parseLocalDate } from './dates';
import { activityAverage, workoutKcal, workoutMinutes } from './energy';
import { weeklySetTarget } from './generator';
import { planStatus } from './plan';
import { deficitSummary } from './deficit';
import { activityByDay, currentStreak, isLit } from './streak';
import type { BodyEntry, CardioEntry, FoodEntry, LoggedExercise, LoggedSet, Profile, Program, Workout } from './types';

export interface ReportData {
  profile: Profile;
  body: BodyEntry[];
  workouts: Workout[];
  cardio: CardioEntry[];
  food: FoodEntry[];
  /** Programme actif, s'il y en a un. */
  program?: Program;
  kcalAdjust: number;
}

/** Lundi de la semaine d'un jour AAAA-MM-JJ. */
export function weekStartOf(day: string): string {
  return addDays(day, -((parseLocalDate(day).getDay() + 6) % 7));
}

/** Semaine proposée par défaut : la précédente le lundi et le mardi (bilan de la semaine écoulée), sinon la semaine en cours. */
export function defaultReportWeek(today: string): string {
  const offset = (parseLocalDate(today).getDay() + 6) % 7; // lundi = 0
  return offset <= 1 ? addDays(weekStartOf(today), -7) : weekStartOf(today);
}

const n = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n(Math.abs(v), d)}`;
const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => firstOfMonth(parseLocalDate(day).toLocaleDateString('fr-FR', opts));
const longDay = (day: string) => fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' });
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}` : `${Math.round(min)} min`);
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;
/** Termine une phrase sans doubler le point d'une abréviation (« 25 sept. »). */
const dot = (s: string) => (s.endsWith('.') ? s : `${s}.`);

/** Une série : « 80×8 @2 » (charge × répétitions, RIR), « PDC+10×6 » pour les tractions lestées. */
export function setText(exerciseId: string, s: LoggedSet): string {
  const ex = getExercise(exerciseId);
  const load = ex.bodyweight ? (s.weight ? `PDC+${n(s.weight, 2)}` : 'PDC') : s.weight ? n(s.weight, 2) : '';
  return `${load ? `${load}×` : ''}${s.reps}${s.rir !== undefined ? ` @${s.rir}` : ''}`;
}

const doneSets = (e: LoggedExercise) => e.sets.filter((s) => s.done);

function bestOf(w: Workout, exerciseId: string, body: BodyEntry[]): { e1rm: number; set?: LoggedSet } {
  let best = { e1rm: 0 } as { e1rm: number; set?: LoggedSet };
  const bw = bodyweightAt(body, w.date);
  for (const e of w.exercises)
    if (e.exerciseId === exerciseId)
      for (const s of doneSets(e)) {
        const v = setE1rm(exerciseId, s.weight, s.reps, bw);
        if (v > best.e1rm) best = { e1rm: v, set: s };
      }
  return best;
}

const BRIEF = `## Ta mission
Tu es mon coach : expert en musculation, nutrition sportive et recomposition corporelle, rigoureux et fondé sur les preuves (méta-analyses, positions de l'ISSN et de l'ACSM). Voici ma semaine, exportée de mon appli de suivi « New Shape ». Analyse-la et réponds en français, de façon concrète et chiffrée :

1. **Verdict** : la semaine en 3 phrases, avec une note sur 10.
2. **Corps** : l'évolution du poids et de la composition est-elle cohérente avec mon objectif et mes apports ? Le rythme est-il adapté ?
3. **Entraînement** : progression exercice par exercice (charges, répétitions, RIR), exercices qui stagnent ou régressent, volume par muscle par rapport aux repères, régularité.
4. **Nutrition** : calories et protéines par rapport à la cible, régularité du suivi, déficit ou surplus probable au vu de l'évolution du poids.
5. **Activité et récupération** : marche, dépense, fatigue (d'après mes notes).
6. **Plan pour la semaine prochaine** : 3 à 5 actions précises et chiffrées, par ordre de priorité (charges et répétitions visées sur les exercices clés, calories, protéines, pas).
7. **Ce qu'il te manque** : les données absentes ou douteuses que je devrais mieux noter.

Distingue ce qui est mesuré de ce qui est estimé (dépense calorique, % de gras par impédancemètre), ne surinterprète pas une seule semaine, et signale ce qui mériterait l'avis d'un professionnel de santé.`;

/** Mission pour un bilan sur plusieurs semaines : tendances, progression du début à la fin, plan pour la suite. */
const periodBrief = (span: string) => `## Ta mission
Tu es mon coach : expert en musculation, nutrition sportive et recomposition corporelle, rigoureux et fondé sur les preuves (méta-analyses, positions de l'ISSN et de l'ACSM). Voici mes données ${span}, exportées de mon appli de suivi « New Shape ». Analyse toute la période et réponds en français, de façon concrète et chiffrée :

1. **Verdict** : la période en 3 phrases, avec une note sur 10, et ce qui a changé entre le début et la fin.
2. **Corps** : l'évolution du poids et de la composition est-elle cohérente avec mon objectif et mes apports ? Le rythme est-il adapté et régulier d'une semaine à l'autre ?
3. **Entraînement** : progression exercice par exercice sur la période (charges, répétitions, RIR), exercices qui stagnent ou régressent, volume moyen par muscle par rapport aux repères, régularité.
4. **Nutrition** : calories et protéines par rapport à la cible semaine par semaine, régularité du suivi, déficit compté comparé à l'évolution réelle du poids.
5. **Activité et récupération** : marche, dépense, fatigue (d'après mes notes).
6. **Plan pour les semaines à venir** : 3 à 5 actions précises et chiffrées, par ordre de priorité (charges et répétitions visées sur les exercices clés, calories, protéines, pas).
7. **Ce qu'il te manque** : les données absentes ou douteuses que je devrais mieux noter.

Distingue ce qui est mesuré de ce qui est estimé (dépense calorique, % de gras par impédancemètre), appuie-toi sur les tendances semaine par semaine plutôt que sur un jour isolé, et signale ce qui mériterait l'avis d'un professionnel de santé.`;

/**
 * Bilan d'une semaine (du lundi `weekStart` au dimanche), arrêté à `today` si la semaine est en cours.
 * Comparé à la semaine précédente et aux dernières performances avant la semaine.
 */
export function weeklyReport(data: ReportData, weekStart: string, today: string): string {
  const start = weekStartOf(weekStart);
  return buildReport(data, 'week', start, addDays(start, 6), today);
}

/**
 * Bilan d'une période libre, du `from` au `to` inclus (arrêtée à `today`) : depuis une date choisie, ou depuis
 * la première donnée. Résumé semaine par semaine et progression de la première à la dernière séance.
 */
export function periodReport(data: ReportData, from: string, to: string, today: string): string {
  const end = to > today ? today : to;
  return buildReport(data, 'period', from > end ? end : from, end, today);
}

/** Premier jour avec une donnée (pesée, séance, marche ou repas) : le « début » du bilan depuis le début. */
export function firstDataDay(data: Pick<ReportData, 'body' | 'workouts' | 'cardio' | 'food'>): string | undefined {
  return [...data.body.map((e) => e.date), ...data.workouts.filter((w) => w.finished).map((w) => dayKey(w.date)), ...data.cardio.map((c) => c.date), ...data.food.map((f) => f.date)].sort()[0];
}

function buildReport(data: ReportData, kind: 'week' | 'period', start: string, end: string, today: string): string {
  const { profile, program, kcalAdjust } = data;
  const isWeek = kind === 'week';
  const last = end < today ? end : today;
  const partial = end > today;
  const days: string[] = [];
  for (let d = start; d <= last; d = addDays(d, 1)) days.push(d);
  const prevStart = addDays(start, -7);
  const prevEnd = addDays(start, -1);
  const asOf = new Date(parseLocalDate(last).getTime() + 12 * 3_600_000);
  const isIn = (day: string, a: string, b: string) => day >= a && day <= b;
  const periodLabel = isWeek ? 'cette semaine' : 'sur la période';

  const body = [...data.body].sort((a, b) => a.date.localeCompare(b.date));
  const bodyUpTo = body.filter((e) => e.date <= last);
  const finished = data.workouts.filter((w) => w.finished).sort((a, b) => a.date.localeCompare(b.date));
  const week = finished.filter((w) => isIn(dayKey(w.date), start, last));
  const prevWeek = finished.filter((w) => isIn(dayKey(w.date), prevStart, prevEnd));
  const walks = data.cardio.filter((c) => isValidCardio(c));
  const comp = bodyUpTo.length ? currentComposition(bodyUpTo, profile) : undefined;
  const weightKg = comp?.weightKg ?? 75;
  const bmr = computeBmr(profile, weightKg, comp?.bodyFatPct).bmr;
  const latest = bodyUpTo.at(-1);
  const act = activityAverage({ workouts: finished, cardio: data.cardio, profile, bodyFatPct: comp?.bodyFatPct }, weightKg, asOf);
  const t: NutritionTargets | undefined = latest && comp ? nutritionTargets(profile, { ...latest, weightKg: comp.weightKg }, comp.bodyFatPct, kcalAdjust, act.perDay) : undefined;
  // Compteur « Calories à perdre » arrêté à la fin de la période (ou à hier si elle va jusqu'à aujourd'hui).
  const def = deficitSummary(data, last === today ? today : addDays(last, 1));
  const setsOf = (ws: Workout[]) => ws.reduce((s, w) => s + w.exercises.reduce((x, e) => x + doneSets(e).length, 0), 0);
  const foodOn = (d: string) => data.food.filter((f) => f.date === d);

  const out: string[] = [];
  const line = (s = '') => out.push(s);

  if (isWeek) {
    line(`# Bilan de la semaine du ${longDay(start)} au ${longDay(end)} ${parseLocalDate(end).getFullYear()}`);
    if (partial) line(`*Semaine en cours : données jusqu'au ${longDay(last)} inclus.*`);
  } else {
    const y0 = parseLocalDate(start).getFullYear();
    const y1 = parseLocalDate(last).getFullYear();
    line(`# Bilan du ${longDay(start)}${y0 !== y1 ? ` ${y0}` : ''} au ${longDay(last)} ${y1} (${plural(days.length, 'jour')})`);
    if (last === today) line(`*Données jusqu'au ${longDay(last)} inclus (journée en cours).*`);
  }
  line();
  line(isWeek ? BRIEF : periodBrief(`du ${longDay(start)} au ${longDay(last)} (${plural(days.length, 'jour')}, soit ${n(days.length / 7, 1)} semaines)`));

  // ---------- Profil ----------
  line();
  line('## Profil');
  line(`- ${profile.sex === 'male' ? 'Homme' : 'Femme'}, ${ageFrom(profile.birthYear, asOf)} ans, ${profile.heightCm} cm. Activité hors sport : ${ACTIVITY_LABELS[profile.activity].toLowerCase()}.`);
  line(`- Objectif : ${GOAL_LABELS[profile.goal].toLowerCase()} · niveau : ${LEVEL_LABELS[profile.level].toLowerCase()} · matériel : ${EQUIPMENT_LABELS[profile.equipment].toLowerCase()}.`);
  line(
    `- Prévu : ${plural(profile.daysPerWeek, 'séance')} par semaine d'environ ${profile.sessionMinutes} min${
      profile.priorities.length ? ` · muscles prioritaires : ${profile.priorities.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(', ')}` : ''
    }.`,
  );
  if (program) line(`- Programme suivi : « ${program.name} » (${program.days.map((d) => d.name).join(', ')}).`);
  const plan = planStatus(profile, last);
  if (plan) {
    const where = plan.finished ? 'plan terminé' : plan.started ? `semaine ${plan.week}/${plan.tpl.weeks}, phase ${plan.phaseIndex + 1} – ${plan.phase.name}` : `départ le ${longDay(plan.start)}`;
    line(`- Plan objectif : « ${plan.tpl.name} » (${where} ; du ${longDay(plan.start)} au ${longDay(plan.end)}). Marche prévue dans cette phase : ${plan.phase.cardio.walk}, ${plan.phase.cardio.steps} pas/jour.`);
  }
  const targets = [
    profile.targetWeightKg !== undefined ? `${n(profile.targetWeightKg)} kg` : undefined,
    profile.targetBodyFatPct !== undefined ? `${n(profile.targetBodyFatPct)} % de masse grasse` : undefined,
  ].filter(Boolean);
  if (targets.length) line(`- Objectif chiffré : ${targets.join(', ')}.`);

  // ---------- Semaine par semaine (période) ----------
  const trendAll = weightTrend(bodyUpTo);
  if (!isWeek) {
    line();
    line('## Semaine par semaine');
    line('| Semaine | Poids (tendance) | Séances | Séries | Marche | Repas notés | Calories (moy.) | Protéines (moy.) | Déficit compté |');
    line('|---|---|---|---|---|---|---|---|---|');
    for (let ws = weekStartOf(start); ws <= last; ws = addDays(ws, 7)) {
      const a = ws < start ? start : ws;
      const b = addDays(ws, 6) > last ? last : addDays(ws, 6);
      const span: string[] = [];
      for (let d = a; d <= b; d = addDays(d, 1)) span.push(d);
      const ws_ = week.filter((w) => isIn(dayKey(w.date), a, b));
      const weighed = trendAll.filter((x) => isIn(x.date, a, b)).at(-1);
      const walkMin = walks.filter((c) => isIn(c.date, a, b)).reduce((s, c) => s + cardioStats(c, profile, weightKg).durationMin, 0);
      const meals = span.map(foodOn).filter((items) => items.length);
      const prot = meals.filter((items) => items.some((f) => f.proteinG !== undefined));
      const counted = def?.tally.days.filter((d) => isIn(d.date, a, b)) ?? [];
      const sameMonth = a.slice(5, 7) === b.slice(5, 7);
      const label = `${fmtDay(a, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${fmtDay(b, { day: 'numeric', month: 'short' })}`;
      line(
        `| ${label} | ${weighed ? `${n(weighed.trend)} kg` : '—'} | ${ws_.length} | ${setsOf(ws_)} | ${walkMin ? duration(walkMin) : '—'} | ${meals.length}/${span.length} j | ${
          meals.length ? `${n(meals.reduce((s, items) => s + items.reduce((x, f) => x + f.kcal, 0), 0) / meals.length, 0)} kcal` : '—'
        } | ${prot.length ? `${n(prot.reduce((s, items) => s + items.reduce((x, f) => x + (f.proteinG ?? 0), 0), 0) / prot.length, 0)} g` : '—'} | ${
          counted.length ? `${n(counted.reduce((s, d) => s + d.deficit, 0), 0)} kcal (${counted.length} j)` : '—'
        } |`,
      );
    }
    line();
    line('- Poids : tendance lissée à la dernière pesée de la semaine. Déficit compté : maintenance estimée avec le sport du jour − repas notés, journées complètes seulement.');
  }

  // ---------- Corps ----------
  line();
  line('## Corps');
  const weighIns = bodyUpTo.filter((e) => isIn(e.date, start, last));
  if (weighIns.length) line(`- Pesées : ${weighIns.map((e) => `${fmtDay(e.date)} ${n(e.weightKg)} kg`).join(' · ')}.`);
  else if (latest) line(`- Aucune pesée ${periodLabel} (dernière : ${n(latest.weightKg)} kg le ${fmtDay(latest.date)}).`);
  else line('- Aucune pesée enregistrée.');
  const trendEnd = trendAll.at(-1);
  const trendPrev = weightTrend(body.filter((e) => e.date <= prevEnd)).at(-1);
  if (trendEnd && isWeek) {
    line(
      `- Poids lissé (tendance) : ${trendPrev ? `${n(trendPrev.trend)} kg fin de semaine précédente → ` : ''}${n(trendEnd.trend)} kg${
        trendPrev ? ` (${signed(trendEnd.trend - trendPrev.trend)} kg)` : ''
      }.`,
    );
  } else if (trendEnd) {
    // Point de départ : la tendance la veille de la période, sinon la première pesée de la période.
    const first = trendPrev ?? trendAll.find((x) => x.date >= start);
    const from = first && first.date < start ? prevEnd : first?.date;
    if (first && from && from < trendEnd.date) {
      const delta = trendEnd.trend - first.trend;
      line(
        `- Poids lissé (tendance) : ${n(first.trend)} kg ${first.date < start ? 'au début de la période' : `le ${fmtDay(first.date)}`} → ${n(trendEnd.trend)} kg le ${fmtDay(trendEnd.date)} (${signed(delta)} kg, soit ${signed(
          delta / Math.max(1, daysBetween(from, trendEnd.date) / 7),
          2,
        )} kg/semaine en moyenne).`,
      );
    } else line(`- Poids lissé (tendance) : ${n(trendEnd.trend)} kg.`);
  }
  const rate = weeklyRate(bodyUpTo, 21, asOf);
  if (rate !== undefined) line(`- Rythme sur 3 semaines : ${signed(rate, 2)} kg/semaine (${signed((rate / weightKg) * 100, 2)} % du poids).`);
  if (comp?.bodyFatPct !== undefined && comp.bfDate) {
    const src = bodyUpTo.find((e) => e.date === comp.bfDate);
    const how = src?.bia ? 'balance à impédancemètre' : src?.bodyFatPct !== undefined ? 'valeur saisie' : 'mensurations, méthode US Navy';
    line(
      `- Masse grasse : ${n(comp.bodyFatPct)} % (${how}, mesure du ${fmtDay(comp.bfDate)}) → ${n(comp.fatKg ?? 0)} kg de gras, ${n(comp.leanKg ?? 0)} kg de masse maigre${
        comp.ffmi ? `, FFMI ${n(comp.ffmi)}` : ''
      }.`,
    );
    const before = trendPrev ? currentComposition(body.filter((e) => e.date <= prevEnd), profile) : undefined;
    if (isWeek) {
      if (before?.bodyFatPct !== undefined && before.bfDate !== comp.bfDate) line(dot(`- Mesure précédente : ${n(before.bodyFatPct)} % le ${fmtDay(before.bfDate!)}`));
    } else {
      // Composition au début : la dernière mesure avant la période, sinon la première de la période.
      const atStart = before?.bodyFatPct !== undefined ? before : initialComposition(weighIns, profile);
      if (atStart?.bodyFatPct !== undefined && atStart.bfDate !== comp.bfDate && atStart.fatKg !== undefined && atStart.leanKg !== undefined)
        line(
          `- Au début : ${n(atStart.bodyFatPct)} % (mesure du ${fmtDay(atStart.bfDate!)}) → ${n(atStart.fatKg)} kg de gras, ${n(atStart.leanKg)} kg de masse maigre ; évolution : ${signed((comp.fatKg ?? 0) - atStart.fatKg)} kg de gras, ${signed(
            (comp.leanKg ?? 0) - atStart.leanKg,
          )} kg de masse maigre.`,
        );
    }
  }
  const LABELS: [keyof BodyEntry, string][] = [
    ['waistCm', 'taille'],
    ['hipCm', 'hanches'],
    ['chestCm', 'poitrine'],
    ['armCm', 'bras'],
    ['thighCm', 'cuisse'],
    ['neckCm', 'cou'],
  ];
  for (const e of weighIns) {
    const sizes = LABELS.filter(([k]) => typeof e[k] === 'number').map(([k, label]) => `${label} ${n(e[k] as number)} cm`);
    if (sizes.length) line(`- Mensurations du ${fmtDay(e.date)} : ${sizes.join(', ')}.`);
    const b = e.bia;
    if (b) {
      const parts = [
        b.muscleKg !== undefined ? `muscle ${n(b.muscleKg)} kg` : undefined,
        b.waterPct !== undefined ? `eau ${n(b.waterPct)} %` : undefined,
        b.visceral !== undefined ? `graisse viscérale ${n(b.visceral)}` : undefined,
        b.metabolicAge !== undefined ? `âge métabolique ${b.metabolicAge} ans` : undefined,
      ].filter(Boolean);
      if (parts.length) line(`- Balance du ${fmtDay(e.date)} : ${parts.join(', ')}.`);
    }
    if (e.note) line(`- Note du ${fmtDay(e.date)} : « ${e.note} »`);
  }

  // ---------- Nutrition ----------
  line();
  line('## Nutrition');
  if (t) {
    line(
      `- Cible de l'app : ${n(t.calories, 0)} kcal/jour et ${t.proteinG} g de protéines. Maintenance estimée ${n(t.tdee, 0)} kcal = métabolisme de base ${n(t.bmr, 0)} kcal (${t.method}) × activité quotidienne + ${n(act.perDay, 0)} kcal/jour de sport en moyenne.`,
    );
    const aim = t.expectedRateKg ?? t.targetRateKg;
    line(`- Rythme visé : ${signed(aim, 2)} kg/semaine${t.floored ? ' (cible remontée au minimum de sécurité)' : t.capped ? ' (déficit plafonné à 25 % de la dépense)' : ''}${kcalAdjust ? ` · ajustement adaptatif ${signed(kcalAdjust, 0)} kcal inclus` : ''}.`);
  }
  const foodDays = days.map((d) => {
    const items = foodOn(d);
    const withProtein = items.filter((f) => f.proteinG !== undefined);
    return {
      day: d,
      kcal: items.length ? items.reduce((s, f) => s + f.kcal, 0) : undefined,
      protein: withProtein.length ? withProtein.reduce((s, f) => s + (f.proteinG ?? 0), 0) : undefined,
    };
  });
  const logged = foodDays.filter((d) => d.kcal !== undefined);
  if (!logged.length) line(`- Aucun repas noté ${periodLabel}.`);
  else {
    line();
    line('| Jour | Calories | Protéines |');
    line('|---|---|---|');
    for (const d of foodDays) line(`| ${fmtDay(d.day)} | ${d.kcal !== undefined ? `${n(d.kcal, 0)} kcal` : 'non noté'} | ${d.protein !== undefined ? `${n(d.protein, 0)} g` : '—'} |`);
    line();
    const avgKcal = logged.reduce((s, d) => s + (d.kcal ?? 0), 0) / logged.length;
    const prot = logged.filter((d) => d.protein !== undefined);
    const avgProt = prot.length ? prot.reduce((s, d) => s + (d.protein ?? 0), 0) / prot.length : undefined;
    line(
      `- Jours notés : ${logged.length}/${days.length} · moyenne des jours notés : ${n(avgKcal, 0)} kcal${t ? ` (${n((avgKcal / t.calories) * 100, 0)} % de la cible)` : ''}${
        avgProt !== undefined ? ` · ${n(avgProt, 0)} g de protéines${t ? ` (cible ${t.proteinG} g)` : ''}` : ' · protéines non notées'
      }.`,
    );
  }

  if (def && !def.notStarted) {
    const inPeriod = def.tally.days.filter((d) => isIn(d.date, start, end));
    const sum = inPeriod.reduce((s, d) => s + d.deficit, 0);
    const counted = inPeriod.length ? `${n(sum, 0)} kcal ${periodLabel} sur ${plural(inPeriod.length, 'jour')} compté${inPeriod.length > 1 ? 's' : ''}` : `aucun jour complet noté ${periodLabel}`;
    line(
      `- Déficit compté (maintenance estimée avec le sport du jour − repas notés ; négatif = surplus) : ${counted} ; ${n(def.tally.total, 0)} kcal depuis le départ du ${longDay(def.tally.from)}, sur ${n(Math.round(def.goal.kcal / 100) * 100, 0)} kcal à perdre (${def.goal.basis === 'fat' ? `${n(def.goal.toLoseKg)} kg de gras` : `${n(def.goal.toLoseKg)} kg`} × 7 700), soit ${n(def.pct, 1)} %.`,
    );
  }

  // ---------- Entraînement ----------
  line();
  line('## Entraînement');
  const planned = program?.days.length ?? profile.daysPerWeek;
  const minutes = week.reduce((s, w) => s + workoutMinutes(w), 0);
  line(
    `- ${plural(week.length, 'séance')} ${isWeek ? `sur ${planned} prévues` : `en ${n(days.length / 7, 1)} semaines (${planned} prévues par semaine)`} · ${duration(minutes)} · ${plural(setsOf(week), 'série')} · tonnage ${n(
      week.reduce((s, w) => s + tonnage(w), 0) / 1000,
      1,
    )} t · dépense ≈ ${n(
      week.reduce((s, w) => s + workoutKcal(w, bmr), 0),
      0,
    )} kcal.`,
  );
  if (week.length) line('- Notation : charge en kg × répétitions, « @2 » = 2 répétitions en réserve (RIR), PDC = poids du corps.');
  for (const w of week) {
    line();
    line(`### ${fmtDay(dayKey(w.date))} – ${w.dayName}${w.durationMin ? ` (${w.durationMin} min)` : ''}`);
    for (const e of w.exercises) {
      const sets = doneSets(e);
      if (!sets.length) continue;
      const tg = e.target;
      const goal = tg ? ` — prévu ${tg.sets}×${tg.repMin === tg.repMax ? tg.repMin : `${tg.repMin}–${tg.repMax}`} @${tg.rir}` : '';
      line(`- ${getExercise(e.exerciseId).name} : ${sets.map((s) => setText(e.exerciseId, s)).join(', ')}${goal}`);
    }
    const stretched = w.stretches?.filter((s) => s.done).length ?? 0;
    if (stretched) line(`- Étirements : ${plural(stretched, 'exercice')} fait${stretched > 1 ? 's' : ''}.`);
    if (w.note) line(`- Note : « ${w.note} »`);
  }

  const exerciseIds = [...new Set(week.flatMap((w) => w.exercises.filter((e) => doneSets(e).length).map((e) => e.exerciseId)))];
  if (isWeek) {
    // Progression : meilleure série de la semaine (1RM estimé) contre la dernière séance avant la semaine.
    const progress = exerciseIds
      .map((id) => {
        const best = week.map((w) => ({ w, ...bestOf(w, id, body) })).sort((a, b) => b.e1rm - a.e1rm)[0];
        const before = [...finished].reverse().find((w) => dayKey(w.date) < start && w.exercises.some((e) => e.exerciseId === id && doneSets(e).length));
        const prev = before ? bestOf(before, id, body) : undefined;
        return { id, best, before, prev };
      })
      .filter((p) => p.best.e1rm > 0);
    if (progress.length) {
      line();
      line('### Progression (1RM estimé par la formule d’Epley sur la meilleure série ; tractions et dips : poids du corps compris)');
      for (const p of progress) {
        const ex = getExercise(p.id);
        const now = `${n(p.best.e1rm)} kg (${setText(p.id, p.best.set!)})`;
        line(
          `- ${ex.name} : ${now}${
            p.prev && p.before && p.prev.e1rm > 0 ? ` ; avant : ${n(p.prev.e1rm)} kg le ${fmtDay(dayKey(p.before.date))} (${signed(p.best.e1rm - p.prev.e1rm)} kg)` : ' ; première fois dans l’app'
          }`,
        );
      }
    }
  } else {
    // Progression sur la période : première → dernière séance de chaque exercice, et meilleure séance.
    const rows = exerciseIds
      .map((id) => ({ id, sessions: week.map((w) => ({ w, ...bestOf(w, id, body) })).filter((x) => x.e1rm > 0) }))
      .filter((p) => p.sessions.length);
    if (rows.length) {
      line();
      line('### Progression sur la période (1RM estimé par la formule d’Epley sur la meilleure série de chaque séance ; tractions et dips : poids du corps compris)');
      const at = (x: { w: Workout; e1rm: number; set?: LoggedSet }, id: string) => `${n(x.e1rm)} kg le ${fmtDay(dayKey(x.w.date))} (${setText(id, x.set!)})`;
      for (const { id, sessions } of rows) {
        const first = sessions[0];
        const lastS = sessions.at(-1)!;
        const best = [...sessions].sort((a, b) => b.e1rm - a.e1rm)[0];
        line(
          `- ${getExercise(id).name} : ${sessions.length > 1 ? `${at(first, id)} → ${at(lastS, id)}, ${signed(lastS.e1rm - first.e1rm)} kg` : at(first, id)}${
            sessions.length > 2 && best !== lastS && best !== first ? ` ; meilleur : ${at(best, id)}` : ''
          } · ${plural(sessions.length, 'séance')}`,
        );
      }
    }
  }

  if (week.length) {
    const vol = volumeFromSets(week.flatMap((w) => w.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: doneSets(e).length }))));
    const perWeek = isWeek ? 1 : Math.max(1, days.length / 7);
    line();
    line(
      isWeek
        ? `### Volume par muscle (séries dures${partial ? ', semaine en cours' : ''} ; muscle secondaire compté pour ½)`
        : `### Volume moyen par semaine (séries dures sur ${n(perWeek, 1)} semaines ; muscle secondaire compté pour ½)`,
    );
    line(`| Muscle | ${isWeek ? 'Séries' : 'Séries / semaine'} | Cible du profil | Repères : minimum / zone optimale |`);
    line('|---|---|---|---|');
    for (const m of MUSCLES) {
      const lm = VOLUME_LANDMARKS[m];
      line(`| ${MUSCLE_LABELS[m]} | ${n(vol[m] / perWeek)} | ${weeklySetTarget(profile, m)} | ${lm.mev} / ${lm.mavLow}–${lm.mavHigh} |`);
    }
  }

  // ---------- Marche et activité ----------
  line();
  line('## Marche et activité');
  const weekWalks = walks.filter((c) => isIn(c.date, start, last)).sort((a, b) => a.date.localeCompare(b.date));
  const walkStats = weekWalks.map((c) => ({ c, s: cardioStats(c, profile, weightKg) }));
  if (!walkStats.length) line('- Aucune marche enregistrée.');
  else {
    const sum = (k: 'durationMin' | 'distanceKm' | 'steps' | 'kcal') => walkStats.reduce((s, x) => s + x.s[k], 0);
    line(`- ${plural(walkStats.length, 'marche')} : ${duration(sum('durationMin'))}, ${n(sum('distanceKm'))} km, ${n(sum('steps'), 0)} pas, ${n(sum('kcal'), 0)} kcal.`);
    for (const { c, s } of walkStats)
      line(
        `- ${fmtDay(c.date)} : ${c.speedKmh ? `${s.durationMin} min à ${n(s.speedKmh)} km/h` : `${n(s.steps, 0)} pas`}${c.inclinePct ? `, pente ${n(c.inclinePct)} %` : ''} → ${n(s.distanceKm)} km, ${s.kcal} kcal`,
      );
  }
  const sportKcal = week.reduce((s, w) => s + workoutKcal(w, bmr), 0) + walkStats.reduce((s, x) => s + x.s.kcal, 0);
  line(`- Dépense sportive (au-delà du repos) : ${n(sportKcal / days.length, 0)} kcal/jour en moyenne ${periodLabel}.`);
  const flames = activityByDay({ workouts: finished, cardio: data.cardio, food: data.food, sex: profile.sex, kcalTarget: t?.calories, kcalMaintenance: t?.tdee });
  const lit = days.filter((d) => (flames.get(d)?.level ?? 0) > 0).length;
  const kept = days.filter((d) => flames.get(d)?.blue).length;
  const inTarget = days.filter((d) => flames.get(d)?.kcalOk).length;
  // Plus longue série de la période (jours avec une flamme, orange ou bleue).
  let bestRun = 0;
  let run = 0;
  for (const d of days) {
    run = isLit(flames.get(d)) ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  line(
    `- Régularité : ${lit}/${days.length} jours actifs (séance, marche ou calories dans la cible)${kept ? ` + ${plural(kept, 'jour')} maintenu${kept > 1 ? 's' : ''} par les calories (sous la maintenance, flamme bleue)` : ''} · ${logged.length ? `${inTarget} jour${inTarget > 1 ? 's' : ''} dans la cible calorique` : 'calories non notées'} · ${
      partial || (!isWeek && last === today) ? 'série en cours' : `série au ${fmtDay(last)}`
    } : ${plural(currentStreak(flames, last), 'jour')}${isWeek ? '' : ` · plus longue série de la période : ${plural(bestRun, 'jour')}`}.`,
  );

  // ---------- Semaine précédente ----------
  if (isWeek) {
    line();
    line('## Comparaison avec la semaine précédente');
    const prevWalks = walks.filter((c) => isIn(c.date, prevStart, prevEnd)).map((c) => cardioStats(c, profile, weightKg));
    const prevFood = Array.from({ length: 7 }, (_, i) => addDays(prevStart, i))
      .map(foodOn)
      .filter((items) => items.length);
    line(`- Séances : ${prevWeek.length} → ${week.length} · séries : ${setsOf(prevWeek)} → ${setsOf(week)} · tonnage : ${n(prevWeek.reduce((s, w) => s + tonnage(w), 0) / 1000, 1)} t → ${n(week.reduce((s, w) => s + tonnage(w), 0) / 1000, 1)} t.`);
    line(`- Marche : ${prevWalks.length} → ${walkStats.length} sorties · ${n(prevWalks.reduce((s, x) => s + x.steps, 0), 0)} → ${n(walkStats.reduce((s, x) => s + x.s.steps, 0), 0)} pas.`);
    if (prevFood.length && logged.length) {
      const prevAvg = prevFood.reduce((s, items) => s + items.reduce((x, f) => x + f.kcal, 0), 0) / prevFood.length;
      const avg = logged.reduce((s, d) => s + (d.kcal ?? 0), 0) / logged.length;
      line(`- Calories moyennes (jours notés) : ${n(prevAvg, 0)} → ${n(avg, 0)} kcal.`);
    }
    if (partial) line(`- Attention : la semaine en cours ne compte que ${plural(days.length, 'jour')}.`);
  }

  line();
  line(`*Exporté le ${longDay(today)} depuis New Shape. Calories de dépense et % de gras : estimations.*`);
  return out.join('\n');
}
