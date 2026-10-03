import { useState } from 'react';
import type { Profile } from '../lib/types';
import Sheet from './Sheet';
import { fmtNum, Icon } from './ui';

/** Au-delà de ce % de gras, le FFMI est gonflé (eau, tissus de soutien, biais de la bio-impédance). */
export const ffmiReliable = (bodyFatPct: number | undefined, sex: Profile['sex']) => bodyFatPct === undefined || bodyFatPct <= (sex === 'female' ? 32 : 25);

/** Repères du FFMI normalisé (hommes ; les repères féminins sont environ 3 points plus bas). */
const RANGES: [number, string][] = [
  [18, 'Sous la moyenne'],
  [20, 'Moyenne'],
  [22, 'Bien entraîné'],
  [24, 'Très musclé'],
  [Infinity, 'Exceptionnel'],
];

export function ffmiLabel(ffmi: number | undefined, sex: Profile['sex'], bodyFatPct?: number): string {
  if (ffmi === undefined) return 'Nécessite le % de gras';
  if (!ffmiReliable(bodyFatPct, sex)) return `Peu fiable à ${fmtNum(bodyFatPct, 0)} % de gras`;
  const v = sex === 'female' ? ffmi + 3 : ffmi;
  const label = RANGES.find(([max]) => v < max)![1];
  return label === 'Exceptionnel' && sex === 'male' ? 'Exceptionnel (limite naturelle ≈ 25)' : label;
}

/** Bouton « i » qui explique le FFMI, ses variantes et ses limites, avec les valeurs de l'utilisateur. */
export function FfmiInfoButton({ profile, leanKg, ffmi, bodyFatPct }: { profile: Profile; leanKg?: number; ffmi?: number; bodyFatPct?: number }) {
  const [open, setOpen] = useState(false);
  const h = profile.heightCm / 100;
  const raw = leanKg !== undefined ? leanKg / (h * h) : undefined;
  const female = profile.sex === 'female';
  const reliable = ffmiReliable(bodyFatPct, profile.sex);
  return (
    <>
      <button type="button" className="info-btn" aria-label="Qu’est-ce que le FFMI ?" onClick={() => setOpen(true)}>
        <Icon name="info" size={15} />
      </button>
      {open && (
        <Sheet title="FFMI" kicker="Indice de masse non grasse" onClose={() => setOpen(false)}>
          <p className="secondary" style={{ marginTop: 0 }}>
            Le <b>FFMI</b> (<i>Fat-Free Mass Index</i>) est l’équivalent de l’IMC calculé avec la <b>masse maigre</b> au lieu du poids total : il indique à quel point tu es
            musclé pour ta taille, sans compter le gras.
          </p>

          <h3>Les deux variantes</h3>
          <dl className="kv">
            <div>
              <dt>FFMI brut</dt>
              <dd>{raw !== undefined ? fmtNum(raw) : '—'}</dd>
              <span className="small muted">masse maigre ÷ taille²</span>
            </div>
            <div>
              <dt>FFMI normalisé</dt>
              <dd>{ffmi !== undefined ? fmtNum(ffmi) : '—'}</dd>
              <span className="small muted">+ 6,1 × (1,80 − taille) : celui affiché</span>
            </div>
          </dl>
          <p className="small secondary">
            Le FFMI brut avantage les grands et pénalise les petits. La version <b>normalisée</b> (Kouri et al., 1995) ramène tout le monde à 1,80 m pour comparer : c’est celle
            de l’appli.
          </p>

          <h3>Repères (FFMI normalisé)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Niveau</th>
                  <th className="num">Hommes</th>
                  <th className="num">Femmes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Sous la moyenne', '< 18', '< 15'],
                  ['Moyenne', '18 – 20', '15 – 17'],
                  ['Bien entraîné', '20 – 22', '17 – 19'],
                  ['Très musclé', '22 – 24', '19 – 21'],
                  ['Exceptionnel', '24 – 25 +', '21 – 22 +'],
                ].map(([l, m, f]) => (
                  <tr key={l}>
                    <td>{l}</td>
                    <td className="num">{m}</td>
                    <td className="num">{f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small secondary">
            Chez des culturistes secs (≈ 10–15 % de gras), Kouri et al. n’ont presque pas trouvé de valeur au-dessus de <b>25</b> sans stéroïdes : c’est l’origine de la « limite
            naturelle ».
          </p>

          <h3>Quand il n’est pas fiable</h3>
          <ul className="small secondary" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Ces repères viennent de personnes plutôt sèches. Au-delà d’environ {female ? '32' : '25'} % de gras, le FFMI est <b>gonflé</b> :</li>
            <li>avec du surpoids, environ un quart des kilos en trop sont de la « masse maigre » qui n’est pas du muscle (eau, peau, tissus de soutien, organes) ;</li>
            <li>la balance à impédance surestime souvent la masse maigre quand le taux de gras est élevé ;</li>
            <li>il dépend du % de gras mesuré : ±3 à 5 % d’erreur sur le gras décale le FFMI de près d’un point.</li>
          </ul>

          {bodyFatPct !== undefined && (
            <div className="callout" style={{ marginTop: 12 }}>
              {reliable ? (
                <>
                  À {fmtNum(bodyFatPct, 0)} % de gras, ton FFMI de <b>{fmtNum(ffmi)}</b> est interprétable avec les repères ci-dessus.
                </>
              ) : (
                <>
                  À <b>{fmtNum(bodyFatPct, 0)} % de gras</b>, ton FFMI de {fmtNum(ffmi)} surestime ta musculature : compare-le surtout à lui-même dans le temps. Pour suivre ton muscle, la
                  <b> masse musculaire de la balance</b> et son évolution sont plus parlantes ; le FFMI deviendra lisible en dessous de {female ? '32' : '25'} % de gras.
                </>
              )}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
