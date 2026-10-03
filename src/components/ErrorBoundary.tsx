import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Copie brute des données locales : dernier recours si l'affichage plante. */
function downloadBackup() {
  const keys = ['new-shape-v1'];
  const dump: Record<string, unknown> = {};
  for (const k of keys) {
    try {
      dump[k] = JSON.parse(localStorage.getItem(k) ?? 'null');
    } catch {
      dump[k] = null;
    }
  }
  const state = (dump['new-shape-v1'] as { state?: unknown } | null)?.state ?? {};
  const blob = new Blob([JSON.stringify({ app: 'new-shape', exportedAt: new Date().toISOString(), ...(state as object) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `new-shape-secours-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Filet de sécurité : une erreur d'affichage (donnée inattendue, bug) ne laisse plus un écran blanc.
 * L'utilisateur peut revenir à l'accueil, recharger, ou sauvegarder ses données.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode; onHome?: () => void }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Erreur d’affichage', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="card" role="alert" style={{ margin: 16 }}>
        <h2>Oups, cet écran a rencontré un problème</h2>
        <p className="secondary">Tes données ne sont pas perdues. Tu peux revenir à l’accueil, recharger l’app, ou télécharger une copie de tes données par sécurité.</p>
        <div className="row" style={{ gap: 8 }}>
          {this.props.onHome && (
            <button
              className="btn primary"
              onClick={() => {
                this.setState({ error: undefined });
                this.props.onHome?.();
              }}
            >
              Revenir à l’accueil
            </button>
          )}
          <button className="btn" onClick={() => window.location.reload()}>
            Recharger
          </button>
          <button className="btn ghost" onClick={downloadBackup}>
            Télécharger mes données
          </button>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="small muted">Détail technique</summary>
          <pre className="small muted" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {String(error.message).slice(0, 500)}
          </pre>
        </details>
      </div>
    );
  }
}
