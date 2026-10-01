import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Tab } from '../App';
import { getExercise } from '../data/exercises';
import { bodyweightAt, currentComposition, initialComposition, setE1rm, nutritionTargets, startOfWeek, weeklyRate, weightTrend } from '../lib/calc';
import { allPrograms, useStore } from '../lib/store';
import { ChartTooltip, Empty, fmtDate, fmtNum, signed, Tile } from '../components/ui';

export default function Dashboard({ go }: { go: (t: Tab) => void }) {
  const { profile, body, workouts, customPrograms, activeProgramId, nextDayIndex, activeWorkout, startWorkout, kcalAdjust } = useStore();
  const program = allPrograms(customPrograms).find((p) => p.id === activeProgramId);
  const latest = body.at(-1);
  const comp = currentComposition(body, profile);
  const firstComp = initialComposition(body, profile);
  const sinceStart = firstComp && comp && firstComp.bfDate !== comp.bfDate;
  const rate = weeklyRate(body);
  const trend = weightTrend(body).slice(-60);
  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = workouts.filter((w) => new Date(w.date).getTime() >= weekStart).length;
  const nut = latest && comp ? nutritionTargets(profile, { ...latest, weightKg: comp.weightKg }, comp.bodyFatPct, kcalAdjust) : undefined;

  const prs = recentPRs(workouts, body).slice(0, 4);
  const nextDay = program?.days[nextDayIndex % program.days.length];

  return (
    <div>
      <h1>Salut{profile.name ? ` ${profile.name}` : ''} 👋</h1>
      <p className="secondary">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      <div className="card">
        {activeWorkout ? (
          <div className="spread">
            <div>
              <div className="small secondary">Séance en cours</div>
              <h2 style={{ margin: 0 }}>{activeWorkout.dayName}</h2>
            </div>
            <button className="btn primary" onClick={() => go('workout')}>
              Reprendre
            </button>
          </div>
        ) : program && nextDay ? (
          <div className="spread">
            <div style={{ minWidth: 0 }}>
              <div className="small secondary">Prochaine séance · {program.name}</div>
              <h2 style={{ margin: '2px 0' }}>{nextDay.name}</h2>
              <div className="small muted">{nextDay.exercises.map((e) => getExercise(e.exerciseId).name).join(' · ')}</div>
            </div>
            <button
              className="btn primary"
              onClick={() => {
                startWorkout(program, nextDayIndex % program.days.length);
                go('workout');
              }}
            >
              Démarrer
            </button>
          </div>
        ) : (
          <div className="spread">
            <span>Aucun programme actif.</span>
            <button className="btn primary" onClick={() => go('programs')}>
              Choisir
            </button>
          </div>
        )}
      </div>

      <div className="tiles">
        <Tile
          label="Poids (tendance)"
          value={trend.length ? `${fmtNum(trend.at(-1)!.trend)} kg` : '—'}
          sub={rate !== undefined ? `${signed(rate, 2)} kg / sem.` : 'Pèse-toi 3×/sem.'}
        />
        <Tile
          label="Masse grasse"
          value={comp?.bodyFatPct !== undefined ? `${fmtNum(comp.bodyFatPct)} %` : '—'}
          sub={comp?.fatKg !== undefined && firstComp?.fatKg !== undefined && sinceStart ? `${signed(comp.fatKg - firstComp.fatKg)} kg depuis le début` : comp?.fatKg !== undefined ? `${fmtNum(comp.fatKg)} kg` : 'Ajoute tes mensurations'}
        />
        <Tile
          label="Masse maigre"
          value={comp?.leanKg !== undefined ? `${fmtNum(comp.leanKg)} kg` : '—'}
          sub={comp?.leanKg !== undefined && firstComp?.leanKg !== undefined && sinceStart ? `${signed(comp.leanKg - firstComp.leanKg)} kg depuis le début` : comp?.ffmi ? `FFMI ${fmtNum(comp.ffmi)}` : undefined}
        />
        <Tile label="Séances cette semaine" value={`${thisWeek} / ${profile.daysPerWeek}`} sub={`${workouts.length} au total`} />
        {nut && <Tile label="Calories / jour" value={fmtNum(nut.calories, 0)} sub={`${nut.proteinG} g de protéines`} />}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Poids – tendance lissée</h3>
            <button className="btn ghost sm" onClick={() => go('body')}>
              Ajouter une pesée
            </button>
          </div>
          {trend.length >= 2 ? (
            <div className="chart sm">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tickFormatter={(v) => fmtNum(v, 0)} />
                  <Tooltip content={<ChartTooltip unit=" kg" />} />
                  <Area type="monotone" dataKey="trend" name="Tendance" stroke="var(--series-1)" strokeWidth={2} fill="var(--band)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>Ajoute au moins 2 pesées pour voir ta courbe.</Empty>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Records récents</h3>
            <button className="btn ghost sm" onClick={() => go('progress')}>
              Tout voir
            </button>
          </div>
          {prs.length ? (
            prs.map((p) => (
              <div className="list-item" key={p.exerciseId + p.date}>
                <div>
                  <div>{getExercise(p.exerciseId).name}</div>
                  <div className="small muted">
                    {fmtDate(p.date)} · {getExercise(p.exerciseId).bodyweight ? `PDC${p.weight ? ` + ${fmtNum(p.weight)} kg` : ''}` : `${fmtNum(p.weight)} kg`} × {p.reps}
                  </div>
                </div>
                <span className="status ok">1RM est. {fmtNum(p.e1rm)} kg</span>
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
