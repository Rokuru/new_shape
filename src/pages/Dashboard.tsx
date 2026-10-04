import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Tab } from '../App';
import { getExercise } from '../data/exercises';
import { bodyweightAt, currentComposition, initialComposition, setE1rm, nutritionTargets, startOfWeek, weeklyRate, weightTrend } from '../lib/calc';
import { allPrograms, useStore } from '../lib/store';
import { biaTrend } from '../lib/bia';
import { dailyTotals } from '../lib/cardio';
import { activityAverage } from '../lib/energy';
import { useToday } from '../hooks/useToday';
import { useChartRange } from '../hooks/useChartRange';
import { breakGaps, inRange, RANGE_OPTIONS, timeAxis } from '../lib/timeAxis';
import { goalProjection } from '../lib/goal';
import { ffmiReliable } from '../components/FfmiInfo';
import { ChartTooltip, Empty, fmtDate, fmtNum, Icon, Segmented, signed, Tile } from '../components/ui';

export default function Dashboard({ go }: { go: (t: Tab) => void }) {
  const { food, profile, body, cardio, workouts, customPrograms, activeProgramId, nextDayIndex, activeWorkout, startWorkout, kcalAdjust } = useStore();
  const todayKey = useToday(); // re-rendu au changement de jour (app restée ouverte après minuit)
  const program = allPrograms(customPrograms).find((p) => p.id === activeProgramId);
  const latest = body.at(-1);
  const comp = currentComposition(body, profile);
  const firstComp = initialComposition(body, profile);
  const sinceStart = firstComp && comp && firstComp.bfDate !== comp.bfDate;
  const rate = weeklyRate(body);
  const trend = weightTrend(body);
  const [range, setRange] = useChartRange('dashboard-weight');
  const shown = inRange(trend, range, todayKey);
  const axis = shown.length >= 2 ? timeAxis(shown.map((d) => d.t)) : undefined;
  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = workouts.filter((w) => new Date(w.date).getTime() >= weekStart).length;
  const nut = latest && comp ? nutritionTargets(profile, { ...latest, weightKg: comp.weightKg }, comp.bodyFatPct, kcalAdjust, activityAverage({ workouts, cardio, profile }, comp.weightKg).perDay) : undefined;

  const goal =
    comp && profile.targetWeightKg !== undefined
      ? goalProjection({ currentKg: comp.weightKg, targetKg: profile.targetWeightKg, startKg: profile.targetStartKg ?? comp.weightKg, ratePerWeek: rate, today: todayKey })
      : undefined;
  const eatenToday = food.filter((f) => f.date === todayKey).reduce((s, f) => s + f.kcal, 0);
  const proteinToday = food.filter((f) => f.date === todayKey).reduce((s, f) => s + (f.proteinG ?? 0), 0);
  const prs = recentPRs(workouts, body).slice(0, 4);
  const muscle = [...biaTrend(body, (e) => e.bia?.muscleKg).values()];
  const cardioToday = dailyTotals(cardio, profile, body.at(-1)?.weightKg ?? 75, 1)[0];
  const nextDay = program?.days[nextDayIndex % program.days.length];

  const exNames = nextDay?.exercises.map((e) => getExercise(e.exerciseId).name) ?? [];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <section className="hero">
        <div className="hero-top">
          <div style={{ minWidth: 0 }}>
            <div className="hero-kicker">{today}</div>
            <h1>Salut{profile.name ? ` ${profile.name}` : ''} 👋</h1>
          </div>
          <WeekRing done={thisWeek} target={profile.daysPerWeek} />
        </div>
        <div className="hero-next">
          {activeWorkout ? (
            <>
              <div className="label">Séance en cours</div>
              <div className="hero-session">{activeWorkout.dayName}</div>
              <div className="hero-actions">
                <button className="btn go lg" onClick={() => go('workout')}>
                  <Icon name="play" size={20} /> Reprendre
                </button>
              </div>
            </>
          ) : program && nextDay ? (
            <>
              <div className="label">Prochaine séance · {program.name}</div>
              <div className="hero-session">{nextDay.name}</div>
              <div className="hero-ex">
                {/* iPhone : 3 exercices affichés, écrans plus larges : 6 */}
                {exNames.slice(0, 6).map((n, i) => (
                  <span key={i} className={i >= 3 ? 'extra' : undefined}>
                    {n}
                  </span>
                ))}
                {exNames.length > 3 && <span className="more-sm">+{exNames.length - 3}</span>}
                {exNames.length > 6 && <span className="more-lg">+{exNames.length - 6}</span>}
              </div>
              <div className="hero-actions">
                <button
                  className="btn go lg"
                  onClick={() => {
                    startWorkout(program, nextDayIndex % program.days.length);
                    go('workout');
                  }}
                >
                  <Icon name="play" size={20} /> Démarrer
                </button>
                <button className="btn ghost hide-xs" onClick={() => go('programs')}>
                  Voir le programme
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="label">Aucun programme actif</div>
              <div className="hero-actions" style={{ marginTop: 8 }}>
                <button className="btn go lg" onClick={() => go('programs')}>
                  Choisir un programme <Icon name="arrow" size={20} />
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="tiles">
        <Tile
          label="Poids lissé"
          icon="scale"
          value={trend.length ? `${fmtNum(trend.at(-1)!.trend)} kg` : '—'}
          sub={latest ? `pesée ${fmtNum(latest.weightKg)} kg${rate !== undefined ? ` · ${signed(rate, 2)} kg/sem.` : ''}` : 'Pèse-toi 3×/sem.'}
        />
        {goal && (
          <Tile
            label="Objectif"
            icon="target"
            tone="green"
            value={goal.status === 'reached' ? 'Atteint 🎉' : `${fmtNum(goal.remainingKg)} kg`}
            sub={
              (goal.status === 'reached'
                ? `${fmtNum(profile.targetWeightKg)} kg`
                : goal.status === 'on_track' && goal.eta
                  ? `vers ${fmtNum(profile.targetWeightKg)} kg · ≈ ${fmtDate(goal.eta, { month: 'short', year: 'numeric' })}`
                  : `vers ${fmtNum(profile.targetWeightKg)} kg · ${goal.progressPct} %`) + (profile.targetBodyFatPct !== undefined ? ` · ${fmtNum(profile.targetBodyFatPct)} % MG` : '')
            }
          />
        )}
        <Tile
          label="Masse grasse"
          icon="drop"
          value={comp?.bodyFatPct !== undefined ? `${fmtNum(comp.bodyFatPct)} %` : '—'}
          sub={comp?.fatKg !== undefined && firstComp?.fatKg !== undefined && sinceStart ? `${signed(comp.fatKg - firstComp.fatKg)} kg depuis le début` : comp?.fatKg !== undefined ? `${fmtNum(comp.fatKg)} kg` : 'Ajoute tes mensurations'}
        />
        <Tile
          label="Masse maigre"
          icon="dumbbell"
          tone="green"
          value={comp?.leanKg !== undefined ? `${fmtNum(comp.leanKg)} kg` : '—'}
          sub={comp?.leanKg !== undefined && firstComp?.leanKg !== undefined && sinceStart ? `${signed(comp.leanKg - firstComp.leanKg)} kg depuis le début` : comp?.ffmi ? `FFMI ${fmtNum(comp.ffmi)}${ffmiReliable(comp.bodyFatPct, profile.sex) ? '' : ' (peu fiable)'}` : undefined}
        />
        {muscle.length > 0 && (
          <Tile
            label="Muscle (balance)"
            icon="bolt"
            tone="green"
            value={`${fmtNum(muscle.at(-1))} kg`}
            sub={muscle.length > 1 ? `tendance ${signed(muscle.at(-1)! - muscle[0])} kg depuis le début` : 'Tanita'}
          />
        )}
        {cardio.length > 0 && (
          <Tile
            label="Marche aujourd’hui"
            icon="walk"
            tone="green"
            value={`${cardioToday.kcal} kcal`}
            sub={cardioToday.minutes ? `${fmtNum(cardioToday.steps, 0)} pas · ${fmtNum(cardioToday.distanceKm, 1)} km` : 'pas encore de marche'}
          />
        )}
        {nut && (
          <Tile
            label="Calories / jour"
            icon="flame"
            value={fmtNum(nut.calories, 0)}
            sub={
              eatenToday || proteinToday
                ? `mangé ${fmtNum(eatenToday, 0)} · reste ${fmtNum(Math.max(0, nut.calories - eatenToday), 0)} · prot. ${fmtNum(proteinToday, 1)}/${nut.proteinG} g`
                : `${nut.proteinG} g de protéines`
            }
          />
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2>Poids – tendance</h2>
            <button className="btn sm" onClick={() => go('body')}>
              <Icon name="plus" size={16} /> Pesée
            </button>
          </div>
          {trend.length >= 2 && (
            <div style={{ marginBottom: 8 }}>
              <Segmented value={range} options={RANGE_OPTIONS} onChange={setRange} />
            </div>
          )}
          {axis ? (
            <div className="chart sm">
              <ResponsiveContainer>
                <AreaChart data={breakGaps(shown)} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--series-1)" stopOpacity={0.22} />
                      <stop offset="1" stopColor="var(--series-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" type="number" domain={axis.domain} ticks={axis.ticks} tickFormatter={axis.format} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={16} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tickFormatter={(v) => fmtNum(v, 0)} />
                  <Tooltip content={<ChartTooltip unit=" kg" />} />
                  <Area type="monotone" dataKey="trend" name="Tendance" stroke="var(--series-1)" strokeWidth={2} fill="url(#weightFill)" connectNulls={false} dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>{trend.length >= 2 ? 'Pas assez de pesées sur cette période : choisis une période plus longue.' : 'Ajoute au moins 2 pesées pour voir ta courbe.'}</Empty>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Records récents</h2>
            <button className="btn ghost sm" onClick={() => go('progress')}>
              Tout voir <Icon name="arrow" size={16} />
            </button>
          </div>
          {prs.length ? (
            prs.map((p) => (
              <div className="pr-item" key={p.exerciseId + p.date}>
                <span className="pr-badge">
                  <Icon name="trophy" size={20} />
                </span>
                <div className="pr-main">
                  <div>{getExercise(p.exerciseId).name}</div>
                  <div className="small muted">
                    {fmtDate(p.date)} · {getExercise(p.exerciseId).bodyweight ? `PDC${p.weight ? ` + ${fmtNum(p.weight)} kg` : ''}` : `${fmtNum(p.weight)} kg`} × {p.reps}
                  </div>
                </div>
                <span className="status ok">1RM {fmtNum(p.e1rm)} kg</span>
              </div>
            ))
          ) : (
            <Empty>Tes records apparaîtront ici après tes premières séances.</Empty>
          )}
        </div>
      </div>
    </div>
  );
}

/** Anneau de régularité : séances faites cette semaine par rapport à l'objectif du profil. */
function WeekRing({ done, target }: { done: number; target: number }) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, done / target) : 0;
  return (
    <div className="ring" role="img" aria-label={`${done} séance${done > 1 ? 's' : ''} sur ${target} cette semaine`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div aria-hidden>
        <span className="ring-value">
          {done}/{target}
        </span>
        <span className="ring-label">séances</span>
      </div>
    </div>
  );
}

/** Séances où un exercice a battu son meilleur 1RM estimé précédent. */
function recentPRs(workouts: ReturnType<typeof useStore.getState>['workouts'], body: ReturnType<typeof useStore.getState>['body']) {
  const best = new Map<string, number>();
  const prs: { exerciseId: string; date: string; weight: number; reps: number; e1rm: number }[] = [];
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of w.exercises) {
      let top = { v: 0, weight: 0, reps: 0 };
      for (const s of ex.sets) {
        const v = s.done ? setE1rm(ex.exerciseId, s.weight, s.reps, bodyweightAt(body, w.date)) : 0;
        if (v > top.v) top = { v, weight: s.weight, reps: s.reps };
      }
      const prev = best.get(ex.exerciseId);
      if (top.v > 0 && (prev === undefined || top.v > prev)) {
        if (prev !== undefined) prs.push({ exerciseId: ex.exerciseId, date: w.date, weight: top.weight, reps: top.reps, e1rm: top.v });
        best.set(ex.exerciseId, top.v);
      }
    }
  }
  return prs.reverse();
}
