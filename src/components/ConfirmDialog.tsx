import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import Sheet from './Sheet';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** Bouton de confirmation : « Supprimer » par défaut. */
  confirmLabel?: string;
  /** Action non destructrice : bouton bleu au lieu de rouge. */
  safe?: boolean;
  /** Second choix (ex. se déconnecter sans effacer les données) : la réponse vaut alors 'alt'. */
  altLabel?: string;
}
export type ConfirmAnswer = boolean | 'alt';
type Ask = (o: ConfirmOptions) => Promise<ConfirmAnswer>;

/** Sans fournisseur (ne devrait pas arriver) : la confirmation du navigateur, plutôt que de bloquer l'action. */
const nativeConfirm: Ask = async (o) => window.confirm(typeof o.message === 'string' ? `${o.title}\n\n${o.message}` : o.title);
const ConfirmContext = createContext<Ask>(nativeConfirm);

/** Pop-up de confirmation de l'appli, pour toutes les suppressions (et quelques actions sensibles). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ o: ConfirmOptions; resolve: (a: ConfirmAnswer) => void }>();
  const ask = useCallback<Ask>((o) => new Promise((resolve) => setPending({ o, resolve })), []);
  const answer = (a: ConfirmAnswer) => {
    pending?.resolve(a);
    setPending(undefined);
  };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <Sheet title={pending.o.title} kicker="Confirmation" onClose={() => answer(false)} alert>
          {pending.o.message && (
            <p className="secondary" style={{ marginTop: 0 }}>
              {pending.o.message}
            </p>
          )}
          <div className="confirm-actions">
            <button className={`btn ${pending.o.safe ? 'primary' : 'danger-solid'}`} onClick={() => answer(true)}>
              {pending.o.confirmLabel ?? 'Supprimer'}
            </button>
            {pending.o.altLabel && (
              <button className="btn" onClick={() => answer('alt')}>
                {pending.o.altLabel}
              </button>
            )}
            <button className="btn ghost" onClick={() => answer(false)}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}
    </ConfirmContext.Provider>
  );
}

/** `if (await confirm({ title: 'Supprimer… ?' })) supprimer();` : vrai si l'utilisateur confirme. */
export const useConfirm = () => useContext(ConfirmContext);
