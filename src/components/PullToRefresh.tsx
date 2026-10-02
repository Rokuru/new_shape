import { useEffect, useRef, useState } from 'react';
import { refreshApp } from '../lib/refresh';
import { Icon } from './ui';

const THRESHOLD = 70; // px à tirer pour déclencher
const MAX = 110;

/**
 * Tirer vers le bas en haut de page pour actualiser (écrans tactiles : iPhone, iPad…).
 * La page reste affichée pendant le chargement en arrière-plan ; seul un petit indicateur apparaît.
 */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const pullRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && !busyRef.current && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : undefined;
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = e.touches[0].clientX - start.current.x;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        if (pullRef.current) set(0);
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) start.current = undefined;
        return;
      }
      e.preventDefault(); // empêche le rebond natif pendant le geste
      set(Math.min(MAX, dy * 0.5));
    };
    const onEnd = async () => {
      if (!start.current) return;
      start.current = undefined;
      const go = pullRef.current >= THRESHOLD;
      set(0);
      if (!go) return;
      busyRef.current = true;
      setBusy(true);
      navigator.vibrate?.(10);
      const t0 = Date.now();
      const result = await refreshApp();
      if (result === 'updated') return; // la page se recharge
      // Durée minimale pour que l'indicateur ne « clignote » pas.
      await new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - t0))));
      setBusy(false);
      busyRef.current = false;
      setDone(true);
      setTimeout(() => setDone(false), 900);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const visible = pull > 0 || busy || done;
  const offset = busy || done ? THRESHOLD * 0.75 : pull * 0.75;
  return (
    <div
      className={`ptr ${busy ? 'busy' : ''} ${done ? 'done' : ''} ${pull >= THRESHOLD ? 'ready' : ''}`}
      style={{ transform: `translate(-50%, ${offset - 48}px)`, opacity: visible ? Math.min(1, (busy || done ? 1 : pull / THRESHOLD)) : 0, transition: pull > 0 ? 'none' : undefined }}
      role="status"
      aria-live="polite"
      aria-label={busy ? 'Actualisation…' : done ? 'À jour' : undefined}
    >
      {done ? <Icon name="check" size={20} /> : <span style={{ display: 'grid', transform: busy ? undefined : `rotate(${pull * 3}deg)` }}><Icon name="refresh" size={20} /></span>}
    </div>
  );
}
