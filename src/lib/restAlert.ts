/**
 * Alerte de fin de repos : son (iPhone ne sait pas vibrer depuis le web), vibration (Android)
 * et notification système quand l'appli est en arrière-plan.
 *
 * Limite : sur iPhone/iPad, iOS gèle le JavaScript d'une appli web en arrière-plan ;
 * une notification à heure fixe y demanderait un serveur de push (Web Push).
 */

const PREFS_KEY = 'new-shape-rest-alert';
const END_KEY = 'new-shape-rest-end';

export interface RestAlertPrefs {
  sound: boolean;
  notify: boolean;
}

export function loadPrefs(): RestAlertPrefs {
  try {
    return { sound: true, notify: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { sound: true, notify: false };
  }
}

export function savePrefs(p: RestAlertPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible */
  }
}

/** Fin du repos en cours (timestamp ms), conservée si l'appli est rechargée ou quittée. */
export function loadRestEnd(): number | undefined {
  try {
    const n = Number(localStorage.getItem(END_KEY));
    return n > Date.now() - 60_000 ? n : undefined;
  } catch {
    return undefined;
  }
}

export function saveRestEnd(end: number | undefined) {
  try {
    if (end) localStorage.setItem(END_KEY, String(end));
    else localStorage.removeItem(END_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export async function requestNotify(): Promise<boolean> {
  if (!notifySupported()) return false;
  // Un refus déjà donné est renvoyé tout de suite par le navigateur, sans redemander.
  return (await Notification.requestPermission()) === 'granted';
}

let ctx: AudioContext | undefined;

/** À appeler dans un geste utilisateur (validation d'une série) : iOS n'autorise le son qu'après une interaction. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* audio indisponible */
  }
}

/** Trois bips courts, assez aigus pour s'entendre dans une salle. */
export function beep() {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = i === 2 ? 1320 : 880;
    const t = t0 + i * 0.28;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.22);
  }
}

/** Déclenche l'alerte de fin de repos selon les préférences. */
export async function restDone(prefs: RestAlertPrefs, next?: string) {
  navigator.vibrate?.([200, 100, 200]);
  if (prefs.sound) beep();
  // Sans autorisation, showNotification échoue : l'erreur est ignorée.
  if (prefs.notify && document.visibilityState === 'hidden' && notifySupported()) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Repos terminé 💪', {
        body: next ? `Prochaine série : ${next}` : 'À toi de jouer !',
        tag: 'rest',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        requireInteraction: false,
      } as NotificationOptions);
    } catch {
      /* notification refusée ou service worker absent */
    }
  }
}
