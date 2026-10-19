import { useState } from 'react';
import { useToday } from '../hooks/useToday';
import { useStore } from '../lib/store';
import type { Checkin } from '../lib/types';

type Key = 'sleep' | 'energy' | 'hunger' | 'soreness';

/** Les 4 questions du point du jour, notées de 1 à 5. */
export const CHECKIN_QUESTIONS: { key: Key; label: string; low: string; high: string }[] = [
  { key: 'sleep', label: 'Sommeil', low: 'très mauvais', high: 'excellent' },
  { key: 'energy', label: 'Énergie', low: 'vidé', high: 'au top' },
  { key: 'hunger', label: 'Faim', low: 'aucune', high: 'affamé' },
  { key: 'soreness', label: 'Courbatures', low: 'aucune', high: 'fortes' },
];

/** « Sommeil 4/5 · Énergie 3/5 · … » pour un point du jour. */
export const checkinSummary = (c: Checkin) =>
  CHECKIN_QUESTIONS.filter((q) => c[q.key] !== undefined)
    .map((q) => `${q.label} ${c[q.key]}/5`)
    .join(' · ');

/** Point du jour en 10 secondes : sommeil, énergie, faim, courbatures, et une note. Repli une fois rempli. */
export default function CheckinCard() {
  const { checkins, setCheckin } = useStore();
  const today = useToday();
  const c = checkins.find((x) => x.date === today);
  const complete = CHECKIN_QUESTIONS.every((q) => c?.[q.key] !== undefined);
  const [open, setOpen] = useState(false);
  const showForm = !complete || open;

  return (
    <div className="card checkin-card">
      <div className="card-header">
        <h2>Point du jour</h2>
        {complete && (
          <button className="btn ghost sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Terminé' : 'Modifier'}
          </button>
        )}
      </div>
      {!showForm && c ? (
        <p className="small secondary" style={{ margin: 0 }}>
          ✓ {checkinSummary(c)}
          {c.note ? ` · « ${c.note} »` : ''}
        </p>
      ) : (
        <>
          <p className="small secondary" style={{ marginTop: 0 }}>
            10 secondes, de 1 à 5 : Claude s’en sert dans ton bilan pour juger ta récupération.
          </p>
          {CHECKIN_QUESTIONS.map((q) => (
            <div className="checkin-row" key={q.key}>
              <span className="checkin-label">{q.label}</span>
              <div className="checkin-scale" role="radiogroup" aria-label={`${q.label}, de 1 (${q.low}) à 5 (${q.high})`}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={c?.[q.key] === v}
                    aria-label={`${q.label} : ${v} sur 5`}
                    className={c?.[q.key] === v ? 'on' : ''}
                    onClick={() => setCheckin(today, { [q.key]: c?.[q.key] === v ? undefined : v })}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="checkin-ends small muted">
                1 {q.low} · 5 {q.high}
              </span>
            </div>
          ))}
          <label className="field" style={{ marginTop: 8 }}>
            Note (facultatif)
            <input
              value={c?.note ?? ''}
              maxLength={500}
              placeholder="Genou qui tire, mal dormi, stress au travail…"
              onChange={(e) => setCheckin(today, { note: e.target.value || undefined })}
            />
          </label>
        </>
      )}
    </div>
  );
}
