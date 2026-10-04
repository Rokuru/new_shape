import { useMemo, useState } from 'react';
import Sheet from './Sheet';
import { fmtNum, Icon } from './ui';
import { currentComposition, nutritionTargets } from '../lib/calc';
import { activityAverage } from '../lib/energy';
import { activityByDay, currentStreak, kcalMin, monthGrid, type DayActivity } from '../lib/streak';
import { useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Flamme colorée selon le niveau (1 à 3). */
function Flame({ level, size = 22 }: { level: number; size?: number }) {
  return (
    <svg className={`flame lvl${level}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 22c3.9 0 7-2.8 7-6.6 0-3.1-1.9-5.2-3.5-7-.5 1.6-1.4 2.6-2.6 3.1.4-3.4-1.4-6.3-4-8.5-.2 3.5-1.9 5.5-3.3 7.2C4.6 11.4 5 12.9 5 15.4 5 19.2 8.1 22 12 22z" />
      {level >= 2 && <path className="flame-core" d="M12 21c1.9 0 3.3-1.3 3.3-3.1 0-1.5-.9-2.6-1.8-3.5-.3.9-.8 1.4-1.4 1.6.2-1.6-.6-2.9-1.8-3.9-.1 1.6-.9 2.6-1.5 3.4-.4.6-.4 1.3-.4 2.4 0 1.8 1.5 3.1 3.6 3.1z" />}
    </svg>
  );
}

function useActivity() {
  const { workouts, cardio, food, body, profile, kcalAdjust } = useStore();
  const today = useToday();
  return useMemo(() => {
    const latest = body.at(-1);
    const comp = currentComposition(body, profile);
    const target =
      latest && comp ? nutritionTargets(profile, { ...latest, weightKg: comp.weightKg }, comp.bodyFatPct, kcalAdjust, activityAverage({ workouts, cardio, profile }, comp.weightKg).perDay).calories : undefined;
    const days = activityByDay({ workouts, cardio, food, sex: profile.sex, kcalTarget: target });
    return { days, target, min: kcalMin(profile.sex), streak: currentStreak(days, today), today };
  }, [workouts, cardio, food, body, profile, kcalAdjust, today]);
}

/** Bouton de la barre du haut : flamme + série en cours ; ouvre le calendrier du mois. */
export function StreakButton({ className = 'icon-btn streak-btn', withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const { days, streak, today } = useActivity();
  const todayLevel = days.get(today)?.level ?? 0;
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} aria-label={`Calendrier d’activité, série de ${streak} jour${streak > 1 ? 's' : ''}`}>
        <span className={`streak-icon ${withLabel ? 'side-icon' : ''}`}>
          <Flame level={todayLevel || (streak > 0 ? 1 : 0)} size={20} />
          {streak > 0 && <b className="streak-count">{streak}</b>}
        </span>
        {withLabel && <span className="side-label">Calendrier</span>}
      </button>
      {open && <StreakSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function StreakSheet({ onClose }: { onClose: () => void }) {
  const { days, target, min, streak, today } = useActivity();
  const [month, setMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { y, m: m - 1 };
  });
  const [selected, setSelected] = useState(today);
  const cells = monthGrid(month.y, month.m);
  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));
  const isCurrentMonth = today.startsWith(`${month.y}-${String(month.m + 1).padStart(2, '0')}`);
  const active = cells.filter((d): d is string => d !== null && (days.get(d)?.level ?? 0) > 0).length;
  const sel: DayActivity | undefined = days.get(selected);

  return (
    <Sheet title="Calendrier d’activité" kicker={streak > 0 ? `🔥 Série en cours : ${streak} jour${streak > 1 ? 's' : ''}` : 'Pas de série en cours'} onClose={onClose}>
      <div className="cal-head">
        <button className="btn ghost sm" onClick={() => shift(-1)} aria-label="Mois précédent">
          <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
            <Icon name="chevron" size={18} />
          </span>
        </button>
        <b className="cal-month">{monthLabel}</b>
        <button className="btn ghost sm" onClick={() => shift(1)} aria-label="Mois suivant" disabled={isCurrentMonth}>
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <div className="cal-grid" role="grid" aria-label={monthLabel}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="cal-wd" aria-hidden>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const level = days.get(day)?.level ?? 0;
          const future = day > today;
          return (
            <button
              key={day}
              className={`cal-day ${day === today ? 'today' : ''} ${day === selected ? 'sel' : ''}`}
              disabled={future}
              onClick={() => setSelected(day)}
              aria-label={`${Number(day.slice(8))} : ${level ? `${level} flamme${level > 1 ? 's' : ''}` : 'rien'}`}
            >
              <span className="cal-num">{Number(day.slice(8))}</span>
              <span className="cal-flame">{level > 0 && <Flame level={level} size={level === 3 ? 26 : level === 2 ? 21 : 16} />}</span>
            </button>
          );
        })}
      </div>
      <p className="small secondary" style={{ textAlign: 'center', margin: '6px 0 12px' }}>
        {active} jour{active > 1 ? 's' : ''} actif{active > 1 ? 's' : ''} ce mois-ci
      </p>

      <div className="card" style={{ margin: 0 }}>
        <b>{new Date(selected + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
        <ul className="cal-detail">
          <li className={sel?.sport ? 'ok' : ''}>{sel?.sport ? '✓' : '–'} Séance de musculation</li>
          <li className={sel?.extra ? 'ok' : ''}>{sel?.extra ? '✓' : '–'} Activité en plus (marche, tapis)</li>
          <li className={sel?.kcalOk ? 'ok' : ''}>
            {sel?.kcalOk ? '✓' : '–'} Calories dans la cible
            <span className="muted">
              {' '}
              ({sel?.kcal !== undefined ? `${fmtNum(sel.kcal, 0)} kcal notées` : 'rien de noté'}
              {target !== undefined && `, entre ${fmtNum(min, 0)} et ${fmtNum(target, 0)}`})
            </span>
          </li>
        </ul>
      </div>

      <div className="cal-legend small secondary">
        <span>
          <Flame level={1} size={14} /> 1 critère
        </span>
        <span>
          <Flame level={2} size={18} /> 2 critères
        </span>
        <span>
          <Flame level={3} size={22} /> les 3
        </span>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Une flamme par critère rempli dans la journée : séance de musculation, marche ou tapis, et calories notées entre le minimum de sécurité et ton objectif. La série compte les jours
        consécutifs avec au moins une flamme ; aujourd’hui ne la casse pas tant que la journée n’est pas finie.
      </p>
    </Sheet>
  );
}
