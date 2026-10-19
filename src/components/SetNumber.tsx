import type { LoggedSet } from '../lib/types';

/** Numéro d'une série (parmi les séries de travail), « É » pour l'échauffement : le toucher bascule l'échauffement. */
export default function SetNumber({ set, index, onToggle }: { set: LoggedSet; index: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="set-num"
      onClick={onToggle}
      aria-pressed={!!set.warmup}
      aria-label={set.warmup ? 'Série d’échauffement : toucher pour en faire une série de travail' : `Série ${index} : toucher pour la marquer en échauffement`}
      title={set.warmup ? 'Échauffement' : 'Marquer en échauffement'}
    >
      <span>{set.warmup ? 'É' : index}</span>
    </button>
  );
}
