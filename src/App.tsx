import { useEffect, useState } from 'react';
import { Icon } from './components/ui';
import Logo from './components/Logo';
import PullToRefresh from './components/PullToRefresh';
import { ExerciseInfoProvider } from './components/ExerciseInfo';
import { StreakButton } from './components/StreakCalendar';
import ErrorBoundary from './components/ErrorBoundary';
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
import FriendsPage from './pages/Friends';

export type Tab = 'home' | 'workout' | 'programs' | 'body' | 'nutrition' | 'progress' | 'profile' | 'friends';

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
  return [...TABS.map((t) => t.id), 'profile', 'friends'].includes(h) ? h : 'home';
};

export default function App() {
  const onboarded = useStore((s) => s.onboarded);
  const hasActive = useStore((s) => !!s.activeWorkout);
  const user = useAuth((s) => s.user);
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

  const avatar = user ? (
    user.avatarUrl ? (
      <img className="avatar" src={user.avatarUrl} alt="" width={24} height={24} style={syncError ? { outline: '2px solid var(--critical)' } : undefined} />
    ) : (
      <span className="avatar avatar-initial" style={{ fontSize: 12, ...(syncError ? { outline: '2px solid var(--critical)' } : {}) }} aria-hidden>
        {user.login.slice(0, 1).toUpperCase()}
      </span>
    )
  ) : (
    <Icon name="user" size={20} />
  );
  const label = (t: (typeof TABS)[number]) => (t.id === 'workout' && hasActive ? 'En cours' : t.label);

  return (
    <ExerciseInfoProvider>
    <div className="shell">
      <PullToRefresh />
      {/* iPad / ordinateur : navigation latérale */}
      <aside className="sidebar" aria-label="Navigation principale">
        <button className="sidebar-logo" onClick={() => go('home')} aria-label="Accueil New Shape">
          <span className="logo-full">
            <Logo size={34} />
          </span>
          <span className="logo-compact">
            <Logo size={38} compact />
          </span>
        </button>
        <nav className="side-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`side-link ${tab === t.id ? 'active' : ''}`} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <span className="side-icon">
                <Icon name={t.icon} />
                {t.id === 'workout' && hasActive && <i className="live-dot" aria-hidden />}
              </span>
              <span className="side-label">{label(t)}</span>
            </button>
          ))}
        </nav>
        <div className="side-nav side-foot">
          <StreakButton className="side-link" withLabel />
          <button className={`side-link ${tab === 'friends' ? 'active' : ''}`} onClick={() => go('friends')} aria-current={tab === 'friends' ? 'page' : undefined}>
            <span className="side-icon">
              <Icon name="users" />
            </span>
            <span className="side-label">Amis</span>
          </button>
          <button className={`side-link ${tab === 'profile' ? 'active' : ''}`} onClick={() => go('profile')} aria-current={tab === 'profile' ? 'page' : undefined} aria-label="Profil et réglages">
            <span className="side-icon">{avatar}</span>
            <span className="side-label">{user ? user.login : 'Profil'}</span>
          </button>
        </div>
      </aside>

      <div className="main-col">
        {/* iPhone : barre du haut */}
        <header className="topbar">
          <button className="topbar-logo" onClick={() => go('home')} aria-label="Accueil New Shape">
            <Logo size={30} />
          </button>
          <div className="topbar-actions">
            <StreakButton />
            <button className={`icon-btn ${tab === 'friends' ? 'active' : ''}`} onClick={() => go('friends')} aria-label="Amis">
              <Icon name="users" size={20} />
            </button>
            <button className={`icon-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => go('profile')} aria-label="Profil et réglages">
              {avatar}
            </button>
          </div>
        </header>
        <main className="content" key={tab}>
          {/* Une page qui plante n'empêche pas d'utiliser les autres (navigation toujours disponible). */}
          <ErrorBoundary onHome={() => go('home')}>
          {tab === 'home' && <Dashboard go={go} />}
          {tab === 'workout' && <WorkoutPage go={go} />}
          {tab === 'programs' && <ProgramsPage go={go} />}
          {tab === 'body' && <BodyPage />}
          {tab === 'nutrition' && <NutritionPage go={go} />}
          {tab === 'progress' && <ProgressPage />}
          {tab === 'profile' && <ProfilePage go={go} />}
          {tab === 'friends' && <FriendsPage go={go} />}
          </ErrorBoundary>
        </main>
      </div>

      {/* iPhone : onglets en bas */}
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon">
              <Icon name={t.icon} />
              {t.id === 'workout' && hasActive && <i className="live-dot" aria-hidden />}
            </span>
            {label(t)}
          </button>
        ))}
      </nav>
    </div>
    </ExerciseInfoProvider>
  );
}
