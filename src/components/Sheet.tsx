import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './ui';

/** Panneau modal (bas d'écran sur iPhone, centré sur iPad/ordinateur) : Échap, clic dehors et focus gérés. */
export default function Sheet({ title, kicker, onClose, children }: { title: ReactNode; kicker?: ReactNode; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            {kicker && <div className="sheet-kicker">{kicker}</div>}
            <h2 id="sheet-title">{title}</h2>
          </div>
          <button ref={closeRef} className="btn ghost sm" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
