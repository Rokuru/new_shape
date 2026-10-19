import { useState } from 'react';
import { addDays } from '../lib/dates';
import { copyMeals, uid, useStore } from '../lib/store';
import { useToday } from '../hooks/useToday';
import type { FoodEntry, FoodFavorite } from '../lib/types';
import NumField from './NumField';
import Sheet from './Sheet';
import { fmtDate, fmtNum, Icon } from './ui';
import { useConfirm } from './ConfirmDialog';

const MAX_KCAL = 5000;
const MAX_PROT = 300;
const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayTotal = (food: FoodEntry[], day: string) => food.filter((f) => f.date === day).reduce((s, f) => s + f.kcal, 0);
const dayProtein = (food: FoodEntry[], day: string) => food.filter((f) => f.date === day).reduce((s, f) => s + (f.proteinG ?? 0), 0);
/** Heure d'une saisie : maintenant pour aujourd'hui, midi pour un jour passé (l'ordre de la journée est gardé). */
const atFor = (day: string, todayKey: string) => (day === todayKey ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString());
const favLabel = (kcal: number, label?: string) => label?.trim() || `${fmtNum(kcal, 0)} kcal`;
const sameFav = (f: FoodFavorite, label: string) => f.label.toLowerCase() === label.toLowerCase();

/** Repas favoris : un geste pour les ajouter au jour affiché ; « Gérer » pour en retirer. */
function FavoriteChips({ day }: { day: string }) {
  const { foodFavorites, addFood, removeFavorite } = useStore();
  const ask = useConfirm();
  const todayKey = useToday();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  if (!foodFavorites.length) return null;
  const favs = [...foodFavorites].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const add = (f: FoodFavorite) => {
    addFood({ id: uid(), date: day, at: atFor(day, todayKey), kcal: f.kcal, proteinG: f.proteinG, label: f.label });
    setMsg(`Ajouté : ${f.label} (${fmtNum(f.kcal, 0)} kcal)`);
    setTimeout(() => setMsg(''), 3000);
  };
  return (
    <div className="food-favs">
      <div className="spread">
        <span className="small secondary">
          <Icon name="star" size={14} /> Favoris {editing ? '· touche pour retirer' : '· touche pour ajouter'}
        </span>
        <button className="btn ghost sm" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Terminé' : 'Gérer'}
        </button>
      </div>
      <div className="chips">
        {favs.map((f) =>
          editing ? (
            <button key={f.id} type="button" className="chip fav-remove" onClick={async () => (await ask({ title: `Retirer « ${f.label} » des favoris ?`, message: 'Les repas déjà notés ne changent pas.', confirmLabel: 'Retirer' })) && removeFavorite(f.id)} aria-label={`Retirer ${f.label} des favoris`}>
              <Icon name="x" size={14} /> {f.label}
            </button>
          ) : (
            <button key={f.id} type="button" className="chip" onClick={() => add(f)} aria-label={`Ajouter ${f.label}`}>
              {f.label} · {fmtNum(f.kcal, 0)} kcal{f.proteinG ? ` · ${fmtNum(f.proteinG, 1)} g` : ''}
            </button>
          ),
        )}
      </div>
      {msg && (
        <p className="small" role="status" style={{ margin: '6px 0 0' }}>
          {msg}
        </p>
      )}
    </div>
  );
}

/** « Refaire hier » : recopie les repas de la veille sur un jour encore vide. */
function CopyPreviousDay({ day }: { day: string }) {
  const { food, copyFoodDay } = useStore();
  const todayKey = useToday();
  const prev = addDays(day, -1);
  const prevEntries = food.filter((f) => f.date === prev);
  if (food.some((f) => f.date === day) || !prevEntries.length) return null;
  const total = prevEntries.reduce((s, f) => s + f.kcal, 0);
  return (
    <button className="btn block food-copy" onClick={() => copyFoodDay(prev, day)}>
      <Icon name="refresh" size={16} /> {day === todayKey ? 'Refaire hier' : `Copier le ${fmtDate(prev, { weekday: 'long', day: 'numeric' })}`} ({prevEntries.length} repas · {fmtNum(total, 0)} kcal)
    </button>
  );
}

/** Saisie d'une prise : calories + libellé facultatif. */
function AddForm({ day, compact }: { day: string; compact?: boolean }) {
  const { addFood, addFavorite } = useStore();
  const todayKey = useToday();
  const [kcal, setKcal] = useState(0);
  const [prot, setProt] = useState(0);
  const [label, setLabel] = useState('');
  const [fav, setFav] = useState(false);
  const [msg, setMsg] = useState('');
  const add = () => {
    if (!kcal && !prot) return setMsg('Indique des calories (et/ou des protéines).');
    if (prot * 4 > kcal && kcal) return setMsg(`${fmtNum(prot, 1)} g de protéines font déjà ${fmtNum(prot * 4, 0)} kcal : vérifie les calories.`);
    addFood({ id: uid(), date: day, at: atFor(day, todayKey), kcal, proteinG: prot || undefined, label: label.trim() || undefined });
    if (fav) addFavorite({ id: uid(), label: favLabel(kcal, label), kcal, proteinG: prot || undefined });
    setKcal(0);
    setProt(0);
    setLabel('');
    setFav(false);
    setMsg('');
  };
  return (
    <>
      <div className={`food-add ${compact ? 'compact' : ''}`}>
        <label className="field">
          Calories
          <NumField value={kcal} max={MAX_KCAL} decimals={0} placeholder="ex. 650" onChange={(v) => (setKcal(v), setMsg(''))} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <label className="field">
          Protéines (g)
          <NumField value={prot} max={MAX_PROT} decimals={1} placeholder="facultatif" onChange={(v) => (setProt(v), setMsg(''))} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <label className="field">
          Repas (facultatif)
          <input value={label} placeholder="Déjeuner, collation…" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <button className="btn primary" onClick={add}>
          <Icon name="plus" size={18} /> Ajouter
        </button>
      </div>
      <label className="check-inline small">
        <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} /> Enregistrer en favori
      </label>
      {msg && <p className="field-error">{msg}</p>}
    </>
  );
}

function EntryRow({ e }: { e: FoodEntry }) {
  const { updateFood, deleteFood, addFood, foodFavorites, addFavorite, removeFavorite } = useStore();
  const ask = useConfirm();
  const todayKey = useToday();
  const name = favLabel(e.kcal, e.label);
  const fav = foodFavorites.find((f) => sameFav(f, name));
  const [editing, setEditing] = useState(false);
  const [kcal, setKcal] = useState(e.kcal);
  const [prot, setProt] = useState(e.proteinG ?? 0);
  const [label, setLabel] = useState(e.label ?? '');
  if (editing) {
    return (
      <li className="food-row editing">
        <NumField aria-label="Calories" value={kcal} max={MAX_KCAL} decimals={0} placeholder="kcal" onChange={setKcal} />
        <NumField aria-label="Protéines" value={prot} max={MAX_PROT} decimals={1} placeholder="g prot." onChange={setProt} />
        <input aria-label="Repas" value={label} placeholder="Repas" onChange={(ev) => setLabel(ev.target.value)} />
        <button
          className="btn primary sm"
          disabled={!kcal && !prot}
          onClick={() => {
            updateFood({ ...e, kcal, proteinG: prot || undefined, label: label.trim() || undefined });
            setEditing(false);
          }}
        >
          OK
        </button>
        <button className="btn ghost sm" onClick={() => (setKcal(e.kcal), setProt(e.proteinG ?? 0), setLabel(e.label ?? ''), setEditing(false))}>
          Annuler
        </button>
      </li>
    );
  }
  return (
    <li className="food-row">
      <span className="small muted">{time(e.at)}</span>
      <span className="food-label">{e.label ?? 'Sans nom'}</span>
      <span className="food-amount">
        <b>{e.kcal ? `${fmtNum(e.kcal, 0)} kcal` : '— kcal'}</b>
        {e.proteinG ? <span className="small muted">{fmtNum(e.proteinG, 1)} g prot.</span> : null}
      </span>
      <span className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
        <button
          className={`btn ghost sm fav-toggle ${fav ? 'on' : ''}`}
          aria-pressed={!!fav}
          aria-label={fav ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
          onClick={async () => {
            if (!fav) return addFavorite({ id: uid(), label: name, kcal: e.kcal, proteinG: e.proteinG });
            if (await ask({ title: `Retirer « ${fav.label} » des favoris ?`, message: 'Les repas déjà notés ne changent pas.', confirmLabel: 'Retirer' })) removeFavorite(fav.id);
          }}
        >
          <Icon name="star" size={16} />
        </button>
        {e.date !== todayKey && (
          <button className="btn ghost sm" aria-label={`Refaire ${name} aujourd’hui`} title="Refaire aujourd’hui" onClick={() => copyMeals([e], todayKey).forEach(addFood)}>
            <Icon name="refresh" size={16} />
          </button>
        )}
        <button className="btn ghost sm" aria-label={`Modifier ${e.label ?? 'la ligne'}`} onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} />
        </button>
        <button className="btn ghost sm danger" aria-label={`Supprimer ${e.label ?? 'la ligne'}`} onClick={async () => (await ask({ title: `Supprimer ${e.label ? `« ${e.label} »` : 'ce repas'} ?`, message: `${fmtNum(e.kcal, 0)} kcal${e.proteinG ? `, ${fmtNum(e.proteinG, 1)} g de protéines` : ''}.` })) && deleteFood(e.id)}>
          <Icon name="trash" size={16} />
        </button>
      </span>
    </li>
  );
}

/** Historique des prises : navigation par jour, modification, suppression, ajout oublié. */
function FoodHistory({ target, proteinTarget, onClose }: { target: number; proteinTarget: number; onClose: () => void }) {
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
        <b>{fmtNum(total, 0)}</b> / {fmtNum(target, 0)} kcal · <b>{fmtNum(dayProtein(food, day), 1)}</b> / {proteinTarget} g de protéines
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
      <CopyPreviousDay day={day} />
      <FavoriteChips day={day} />
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
                <span className="small">
                  {t ? `${fmtNum(t, 0)} kcal` : '—'}
                  {dayProtein(food, d) ? <span className="muted"> · {fmtNum(dayProtein(food, d), 1)} g</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** Carte « Mangé aujourd'hui » : total du jour (0 au réveil), reste par rapport à la cible, ajout rapide. */
export default function FoodLog({ target, proteinTarget }: { target: number; proteinTarget: number }) {
  const food = useStore((s) => s.food);
  const todayKey = useToday();
  const [open, setOpen] = useState(false);
  const total = dayTotal(food, todayKey);
  const count = food.filter((f) => f.date === todayKey).length;
  const left = target - total;
  const pct = Math.min(100, Math.round((total / target) * 100));
  const protein = dayProtein(food, todayKey);
  const protPct = Math.min(100, Math.round((protein / proteinTarget) * 100));
  const protLeft = proteinTarget - protein;
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
      <div className="food-prot">
        <div className="spread small">
          <span>
            <b>Protéines</b> {fmtNum(protein, 1)} / {proteinTarget} g
          </span>
          <span className={protLeft <= 0 ? 'delta-good' : 'muted'}>{protLeft > 0 ? `reste ${fmtNum(protLeft, 1)} g` : 'objectif atteint ✓'}</span>
        </div>
        <div className="goal-bar thin prot" role="progressbar" aria-valuenow={protPct} aria-valuemin={0} aria-valuemax={100} aria-label="Protéines mangées par rapport à la cible">
          <span style={{ width: `${protPct}%` }} />
        </div>
      </div>
      <CopyPreviousDay day={todayKey} />
      <FavoriteChips day={todayKey} />
      <AddForm day={todayKey} />
      {open && <FoodHistory target={target} proteinTarget={proteinTarget} onClose={() => setOpen(false)} />}
    </div>
  );
}
