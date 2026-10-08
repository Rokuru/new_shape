import { useMemo, useState } from 'react';
import { useToday } from '../hooks/useToday';
import { addDays, dayKey, parseLocalDate } from '../lib/dates';
import { allPrograms, useStore } from '../lib/store';
import { defaultReportWeek, weekStartOf, weeklyReport } from '../lib/weeklyReport';
import Sheet from './Sheet';
import { Icon } from './ui';

const CLAUDE_URL = 'https://claude.ai/new';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Repli (navigateurs anciens, contexte non sécurisé) : sélection d'une zone de texte temporaire.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const shortDay = (day: string) => parseLocalDate(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Carte de l'accueil : ouvre le bilan de la semaine. */
export function WeeklyReportCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card report-cta">
      <div style={{ minWidth: 0 }}>
        <h2>Bilan de la semaine</h2>
        <p className="small secondary" style={{ margin: '4px 0 0' }}>
          Séances, repas, poids et marche en un texte à donner à Claude pour une analyse de coach.
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
  const { profile, body, workouts, cardio, food, customPrograms, activeProgramId, kcalAdjust } = useStore();
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
  const program = allPrograms(customPrograms).find((p) => p.id === activeProgramId);
  const text = useMemo(
    () => weeklyReport({ profile, body, workouts, cardio, food, program, kcalAdjust }, start, today),
    [profile, body, workouts, cardio, food, program, kcalAdjust, start, today],
  );

  const end = addDays(start, 6);
  const current = weekStartOf(today);
  const first = [...body.map((e) => e.date), ...workouts.map((w) => dayKey(w.date)), ...cardio.map((c) => c.date), ...food.map((f) => f.date)].sort()[0];
  const canPrev = first !== undefined && start > weekStartOf(first);
  const inWeek = (d: string) => d >= start && d <= end;
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
      await navigator.share({ title: `Bilan New Shape – semaine du ${shortDay(start)}`, text });
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') flash('Partage impossible : utilise « Copier ».');
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilan-semaine-${start}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Sheet title="Bilan de la semaine" kicker="Pour Claude" onClose={onClose}>
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

      <p className="small secondary" style={{ margin: '0 0 10px' }}>
        Contenu : {counts.sessions} séance{counts.sessions > 1 ? 's' : ''} · {counts.meals} jour{counts.meals > 1 ? 's' : ''} de repas notés · {counts.weighIns} pesée
        {counts.weighIns > 1 ? 's' : ''} · {counts.walks} marche{counts.walks > 1 ? 's' : ''}, avec ton profil, tes objectifs et la semaine précédente pour comparer.
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
