import { useEffect, useState } from 'react';
import { Icon } from './components/ui';
import { useStore } from './lib/store';
import { useAuth } from './lib/sync';
import Dashboard from './pages/Dashboard';
import WorkoutPage from './pages/Workout';
import ProgramsPage from './pages/Programs';
import BodyPage from './pages/Body';
import NutritionPage from './pages/Nutrition';
import ProgressPage from './pages/Progress';
import ProfilePage from './pages/Profile';
import Onboarding from './pages/Onboarding';

export type Tab = 'home' | 'workout' | 'programs' | 'body' | 'nutrition' | 'progress' | 'profile';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { id: 'workout', label: 'Séance', icon: 'dumbbell' },
  { id: 'programs', label: 'Programmes', icon: 'list' },
  { id: 'body', label: 'Corps', icon: 'body' },
  { id: 'nutrition', label: 'Nutrition', icon: 'food' },
  { id: 'progress', label: 'Progrès', icon: 'chart' },
];

const readTab = (): Tab => {
  const h = window.location.hash.slice(1) as Tab;
  return [...TABS.map((t) => t.id), 'profile'].includes(h) ? h : 'home';
};

export default function App() {
  const onboarded = useStore((s) => s.onboarded);
  const hasActive = useStore((s) => !!s.activeWorkout);
  const user = useAuth((s) => (s.token ? s.user : undefined));
  const syncError = useAuth((s) => s.status === 'error');
  const [tab, setTab] = useState<Tab>(readTab);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    window.location.hash = t;
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  if (!onboarded) return <Onboarding />;

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            New<span>Shape</span>
          </div>
          <button className="btn ghost sm" onClick={() => go('profile')} aria-label="Profil et réglages">
            {user ? (
              <img src={user.avatarUrl} alt="" width={20} height={20} style={{ borderRadius: '50%', outline: syncError ? '2px solid var(--critical)' : undefined }} />
            ) : (
              <Icon name="user" size={18} />
            )}{' '}
            Profil
          </button>
        </header>
        <main>
          {tab === 'home' && <Dashboard go={go} />}
          {tab === 'workout' && <WorkoutPage go={go} />}
          {tab === 'programs' && <ProgramsPage go={go} />}
          {tab === 'body' && <BodyPage />}
          {tab === 'nutrition' && <NutritionPage go={go} />}
          {tab === 'progress' && <ProgressPage />}
          {tab === 'profile' && <ProfilePage go={go} />}
        </main>
      </div>
      <nav className="nav" aria-label="Navigation principale">
        <div className="nav-inner">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} />
              {t.id === 'workout' && hasActive ? 'En cours' : t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
