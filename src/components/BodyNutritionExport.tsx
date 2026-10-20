import { useMemo, useState } from 'react';
import { useToday } from '../hooks/useToday';
import { bodyNutritionReport } from '../lib/bodyNutritionReport';
import { addDays, daysBetween, firstOfMonth, parseLocalDate } from '../lib/dates';
import { deficitStart } from '../lib/deficit';
import { useStore } from '../lib/store';
import { CLAUDE_URL, copyText, downloadText } from '../lib/textExport';
import Sheet from './Sheet';
import { Icon } from './ui';

const shortDay = (day: string) => firstOfMonth(parseLocalDate(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

/** Carte de l'onglet Corps : pesées, repas et déficit jour par jour, en tableau à donner à une IA. */
export default function BodyNutritionCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card report-cta">
      <div style={{ minWidth: 0 }}>
        <h2>Pesées et nutrition pour une IA</h2>
        <p className="small secondary" style={{ margin: '4px 0 0' }}>
          Tes pesées, tes repas et ton déficit jour par jour dans un tableau, avec ta taille, ton poids, ton âge et ton métabolisme de base en tête : à coller dans Claude pour vérifier que tu es
          bien en déficit tout le long.
        </p>
      </div>
      <button className="btn primary" onClick={() => setOpen(true)}>
        <Icon name="clipboard" size={18} /> Préparer le tableau
      </button>
      {open && <BodyNutritionSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

function BodyNutritionSheet({ onClose }: { onClose: () => void }) {
  const { profile, body, food, workouts, cardio, kcalAdjust } = useStore();
  const today = useToday();
  const first = [...body.map((e) => e.date), ...food.map((f) => f.date)].sort()[0];
  const firstWeighIn = body.map((e) => e.date).sort()[0];
  // Repères pour le départ : compteur « Calories à perdre » (date choisie), plan, première pesée.
  const anchors = [
    { day: deficitStart(profile), label: 'Départ du compteur' },
    { day: profile.plan?.start, label: 'Départ du plan' },
    { day: firstWeighIn, label: 'Première pesée' },
  ].filter((a, i, all): a is { day: string; label: string } => !!a.day && a.day <= today && all.findIndex((b) => b.day === a.day) === i);
  const [since, setSince] = useState(() => anchors[0]?.day ?? first ?? addDays(today, -27));
  const sinceOk = /^\d{4}-\d{2}-\d{2}$/.test(since) && since <= today;
  const from = sinceOk ? since : today;
  const text = useMemo(() => bodyNutritionReport({ profile, body, food, workouts, cardio, kcalAdjust }, from, today), [profile, body, food, workouts, cardio, kcalAdjust, from, today]);
  const inPeriod = (d: string) => d >= from && d <= today;
  const weighIns = body.filter((e) => inPeriod(e.date)).length;
  const foodDays = new Set(food.filter((f) => inPeriod(f.date)).map((f) => f.date)).size;

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const [msg, setMsg] = useState('');
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 4000);
  };
  const pick = (day: string) => {
    setSince(day);
    setMsg('');
  };
  const copy = async () => flash((await copyText(text)) ? 'Tableau copié ✓ Colle-le dans une nouvelle conversation Claude.' : 'Copie impossible : sélectionne le texte ci-dessous et copie-le.');
  const share = async () => {
    try {
      await navigator.share({ title: `Pesées et nutrition – du ${shortDay(from)} au ${shortDay(today)}`, text });
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') flash('Partage impossible : utilise « Copier ».');
    }
  };

  return (
    <Sheet title="Pesées et nutrition" kicker="Pour une IA" onClose={onClose}>
      <div className="report-since">
        <label className="field">
          Du
          <input type="date" value={since} min={first} max={today} onChange={(e) => pick(e.target.value)} />
        </label>
        <span className="small secondary">à aujourd’hui{sinceOk ? ` · ${plural(daysBetween(since, today) + 1, 'jour')}` : ''}</span>
        {anchors.length > 0 && (
          <div className="chips">
            {anchors.map((a) => (
              <button key={a.label} type="button" className={`chip ${since === a.day ? 'on' : ''}`} aria-pressed={since === a.day} onClick={() => pick(a.day)}>
                {a.label} ({shortDay(a.day)})
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="small secondary" style={{ margin: '0 0 10px' }}>
        Contenu : ton profil (taille, poids, âge, métabolisme de base), puis un tableau jour par jour avec {plural(weighIns, 'pesée')} et {plural(foodDays, 'jour')} de repas notés, le déficit de
        chaque jour, un résumé par semaine et la demande d’analyse.
      </p>

      <div className="report-actions">
        <button className="btn primary" onClick={copy}>
          <Icon name="copy" size={18} /> Copier le tableau
        </button>
        {canShare && (
          <button className="btn" onClick={share}>
            <Icon name="share" size={18} /> Partager
          </button>
        )}
        <a className="btn" href={CLAUDE_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={18} /> Ouvrir Claude
        </a>
        <button className="btn ghost" onClick={() => downloadText(text, `pesees-nutrition-${from}-au-${today}.md`)}>
          <Icon name="download" size={18} /> Télécharger
        </button>
      </div>
      {msg && (
        <p className="small" role="status" style={{ margin: '8px 0 0' }}>
          {msg}
        </p>
      )}

      <ol className="small secondary report-steps">
        <li>{canShare ? 'Copie le tableau, ou « Partager » puis choisis l’app Claude.' : 'Copie le tableau.'}</li>
        <li>Colle-le dans une nouvelle conversation Claude : la demande est déjà dedans (déficit tout le long, poids qui suit ou pas, et pourquoi).</li>
      </ol>

      <details>
        <summary className="small">Voir le texte</summary>
        <pre className="report-preview" tabIndex={0}>
          {text}
        </pre>
      </details>

      <p className="small muted" style={{ marginBottom: 0 }}>
        Le tableau contient tes données de santé (poids, repas), mais pas ton prénom. Rien n’est envoyé automatiquement : c’est toi qui choisis où le coller.
      </p>
    </Sheet>
  );
}
