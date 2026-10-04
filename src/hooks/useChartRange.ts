import { useState } from 'react';
import { loadRange, saveRange, type ChartRange } from '../lib/timeAxis';

/** Période affichée d'un graphique, mémorisée sur cet appareil. */
export function useChartRange(key: string, fallback: ChartRange = '1y'): [ChartRange, (r: ChartRange) => void] {
  const [range, setRange] = useState<ChartRange>(() => loadRange(key, fallback));
  return [
    range,
    (r) => {
      setRange(r);
      saveRange(key, r);
    },
  ];
}
