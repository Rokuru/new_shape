import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui';

/** Fenêtres ouvertes, de la plus ancienne à la plus récente : Échap ne ferme que celle du dessus. */
const openSheets: symbol[] = [];

/**
 * Panneau modal (bas d'écran sur iPhone, centré sur iPad/ordinateur) : Échap, clic dehors et focus gérés.
 * `alert` : demande de confirmation (rôle alertdialog), au-dessus d'une éventuelle autre fenêtre.
 */
export default function Sheet({ title, kicker, onClose, children, alert }: { title: ReactNode; kicker?: ReactNode; onClose: () => void; children: ReactNode; alert?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const me = Symbol('sheet');
    openSheets.push(me);
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets.at(-1) === me) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      openSheets.splice(openSheets.indexOf(me), 1);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, []);

  // Rendu au niveau du document : la fiche n'hérite pas des styles de l'endroit qui l'ouvre (libellé de tuile, tableau…).
  return createPortal(
    <div className={`sheet-backdrop ${alert ? 'alert' : ''}`} onClick={onClose}>
      <div className={`sheet ${alert ? 'alert' : ''}`} role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            {kicker && <div className="sheet-kicker">{kicker}</div>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button ref={closeRef} className="btn ghost sm" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
