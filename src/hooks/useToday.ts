import { useEffect, useState } from 'react';
import { localDate } from '../lib/dates';

/**
 * Jour local courant, mis à jour à minuit et au retour sur l'app
 * (une PWA peut rester ouverte en arrière-plan d'un jour à l'autre).
 */
export function useToday(): string {
  const [day, setDay] = useState(localDate);
  useEffect(() => {
    const refresh = () => setDay(localDate());
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [day]);
  return day;
}
