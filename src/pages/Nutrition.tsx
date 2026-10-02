import { addDays, daysBetween, localDate } from '../lib/dates';
import type { Tab } from '../App';
import { adaptiveAdjustment, ACTIVITY_LABELS, BMR_FORMULAS, computeBmr, currentComposition, GOAL_LABELS, nutritionTargets, weeklyRate } from '../lib/calc';
import { useStore } from '../lib/store';
import type { BmrMethod } from '../lib/types';
import { activityAverage } from '../lib/energy';
import { Empty, fmtDate, fmtNum, signed, Tile } from '../components/ui';

const ADVICE: Record<string, string[]> = {
  cut: [
    'Vise une perte de 0,5 à 1 % du poids par semaine : au-delà, la perte de muscle augmente (Helms et al., 2014).',
    'Garde des charges lourdes : c’est le signal qui préserve le muscle. Tu peux réduire le volume d’un tiers si la récupération baisse.',
    'Protéines hautes (2,2 g/kg) et aliments rassasiants : légumes, viandes maigres, œufs, skyr, pommes de terre.',
    'Une pause diète (1–2 semaines à maintenance) toutes les 8–12 semaines aide l’adhérence.',
  ],
  recomp: [
    'À maintenance, l’idéal pour les débutants ou ceux qui reprennent : tu peux perdre du gras et gagner du muscle en même temps.',
    'Juge la réussite au tour de taille (↓) et aux charges (↑), pas au poids qui peut stagner.',
    'Protéines ≈ 1,8 g/kg et sommeil de 7 à 9 h : ce sont les deux leviers majeurs.',
  ],
  bulk: [
    'Surplus modéré : +0,25 à 0,5 % du poids par semaine. Un surplus plus élevé ajoute surtout du gras (Iraki et al., 2019).',
    'Si ton tour de taille augmente de plus de 1 cm par mois, réduis les calories de 100–150 kcal.',
    'Glucides autour des séances pour la performance.',
  ],
  strength: [
    'Léger surplus ou maintenance : la force progresse mieux sans déficit.',
    'Glucides suffisants (4–6 g/kg) pour soutenir les séances lourdes.',
  ],
};

export default function NutritionPage({ go }: { go: (t: Tab) => void }) {
  const { profile, setProfile, body, workouts, cardio, kcalAdjust, kcalAdjustedAt, setKcalAdjust } = useStore();
  const latest = body.at(-1);
  if (!latest) return <Empty>Ajoute une pesée dans l’onglet Corps pour calculer tes besoins.</Empty>;

  const comp = currentComposition(body, profile)!;
  const act = activityAverage({ workouts, cardio, profile }, comp.weightKg);
  const t = nutritionTargets(profile, { ...latest, weightKg: comp.weightKg }, comp.bodyFatPct, kcalAdjust, act.perDay);
  const rate = weeklyRate(body);
  // Après un changement, on attend 14 jours et on n'évalue que les pesées postérieures,
  // sinon l'ancienne tendance est comptée deux fois et les suggestions oscillent.
  const daysSince = kcalAdjustedAt ? daysBetween(kcalAdjustedAt, localDate()) : Infinity;
  const locked = daysSince < 14;
  const evalRate = locked ? undefined : weeklyRate(body, Math.min(28, daysSince));
  const proposal = adaptiveAdjustment(evalRate, t.targetRateKg);
  const nextEval = kcalAdjustedAt ? addDays(kcalAdjustedAt, 14) : undefined;
  const perMeal = Math.round(latest.weightKg * 0.4);
  const fiber = Math.round((t.calories / 1000) * 14);
  const water = fmtNum((latest.weightKg * 35) / 1000 + 0.5);

  return (
    <div>
      <h1>Nutrition</h1>
      <div className="tiles">
        <Tile label="Calories / jour" value={fmtNum(t.calories, 0)} sub={kcalAdjust ? `dont ajustement ${signed(kcalAdjust, 0)} kcal` : `maintenance ≈ ${fmtNum(t.tdee, 0)}`} />
        <Tile label="Protéines" value={`${t.proteinG} g`} sub={`${fmtNum(t.proteinG / latest.weightKg)} g/kg`} />
        <Tile label="Lipides" value={`${t.fatG} g`} sub={`${Math.round(((t.fatG * 9) / t.calories) * 100)} % des calories`} />
        <Tile label="Glucides" value={`${t.carbsG} g`} sub="le reste des calories" />
      </div>

      <div className="card">
        <h2>Ajustement adaptatif</h2>
        <p className="small secondary">
          Les formules donnent un point de départ ; ta balance donne la vérité. Comme MacroFactor ou la méthode de Lyle McDonald, on compare ta tendance réelle (régression sur 2 à 4
          semaines) à l’objectif, puis on corrige la moitié de l’écart, au plus toutes les 2 semaines.
        </p>
        <div className="tiles" style={{ marginBottom: 8 }}>
          <Tile label="Objectif / semaine" value={`${signed(t.targetRateKg, 2)} kg`} sub={GOAL_LABELS[profile.goal]} />
          <Tile label="Tendance / semaine" value={rate !== undefined ? `${signed(rate, 2)} kg` : '—'} sub={rate === undefined ? 'min. 3 pesées sur 1 semaine' : '3 dernières semaines'} />
        </div>
        {locked ? (
          <div className="callout">
            Ajustement modifié le {fmtDate(kcalAdjustedAt!, { day: 'numeric', month: 'long' })}. Laisse 2 semaines à la balance pour refléter le changement : prochaine
            évaluation le <b>{fmtDate(nextEval!, { day: 'numeric', month: 'long' })}</b>.
          </div>
        ) : evalRate === undefined ? (
          <div className="callout">Continue à te peser régulièrement : une suggestion apparaîtra dès qu’il y aura assez de données.</div>
        ) : proposal === 0 ? (
          <div className="callout">Tu es dans la cible 👌 Ne change rien.</div>
        ) : (
          <div className="callout">
            Ta tendance s’écarte de l’objectif. Suggestion : <b>{signed(proposal, 0)} kcal/jour</b>.
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary sm" onClick={() => setKcalAdjust(kcalAdjust + proposal)}>
                Appliquer
              </button>
            </div>
          </div>
        )}
        <div className="row">
          <span className="small secondary">Ajustement manuel :</span>
          <button className="btn sm" onClick={() => setKcalAdjust(kcalAdjust - 50)}>
            −50
          </button>
          <b>{signed(kcalAdjust, 0)} kcal</b>
          <button className="btn sm" onClick={() => setKcalAdjust(kcalAdjust + 50)}>
            +50
          </button>
          {kcalAdjust !== 0 && (
            <button className="btn sm ghost" onClick={() => setKcalAdjust(0)}>
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Comment c’est calculé</h2>
          <label className="field" style={{ marginBottom: 10 }}>
            Formule du métabolisme de base
            <select value={profile.bmrMethod ?? 'auto'} onChange={(e) => setProfile({ bmrMethod: e.target.value as BmrMethod })}>
              <option value="auto">Automatique (recommandé) – {BMR_FORMULAS[computeBmr({ ...profile, bmrMethod: 'auto' }, comp.weightKg, comp.bodyFatPct).method].label}</option>
              {(Object.keys(BMR_FORMULAS) as Exclude<BmrMethod, 'auto'>[]).map((k) => {
                const f = BMR_FORMULAS[k];
                const unavailable = f.needsLean && comp.bodyFatPct === undefined;
                return (
                  <option key={k} value={k} disabled={unavailable}>
                    {f.label} – {unavailable ? '% de gras requis' : `${fmtNum(computeBmr({ ...profile, bmrMethod: k }, comp.weightKg, comp.bodyFatPct).bmr, 0)} kcal`}
                  </option>
                );
              })}
            </select>
          </label>
          <p className="small secondary" style={{ marginTop: 0 }}>
            {BMR_FORMULAS[t.methodId].description}{' '}
            <a href={BMR_FORMULAS[t.methodId].source.url} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </p>
          <table>
            <tbody>
              <tr>
                <td>Métabolisme de base ({t.method})</td>
                <td className="num">{fmtNum(t.bmr, 0)} kcal</td>
              </tr>
              <tr>
                <td>× quotidien ({ACTIVITY_LABELS[profile.activity].split(' (')[0].toLowerCase()})</td>
                <td className="num">{fmtNum(t.tdee - act.perDay, 0)} kcal</td>
              </tr>
              <tr>
                <td>
                  + musculation, moyenne / jour
                  <div className="small muted">
                    {act.source === 'plan' ? `d’après ton plan (${profile.daysPerWeek} × ${profile.sessionMinutes} min / sem.)` : `tes séances des ${act.days} derniers jours`}
                  </div>
                </td>
                <td className="num">+{fmtNum(act.training, 0)} kcal</td>
              </tr>
              <tr>
                <td>
                  + marche, moyenne / jour
                  <div className="small muted">
                    {act.walking ? `tes marches des ${act.days} dernier${act.days > 1 ? 's' : ''} jour${act.days > 1 ? 's' : ''}` : 'aucune marche enregistrée sur la période'}
                  </div>
                </td>
                <td className="num">+{fmtNum(act.perDay - act.training, 0)} kcal</td>
              </tr>
              <tr>
                <td>= Maintenance</td>
                <td className="num">{fmtNum(t.tdee, 0)} kcal</td>
              </tr>
              <tr>
                <td>Objectif {GOAL_LABELS[profile.goal].toLowerCase()}</td>
                <td className="num">{signed(t.calories - t.tdee - kcalAdjust, 0)} kcal</td>
              </tr>
              {kcalAdjust !== 0 && (
                <tr>
                  <td>Ajustement</td>
                  <td className="num">{signed(kcalAdjust, 0)} kcal</td>
                </tr>
              )}
              <tr>
                <td>
                  <b>Cible</b>
                </td>
                <td className="num">
                  <b>{fmtNum(t.calories, 0)} kcal</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 8 }}>
            {comp.bodyFatPct !== undefined ? (
              'Ton % de gras est connu : les formules basées sur la masse maigre (Katch-McArdle, Cunningham, Tinsley) sont disponibles.'
            ) : (
              <>
                Ajoute ton % de masse grasse (onglet <a href="#body" onClick={() => go('body')}>Corps</a>) pour débloquer les formules basées sur la masse maigre.
              </>
            )}
          </p>
        </div>
        <div className="card">
          <h2>Repères du quotidien</h2>
          <ul className="small secondary" style={{ paddingLeft: 18, margin: 0 }}>
            <li>
              Protéines : ~<b>{perMeal} g par repas</b> sur 3 à 5 repas (0,4 g/kg, Schoenfeld & Aragon 2018).
            </li>
            <li>
              Fibres : ~<b>{fiber} g / jour</b> (14 g / 1000 kcal).
            </li>
            <li>
              Eau : ~<b>{water} L / jour</b>, plus selon la transpiration.
            </li>
            <li>Créatine monohydrate : 3–5 g / jour, le supplément le mieux étudié pour la force et le muscle.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Conseils – {GOAL_LABELS[profile.goal]}</h2>
        <ul className="small secondary" style={{ paddingLeft: 18, margin: 0 }}>
          {ADVICE[profile.goal].map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
