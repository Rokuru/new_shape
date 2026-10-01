import { MUSCLE_LABELS, MUSCLES } from '../data/exercises';
import { VOLUME_LANDMARKS } from '../lib/calc';
import type { Muscle } from '../lib/types';
import { fmtNum } from './ui';

/**
 * Volume (séries / semaine) par muscle, comparé aux repères RP :
 * trait gris = MEV, bande bleue = zone MAV, échelle jusqu'au MRV.
 */
export default function VolumeBars({ volume, targets }: { volume: Record<Muscle, number>; targets?: Partial<Record<Muscle, number>> }) {
  return (
    <div>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--series-1)' }} />
          Séries effectives
        </span>
        <span>
          <i style={{ background: 'var(--band)', border: '1px dashed var(--accent)' }} />
          Zone optimale (MAV)
        </span>
        <span>
          <i style={{ background: 'var(--muted)', width: 2 }} />
          Minimum efficace (MEV)
        </span>
      </div>
      {MUSCLES.map((m) => {
        const lm = VOLUME_LANDMARKS[m];
        const max = lm.mrv + 4;
        const v = volume[m];
        const pct = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
        const status = v > lm.mrv ? 'bad' : v >= lm.mavLow ? 'ok' : v >= lm.mev ? 'warn' : 'bad';
        const statusLabel = v > lm.mrv ? 'Trop' : v >= lm.mavLow ? 'Optimal' : v >= lm.mev ? 'Correct' : 'Faible';
        return (
          <div className="vol-row" key={m} title={`${MUSCLE_LABELS[m]} : ${fmtNum(v)} séries (MEV ${lm.mev}, MAV ${lm.mavLow}–${lm.mavHigh}, MRV ${lm.mrv})`}>
            <span>{MUSCLE_LABELS[m]}</span>
            <div className="vol-track">
              <div className="vol-band" style={{ left: pct(lm.mavLow), width: `calc(${pct(lm.mavHigh)} - ${pct(lm.mavLow)})` }} />
              <div className="vol-bar" style={{ width: pct(v) }} />
              {lm.mev > 0 && <div className="vol-mev" style={{ left: pct(lm.mev) }} />}
            </div>
            <span className={`status ${status}`} style={{ justifyContent: 'flex-end' }}>
              {fmtNum(v)}
              {targets?.[m] !== undefined ? <span className="muted">/{targets[m]}</span> : <span className="small">{statusLabel === 'Optimal' ? ' ✓' : ''}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
