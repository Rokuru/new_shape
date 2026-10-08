/**
 * Bilan de la semaine en texte (Markdown) à coller ou partager dans Claude pour une analyse de coach.
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
  nutritionTargets,
  setE1rm,
  tonnage,
  VOLUME_LANDMARKS,
  volumeFromSets,
  weeklyRate,
  weightTrend,
  type NutritionTargets,
} from './calc';
import { addDays, dayKey, parseLocalDate } from './dates';
import { activityAverage, workoutKcal, workoutMinutes } from './energy';
import { weeklySetTarget } from './generator';
import { activityByDay, currentStreak } from './streak';
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
const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => parseLocalDate(day).toLocaleDateString('fr-FR', opts);
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

/**
 * Bilan d'une semaine (du lundi `weekStart` au dimanche), arrêté à `today` si la semaine est en cours.
 * Comparé à la semaine précédente et aux dernières performances avant la semaine.
 */
export function weeklyReport(data: ReportData, weekStart: string, today: string): string {
  const { profile, program, kcalAdjust } = data;
  const start = weekStartOf(weekStart);
  const end = addDays(start, 6);
  const last = end < today ? end : today;
  const partial = end > today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= last);
  const prevStart = addDays(start, -7);
  const prevEnd = addDays(start, -1);
  const asOf = new Date(parseLocalDate(last).getTime() + 12 * 3_600_000);
  const isIn = (day: string, a: string, b: string) => day >= a && day <= b;

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

  const out: string[] = [];
  const line = (s = '') => out.push(s);

  line(`# Bilan de la semaine du ${longDay(start)} au ${longDay(end)} ${parseLocalDate(end).getFullYear()}`);
  if (partial) line(`*Semaine en cours : données jusqu'au ${longDay(last)} inclus.*`);
  line();
  line(BRIEF);

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
  const targets = [
    profile.targetWeightKg !== undefined ? `${n(profile.targetWeightKg)} kg` : undefined,
    profile.targetBodyFatPct !== undefined ? `${n(profile.targetBodyFatPct)} % de masse grasse` : undefined,
  ].filter(Boolean);
  if (targets.length) line(`- Objectif chiffré : ${targets.join(', ')}.`);

  // ---------- Corps ----------
  line();
  line('## Corps');
  const weighIns = bodyUpTo.filter((e) => isIn(e.date, start, last));
  if (weighIns.length) line(`- Pesées : ${weighIns.map((e) => `${fmtDay(e.date)} ${n(e.weightKg)} kg`).join(' · ')}.`);
  else if (latest) line(`- Aucune pesée cette semaine (dernière : ${n(latest.weightKg)} kg le ${fmtDay(latest.date)}).`);
  else line('- Aucune pesée enregistrée.');
  const trendEnd = weightTrend(bodyUpTo).at(-1);
  const trendPrev = weightTrend(body.filter((e) => e.date <= prevEnd)).at(-1);
  if (trendEnd) {
    line(
      `- Poids lissé (tendance) : ${trendPrev ? `${n(trendPrev.trend)} kg fin de semaine précédente → ` : ''}${n(trendEnd.trend)} kg${
        trendPrev ? ` (${signed(trendEnd.trend - trendPrev.trend)} kg)` : ''
      }.`,
    );
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
    const prevComp = trendPrev ? currentComposition(body.filter((e) => e.date <= prevEnd), profile) : undefined;
    if (prevComp?.bodyFatPct !== undefined && prevComp.bfDate !== comp.bfDate) line(dot(`- Mesure précédente : ${n(prevComp.bodyFatPct)} % le ${fmtDay(prevComp.bfDate!)}`));
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
    const items = data.food.filter((f) => f.date === d);
    const withProtein = items.filter((f) => f.proteinG !== undefined);
    return {
      day: d,
      kcal: items.length ? items.reduce((s, f) => s + f.kcal, 0) : undefined,
      protein: withProtein.length ? withProtein.reduce((s, f) => s + (f.proteinG ?? 0), 0) : undefined,
    };
  });
  const logged = foodDays.filter((d) => d.kcal !== undefined);
  if (!logged.length) line('- Aucun repas noté cette semaine.');
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

  // ---------- Entraînement ----------
  line();
  line('## Entraînement');
  const planned = program?.days.length ?? profile.daysPerWeek;
  const setsOf = (ws: Workout[]) => ws.reduce((s, w) => s + w.exercises.reduce((x, e) => x + doneSets(e).length, 0), 0);
  const minutes = week.reduce((s, w) => s + workoutMinutes(w), 0);
  line(
    `- ${plural(week.length, 'séance')} sur ${planned} prévues · ${duration(minutes)} · ${plural(setsOf(week), 'série')} · tonnage ${n(week.reduce((s, w) => s + tonnage(w), 0) / 1000, 1)} t · dépense ≈ ${n(
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

  // Progression : meilleure série de la semaine (1RM estimé) contre la dernière séance avant la semaine.
  const exerciseIds = [...new Set(week.flatMap((w) => w.exercises.filter((e) => doneSets(e).length).map((e) => e.exerciseId)))];
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

  if (week.length) {
    const vol = volumeFromSets(week.flatMap((w) => w.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: doneSets(e).length }))));
    line();
    line(`### Volume par muscle (séries dures${partial ? ', semaine en cours' : ''} ; muscle secondaire compté pour ½)`);
    line('| Muscle | Séries | Cible du profil | Repères : minimum / zone optimale |');
    line('|---|---|---|---|');
    for (const m of MUSCLES) {
      const lm = VOLUME_LANDMARKS[m];
      line(`| ${MUSCLE_LABELS[m]} | ${n(vol[m])} | ${weeklySetTarget(profile, m)} | ${lm.mev} / ${lm.mavLow}–${lm.mavHigh} |`);
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
  line(`- Dépense sportive (au-delà du repos) : ${n(sportKcal / days.length, 0)} kcal/jour en moyenne cette semaine.`);
  const flames = activityByDay({ workouts: finished, cardio: data.cardio, food: data.food, sex: profile.sex, kcalTarget: t?.calories });
  const lit = days.filter((d) => (flames.get(d)?.level ?? 0) > 0).length;
  const inTarget = days.filter((d) => flames.get(d)?.kcalOk).length;
  line(`- Régularité : ${lit}/${days.length} jours actifs (séance, marche ou calories dans la cible) · ${logged.length ? `${inTarget} jour${inTarget > 1 ? 's' : ''} dans la cible calorique` : 'calories non notées'} · ${partial ? 'série en cours' : `série au ${fmtDay(last)}`} : ${plural(currentStreak(flames, last), 'jour')}.`);

  // ---------- Semaine précédente ----------
  line();
  line('## Comparaison avec la semaine précédente');
  const prevWalks = walks.filter((c) => isIn(c.date, prevStart, prevEnd)).map((c) => cardioStats(c, profile, weightKg));
  const prevFood = Array.from({ length: 7 }, (_, i) => addDays(prevStart, i))
    .map((d) => data.food.filter((f) => f.date === d))
    .filter((items) => items.length);
  line(`- Séances : ${prevWeek.length} → ${week.length} · séries : ${setsOf(prevWeek)} → ${setsOf(week)} · tonnage : ${n(prevWeek.reduce((s, w) => s + tonnage(w), 0) / 1000, 1)} t → ${n(week.reduce((s, w) => s + tonnage(w), 0) / 1000, 1)} t.`);
  line(`- Marche : ${prevWalks.length} → ${walkStats.length} sorties · ${n(prevWalks.reduce((s, x) => s + x.steps, 0), 0)} → ${n(walkStats.reduce((s, x) => s + x.s.steps, 0), 0)} pas.`);
  if (prevFood.length && logged.length) {
    const prevAvg = prevFood.reduce((s, items) => s + items.reduce((x, f) => x + f.kcal, 0), 0) / prevFood.length;
    const avg = logged.reduce((s, d) => s + (d.kcal ?? 0), 0) / logged.length;
    line(`- Calories moyennes (jours notés) : ${n(prevAvg, 0)} → ${n(avg, 0)} kcal.`);
  }
  if (partial) line(`- Attention : la semaine en cours ne compte que ${plural(days.length, 'jour')}.`);

  line();
  line(`*Exporté le ${longDay(today)} depuis New Shape. Calories de dépense et % de gras : estimations.*`);
  return out.join('\n');
}
