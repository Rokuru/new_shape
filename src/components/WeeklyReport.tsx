import { useMemo, useState } from 'react';
import { useToday } from '../hooks/useToday';
import { addDays, dayKey, daysBetween, firstOfMonth, parseLocalDate } from '../lib/dates';
import { deficitStart } from '../lib/deficit';
import { allPrograms, useStore } from '../lib/store';
import { CLAUDE_URL, copyText, downloadText } from '../lib/textExport';
import { defaultReportWeek, firstDataDay, periodReport, weekStartOf, weeklyReport } from '../lib/weeklyReport';
import Sheet from './Sheet';
import { Icon, Segmented } from './ui';

const shortDay = (day: string) => firstOfMonth(parseLocalDate(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
const longDay = (day: string) => firstOfMonth(parseLocalDate(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

/** Bilan d'une semaine, depuis une date choisie, ou depuis la première donnée. */
type Mode = 'week' | 'since' | 'all';
const MODES: { value: Mode; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'since', label: 'Depuis le…' },
  { value: 'all', label: 'Depuis le début' },
];
// Dernier choix gardé sur l'appareil (confort) ; stockage indisponible : bilan de la semaine.
const MODE_KEY = 'ns-report-mode';
function loadMode(): Mode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'since' || v === 'all' ? v : 'week';
  } catch {
    return 'week';
  }
}
function saveMode(m: Mode) {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* stockage indisponible : choix non mémorisé */
  }
}

/** Carte de l'accueil : ouvre le bilan pour Claude (semaine, depuis une date ou depuis le début). */
export function WeeklyReportCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card report-cta">
      <div style={{ minWidth: 0 }}>
        <h2>Bilan pour Claude</h2>
        <p className="small secondary" style={{ margin: '4px 0 0' }}>
          Séances, repas, poids et marche sur une semaine, depuis une date ou depuis le début, en un texte à donner à Claude pour une analyse de coach.
        </p>
      </div>
      <button className="btn primary" onClick={() => setOpen(true)}>
        <Icon name="clipboard" size={18} /> Préparer mon bilan
      </button>
      {open && <WeeklyReportSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function WeeklyReportSheet({ onClose }: { onClose: () => void }) {
  const { profile, body, workouts, cardio, food, checkins, customPrograms, activeProgramId, kcalAdjust } = useStore();
  const today = useToday();
  const hasData = (from: string) => {
    const to = addDays(from, 6);
    const inside = (d: string) => d >= from && d <= to;
    return workouts.some((w) => w.finished && inside(dayKey(w.date))) || body.some((e) => inside(e.date)) || food.some((f) => inside(f.date)) || cardio.some((c) => inside(c.date));
  };
  // Semaine en cours encore vide (lundi matin…) : on propose la précédente.
  const [start, setStart] = useState(() => {
    const week = defaultReportWeek(today);
    return hasData(week) || !hasData(addDays(week, -7)) ? week : addDays(week, -7);
  });
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const [msg, setMsg] = useState('');
  const [mode, setModeState] = useState<Mode>(loadMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    saveMode(m);
    setMsg('');
  };
  const first = firstDataDay({ body, workouts, cardio, food });
  // Repères proposés pour « Depuis le… » : départ du compteur de calories (date choisie), départ du plan.
  const anchors = [
    { day: deficitStart(profile), label: 'Départ du compteur' },
    { day: profile.plan?.start, label: 'Départ du plan' },
  ].filter((a, i, all): a is { day: string; label: string } => !!a.day && a.day <= today && all.findIndex((b) => b.day === a.day) === i);
  const [since, setSince] = useState(() => anchors[0]?.day ?? first ?? addDays(today, -27));
  const sinceOk = /^\d{4}-\d{2}-\d{2}$/.test(since) && since <= today;
  const program = allPrograms(customPrograms).find((p) => p.id === activeProgramId);

  const current = weekStartOf(today);
  const from = mode === 'week' ? start : mode === 'since' ? (sinceOk ? since : today) : (first ?? today);
  const end = mode === 'week' ? addDays(start, 6) : today;
  const text = useMemo(() => {
    const data = { profile, body, workouts, cardio, food, checkins, program, kcalAdjust };
    return mode === 'week' ? weeklyReport(data, start, today) : periodReport(data, from, today, today);
  }, [profile, body, workouts, cardio, food, checkins, program, kcalAdjust, mode, start, from, today]);

  const canPrev = first !== undefined && start > weekStartOf(first);
  const inWeek = (d: string) => d >= from && d <= end;
  const counts = {
    sessions: workouts.filter((w) => w.finished && inWeek(dayKey(w.date))).length,
    meals: new Set(food.filter((f) => inWeek(f.date)).map((f) => f.date)).size,
    weighIns: body.filter((e) => inWeek(e.date)).length,
    walks: cardio.filter((c) => inWeek(c.date)).length,
  };
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 4000);
  };
  const go = (weeks: number) => {
    setStart((s) => addDays(s, weeks * 7));
    setMsg('');
  };

  const copy = async () => flash((await copyText(text)) ? 'Bilan copié ✓ Colle-le dans une nouvelle conversation Claude.' : 'Copie impossible : sélectionne le texte ci-dessous et copie-le.');
  const share = async () => {
    try {
      await navigator.share({ title: mode === 'week' ? `Bilan New Shape – semaine du ${shortDay(start)}` : `Bilan New Shape – du ${shortDay(from)} au ${shortDay(end)}`, text });
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') flash('Partage impossible : utilise « Copier ».');
    }
  };
  const download = () => downloadText(text, mode === 'week' ? `bilan-semaine-${start}.md` : `bilan-${from}-au-${end}.md`);

  return (
    <Sheet title="Mon bilan" kicker="Pour Claude" onClose={onClose}>
      <div className="report-mode">
        <Segmented value={mode} options={MODES} onChange={setMode} />
      </div>

      {mode === 'week' && (
        <div className="week-nav">
          <button className="btn ghost sm" aria-label="Semaine précédente" disabled={!canPrev} onClick={() => go(-1)}>
            <span className="flip">
              <Icon name="chevron" size={18} />
            </span>
          </button>
          <div className="week-label">
            <b>
              Du {shortDay(start)} au {shortDay(end)}
            </b>
            <span className="small muted">{start === current ? 'semaine en cours' : start === addDays(current, -7) ? 'semaine dernière' : `${parseLocalDate(start).getFullYear()}`}</span>
          </div>
          <button className="btn ghost sm" aria-label="Semaine suivante" disabled={start >= current} onClick={() => go(1)}>
            <Icon name="chevron" size={18} />
          </button>
        </div>
      )}

      {mode === 'since' && (
        <div className="report-since">
          <label className="field">
            Du
            <input
              type="date"
              value={since}
              min={first}
              max={today}
              onChange={(e) => {
                setSince(e.target.value);
                setMsg('');
              }}
            />
          </label>
          <span className="small secondary">à aujourd’hui{sinceOk ? ` · ${daysBetween(since, today) + 1} jours` : ''}</span>
          {anchors.length > 0 && (
            <div className="chips">
              {anchors.map((a) => (
                <button key={a.label} type="button" className={`chip ${since === a.day ? 'on' : ''}`} aria-pressed={since === a.day} onClick={() => setSince(a.day)}>
                  {a.label} ({shortDay(a.day)})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'all' && (
        <p className="small secondary" style={{ margin: '0 0 10px' }}>
          {first ? (
            <>
              Depuis ta première donnée, le <b>{longDay(first)}</b>, jusqu’à aujourd’hui : {daysBetween(first, today) + 1} jours.
            </>
          ) : (
            'Aucune donnée pour l’instant.'
          )}
        </p>
      )}

      <p className="small secondary" style={{ margin: '0 0 10px' }}>
        Contenu : {counts.sessions} séance{counts.sessions > 1 ? 's' : ''} · {counts.meals} jour{counts.meals > 1 ? 's' : ''} de repas notés · {counts.weighIns} pesée
        {counts.weighIns > 1 ? 's' : ''} · {counts.walks} marche{counts.walks > 1 ? 's' : ''}, avec ton profil, tes objectifs et{' '}
        {mode === 'week' ? 'la semaine précédente pour comparer.' : 'un résumé semaine par semaine.'}
      </p>

      <div className="report-actions">
        <button className="btn primary" onClick={copy}>
          <Icon name="copy" size={18} /> Copier pour Claude
        </button>
        {canShare && (
          <button className="btn" onClick={share}>
            <Icon name="share" size={18} /> Partager
          </button>
        )}
        <a className="btn" href={CLAUDE_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={18} /> Ouvrir Claude
        </a>
        <button className="btn ghost" onClick={download}>
          <Icon name="download" size={18} /> Télécharger
        </button>
      </div>
      {text.length > 20000 && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Texte long (≈ {Math.round(text.length / 1000)} 000 caractères) : en le collant, Claude le reçoit comme une pièce jointe, c’est normal.
        </p>
      )}
      {msg && (
        <p className="small" role="status" style={{ margin: '8px 0 0' }}>
          {msg}
        </p>
      )}

      <ol className="small secondary report-steps">
        <li>{canShare ? 'Copie le bilan, ou « Partager » puis choisis l’app Claude.' : 'Copie le bilan.'}</li>
        <li>Ouvre une nouvelle conversation dans Claude et colle-le : la demande d’analyse est déjà dedans.</li>
        <li>Pose ensuite tes questions (sommeil, douleurs, envie de changer de programme…).</li>
      </ol>

      <details>
        <summary className="small">Voir le texte</summary>
        <pre className="report-preview" tabIndex={0}>
          {text}
        </pre>
      </details>

      <p className="small muted" style={{ marginBottom: 0 }}>
        Le bilan contient tes données de santé (poids, repas, séances), mais pas ton prénom. Rien n’est envoyé automatiquement : c’est toi qui choisis où le coller.
      </p>
    </Sheet>
  );
}
