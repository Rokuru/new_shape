import { useState } from 'react';
import { addDays } from '../lib/dates';
import { uid, useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';
import type { FoodEntry } from '../lib/types';
import NumField from './NumField';
import Sheet from './Sheet';
import { fmtDate, fmtNum, Icon } from './ui';

const MAX_KCAL = 5000;
const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayTotal = (food: FoodEntry[], day: string) => food.filter((f) => f.date === day).reduce((s, f) => s + f.kcal, 0);

/** Saisie d'une prise : calories + libellé facultatif. */
function AddForm({ day, compact }: { day: string; compact?: boolean }) {
  const addFood = useStore((s) => s.addFood);
  const todayKey = useToday();
  const [kcal, setKcal] = useState(0);
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState('');
  const add = () => {
    if (!kcal) return setMsg('Indique un nombre de calories.');
    // Saisie d'un jour passé : heure fixée à midi pour garder l'ordre de la journée.
    const at = day === todayKey ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
    addFood({ id: uid(), date: day, at, kcal, label: label.trim() || undefined });
    setKcal(0);
    setLabel('');
    setMsg('');
  };
  return (
    <>
      <div className={`food-add ${compact ? 'compact' : ''}`}>
        <label className="field">
          Calories
          <NumField value={kcal} max={MAX_KCAL} decimals={0} placeholder="ex. 650" onChange={setKcal} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <label className="field">
          Repas (facultatif)
          <input value={label} placeholder="Déjeuner, collation…" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <button className="btn primary" onClick={add}>
          <Icon name="plus" size={18} /> Ajouter
        </button>
      </div>
      {msg && <p className="field-error">{msg}</p>}
    </>
  );
}

function EntryRow({ e }: { e: FoodEntry }) {
  const { updateFood, deleteFood } = useStore();
  const [editing, setEditing] = useState(false);
  const [kcal, setKcal] = useState(e.kcal);
  const [label, setLabel] = useState(e.label ?? '');
  if (editing) {
    return (
      <li className="food-row editing">
        <NumField aria-label="Calories" value={kcal} max={MAX_KCAL} decimals={0} onChange={setKcal} />
        <input aria-label="Repas" value={label} placeholder="Repas" onChange={(ev) => setLabel(ev.target.value)} />
        <button
          className="btn primary sm"
          disabled={!kcal}
          onClick={() => {
            updateFood({ ...e, kcal, label: label.trim() || undefined });
            setEditing(false);
          }}
        >
          OK
        </button>
        <button className="btn ghost sm" onClick={() => (setKcal(e.kcal), setLabel(e.label ?? ''), setEditing(false))}>
          Annuler
        </button>
      </li>
    );
  }
  return (
    <li className="food-row">
      <span className="small muted">{time(e.at)}</span>
      <span className="food-label">{e.label ?? 'Sans nom'}</span>
      <b>{fmtNum(e.kcal, 0)} kcal</b>
      <span className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
        <button className="btn ghost sm" aria-label={`Modifier ${e.label ?? 'la ligne'}`} onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} />
        </button>
        <button className="btn ghost sm danger" aria-label={`Supprimer ${e.label ?? 'la ligne'}`} onClick={() => confirm(`Supprimer ${fmtNum(e.kcal, 0)} kcal${e.label ? ` (${e.label})` : ''} ?`) && deleteFood(e.id)}>
          <Icon name="trash" size={16} />
        </button>
      </span>
    </li>
  );
}

/** Historique des prises : navigation par jour, modification, suppression, ajout oublié. */
function FoodHistory({ target, onClose }: { target: number; onClose: () => void }) {
  const food = useStore((s) => s.food);
  const todayKey = useToday();
  const [day, setDay] = useState(todayKey);
  const entries = food.filter((f) => f.date === day).sort((a, b) => a.at.localeCompare(b.at));
  const total = dayTotal(food, day);
  const week = Array.from({ length: 7 }, (_, i) => addDays(todayKey, -i));
  return (
    <Sheet title="Mangé" kicker="Historique" onClose={onClose}>
      <div className="day-nav">
        <button className="btn ghost sm" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))}>
          ‹
        </button>
        <b>{day === todayKey ? 'Aujourd’hui' : fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
        <button className="btn ghost sm" aria-label="Jour suivant" disabled={day >= todayKey} onClick={() => setDay(addDays(day, 1))}>
          ›
        </button>
      </div>
      <p className="secondary" style={{ textAlign: 'center', margin: '4px 0 10px' }}>
        <b>{fmtNum(total, 0)}</b> / {fmtNum(target, 0)} kcal
      </p>
      {entries.length ? (
        <ul className="food-list">
          {entries.map((e) => (
            <EntryRow key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="small muted" style={{ textAlign: 'center' }}>
          Rien d’enregistré ce jour-là.
        </p>
      )}
      <h3>Ajouter {day === todayKey ? '' : `au ${fmtDate(day, { day: 'numeric', month: 'long' })}`}</h3>
      <AddForm day={day} compact />
      <h3>7 derniers jours</h3>
      <ul className="food-week">
        {week.map((d) => {
          const t = dayTotal(food, d);
          return (
            <li key={d}>
              <button className={`food-week-row ${d === day ? 'on' : ''}`} onClick={() => setDay(d)}>
                <span>{d === todayKey ? 'Aujourd’hui' : fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="food-week-bar">
                  <span style={{ width: `${Math.min(100, (t / target) * 100)}%` }} className={t > target ? 'over' : ''} />
                </span>
                <span className="small">{t ? `${fmtNum(t, 0)} kcal` : '—'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** Carte « Mangé aujourd'hui » : total du jour (0 au réveil), reste par rapport à la cible, ajout rapide. */
export default function FoodLog({ target }: { target: number }) {
  const food = useStore((s) => s.food);
  const todayKey = useToday();
  const [open, setOpen] = useState(false);
  const total = dayTotal(food, todayKey);
  const count = food.filter((f) => f.date === todayKey).length;
  const left = target - total;
  const pct = Math.min(100, Math.round((total / target) * 100));
  return (
    <div className="card food-card">
      <div className="card-header">
        <h2>Mangé aujourd’hui</h2>
        <button className="btn ghost sm" onClick={() => setOpen(true)}>
          <Icon name="list" size={16} /> Historique{count ? ` (${count})` : ''}
        </button>
      </div>
      <div className="food-total">
        <span className="goal-big">{fmtNum(total, 0)}</span>
        <span className="secondary"> / {fmtNum(target, 0)} kcal</span>
      </div>
      <div className="goal-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Calories mangées par rapport à la cible">
        <span style={{ width: `${pct}%` }} className={left < 0 ? 'over' : ''} />
      </div>
      <p className="small" style={{ margin: '6px 0 12px', color: left < 0 ? 'var(--critical)' : undefined }}>
        {left >= 0 ? `Reste ${fmtNum(left, 0)} kcal` : `Cible dépassée de ${fmtNum(-left, 0)} kcal`}
      </p>
      <AddForm day={todayKey} />
      {open && <FoodHistory target={target} onClose={() => setOpen(false)} />}
    </div>
  );
}
