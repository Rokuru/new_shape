import { useState } from 'react';
import { useToday } from '../hooks/useToday';
import { addDays, firstOfMonth } from '../lib/dates';
import { deficitStart, kcalGoal } from '../lib/deficit';
import { useStore } from '../lib/store';
import Sheet from './Sheet';
import { fmtDate, fmtNum } from './ui';

const longDate = (d: string) => firstOfMonth(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

/** Départ du compteur « Calories à perdre », indépendant de la date de départ du plan. */
export default function DeficitStartSheet({ onClose }: { onClose: () => void }) {
  const { profile, body, setProfile } = useStore();
  const today = useToday();
  const current = deficitStart(profile) ?? today;
  const [start, setStart] = useState(current);
  const [err, setErr] = useState('');
  const min = addDays(today, -730);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && start >= min && start <= today;
  // Sans date choisie, le compteur repart du départ du plan, sinon de la date de l'objectif.
  const fallback = profile.plan?.start ?? profile.targetSetAt;
  const preview = valid ? kcalGoal({ ...profile, deficitStart: start }, body) : undefined;

  const save = () => {
    if (!valid) return setErr(`Choisis une date entre le ${firstOfMonth(fmtDate(min, { day: 'numeric', month: 'long', year: 'numeric' }))} et aujourd’hui.`);
    setProfile({ deficitStart: start });
    onClose();
  };

  return (
    <Sheet title="Départ du compteur" kicker="Calories à perdre" onClose={onClose}>
      <p className="small secondary" style={{ marginTop: 0 }}>
        Les calories perdues se comptent à partir de ce jour-là, sans changer la date de ton plan. L’objectif est recalculé avec ton poids et ton % de gras de ce jour-là : les
        calories perdues avant ne comptent pas deux fois.
      </p>
      <label className="field">
        Compter à partir du
        <input
          type="date"
          value={start}
          min={min}
          max={today}
          onChange={(e) => {
            setStart(e.target.value);
            setErr('');
          }}
        />
      </label>
      {preview && (
        <p className="small secondary">
          Objectif à partir du {longDate(start)} :{' '}
          {preview.basis === 'fat'
            ? `${fmtNum(preview.toLoseKg)} kg de gras à perdre (${fmtNum(preview.startKg)} kg à ${fmtNum(preview.startBf)} % ce jour-là)`
            : `${fmtNum(preview.toLoseKg)} kg à perdre (${fmtNum(preview.startKg)} kg ce jour-là)`}{' '}
          × 7 700 ≈ <b>{fmtNum(Math.round(preview.kcal / 100) * 100, 0)} kcal</b>.
        </p>
      )}
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={save} disabled={start === current}>
          Enregistrer
        </button>
        {profile.deficitStart && fallback && (
          <button
            className="btn"
            onClick={() => {
              setProfile({ deficitStart: undefined });
              onClose();
            }}
          >
            Revenir {profile.plan ? 'au départ du plan' : 'à la date de l’objectif'} ({firstOfMonth(fmtDate(fallback, { day: 'numeric', month: 'short' }))})
          </button>
        )}
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Sheet>
  );
}
