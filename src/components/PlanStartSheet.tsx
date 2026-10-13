import { useState } from 'react';
import { useToday } from '../hooks/useToday';
import { addDays } from '../lib/dates';
import { planEnd, planStatus, weekSessions, weekSpan } from '../lib/plan';
import { useStore } from '../lib/store';
import Sheet from './Sheet';
import { fmtDate } from './ui';

const longDate = (d: string) => fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayMonth = (d: string) => fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' });

/** Date de début du plan appliqué : phases, séries ajustées, semaines allégées et suivi mensuel se recalent dessus. */
export default function PlanStartSheet({ onClose }: { onClose: () => void }) {
  const { profile, setPlanStart } = useStore();
  const today = useToday();
  const st = planStatus(profile, today);
  const [start, setStart] = useState(st?.start ?? today);
  const [err, setErr] = useState('');
  if (!st) return null;
  const { tpl } = st;
  // Garde-fou contre une faute de frappe (année 2062…) : plan déjà en cours ou départ dans l'année.
  const min = addDays(today, -tpl.weeks * 7);
  const max = addDays(today, 365);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && start >= min && start <= max;

  const save = () => {
    if (!valid) return setErr(`Choisis une date entre le ${dayMonth(min)} et le ${dayMonth(max)}.`);
    setPlanStart(start);
    onClose();
  };

  return (
    <Sheet title="Date de début du plan" kicker={tpl.name} onClose={onClose}>
      <p className="small secondary" style={{ marginTop: 0 }}>
        Mets le jour de ta 1re séance : les semaines du plan partent de ce jour-là. Phases, séries ajustées, semaines allégées et points de suivi suivent la nouvelle date. Tes
        séances et mesures ne changent pas.
      </p>
      <label className="field">
        Date de début
        <input
          type="date"
          value={start}
          min={min}
          max={max}
          onChange={(e) => {
            setStart(e.target.value);
            setErr('');
          }}
        />
      </label>
      {valid && (
        <p className="small secondary">
          Semaines {weekSpan(start)}. Semaine 1 :{' '}
          {weekSessions(tpl, 1, start)
            .map((x) => `${x.day} ${x.name}`)
            .join(', ')}
          . Fin du plan le <b>{longDate(planEnd(tpl, start))}</b>.
        </p>
      )}
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={save} disabled={start === st.start}>
          Enregistrer
        </button>
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Sheet>
  );
}
