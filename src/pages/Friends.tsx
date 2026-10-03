import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Tab } from '../App';
import { getExercise } from '../data/exercises';
import { GOAL_LABELS } from '../lib/calc';
import { buildShare, friendHash, lookupFriend, mergeSeries, refreshFriends, useFriends, usePublish, type FriendEntry, type SharePayload } from '../lib/share';
import { useStore } from '../lib/store';
import { syncNow, useAuth } from '../lib/sync';
import { LEVEL_LABELS } from '../components/ProfileForm';
import { ChartTooltip, Empty, fmtDate, fmtNum, Icon, Legend, Segmented } from '../components/ui';

export default function FriendsPage({ go }: { go: (t: Tab) => void }) {
  const { token, user } = useAuth();
  const { friends } = useStore();
  const data = useFriends((s) => s.data);
  const [selected, setSelected] = useState<string | undefined>();

  useEffect(() => {
    if (token && friends.length) void refreshFriends(token, friends);
  }, [token, friends]);

  if (!token || !user) {
    return (
      <div>
        <h1>Amis</h1>
        <div className="card">
          <p>Pour suivre tes amis et comparer vos progrès, connecte-toi d’abord avec ton compte GitHub.</p>
          <button className="btn primary" onClick={() => go('profile')}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const current = selected ?? friends[0];
  const entry = current ? data[current.toLowerCase()] : undefined;

  return (
    <div>
      <h1>Amis</h1>
      <ShareCard />
      <AddFriend onAdded={setSelected} />

      <div className="card">
        <h2>Mes amis</h2>
        {friends.length === 0 && <Empty>Ajoute un ami avec son pseudo GitHub pour comparer vos courbes et vos séances.</Empty>}
        {friends.map((f) => (
          <FriendRow key={f} login={f} entry={data[f.toLowerCase()]} me={user.login} active={f === current} onSelect={() => setSelected(f)} />
        ))}
      </div>

      {current && entry?.share && <Compare friend={entry.share} />}
      {current && entry && !entry.share && (
        <div className="callout">
          @{current} n’a pas encore activé le partage dans New Shape. Envoie-lui le lien de l’app : dès qu’il active « Partager mes progrès », ses courbes apparaîtront ici.
        </div>
      )}
    </div>
  );
}

function Avatar({ url, size = 36 }: { url?: string; size?: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} style={{ borderRadius: '50%', flexShrink: 0 }} />
  ) : (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Icon name="user" size={size / 2} />
    </span>
  );
}

function ShareCard() {
  const { share, setShare } = useStore();
  const { publishedAt, error, gistId } = usePublish();
  const { user } = useAuth();
  const set = (p: Partial<typeof share>) => {
    setShare(p);
    setTimeout(() => void syncNow(), 50);
  };
  return (
    <div className="card">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Partager mes progrès</h2>
        <button
          className={`btn sm ${share.enabled ? 'primary' : ''}`}
          role="switch"
          aria-checked={share.enabled}
          onClick={() => {
            if (!share.enabled && !confirm('Tes progrès (charges, séances et, si tu le choisis, ton poids) seront publiés dans un gist PUBLIC de ton compte GitHub. Toute personne connaissant ton pseudo pourra les voir. Continuer ?')) return;
            set({ enabled: !share.enabled });
          }}
        >
          {share.enabled ? 'Activé' : 'Désactivé'}
        </button>
      </div>
      <p className="small secondary" style={{ marginTop: 8 }}>
        Tes amis te trouvent avec ton pseudo GitHub <b>@{user?.login}</b>. Sont partagés : tes charges (1RM estimés), ta régularité, tes dernières séances
        {share.body ? ', ton poids et ta composition (1 valeur par semaine)' : ''}. Tes notes, mensurations détaillées et ton programme restent privés.
      </p>
      <label className="small" style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={share.body} onChange={(e) => set({ body: e.target.checked })} style={{ width: 20, height: 20, minHeight: 0 }} />
        <span>Inclure mon poids, mon % de gras et ma masse musculaire</span>
      </label>
      {share.enabled && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {error ? (
            <span className="status bad">⚠ {error}</span>
          ) : publishedAt ? (
            <>
              Publié le {fmtDate(publishedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {gistId && (
                <>
                  {' · '}
                  <a href={`https://gist.github.com/${user?.login}/${gistId}`} target="_blank" rel="noreferrer">
                    voir ce qui est public
                  </a>
                </>
              )}
            </>
          ) : (
            'Publication en cours…'
          )}
        </p>
      )}
    </div>
  );
}

function AddFriend({ onAdded }: { onAdded: (login: string) => void }) {
  const { token, user } = useAuth();
  const { friends, addFriend } = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FriendEntry & { login: string }>();

  const search = async () => {
    const login = q.trim().replace(/^@/, '');
    if (!login || !token) return;
    setBusy(true);
    setResult({ ...(await lookupFriend(token, login)), login });
    setBusy(false);
  };
  const already = result?.user && friends.some((f) => f.toLowerCase() === result.user!.login.toLowerCase());
  const isMe = result?.user && result.user.login.toLowerCase() === user?.login.toLowerCase();

  return (
    <div className="card">
      <h2>Trouver un ami</h2>
      <form
        className="row"
        style={{ flexWrap: 'nowrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input aria-label="Pseudo GitHub de ton ami" value={q} onChange={(e) => setQ(e.target.value)} placeholder="pseudo GitHub, ex. octocat" autoCapitalize="none" autoCorrect="off" />
        <button className="btn" disabled={busy || !q.trim()}>
          {busy ? '…' : 'Rechercher'}
        </button>
      </form>
      {result && (
        <div className="list-item" style={{ marginTop: 8 }}>
          {result.status === 'not_found' ? (
            <span className="secondary">Aucun compte GitHub « {result.login} ».</span>
          ) : result.status === 'error' ? (
            <span className="secondary">Recherche impossible (hors connexion ?).</span>
          ) : (
            <>
              <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                <Avatar url={result.user?.avatarUrl} />
                <div style={{ minWidth: 0 }}>
                  <div>
                    <b>{result.user?.name || result.user?.login}</b> <span className="small muted">@{result.user?.login}</span>
                  </div>
                  <div className="small muted">
                    {result.share
                      ? `${GOAL_LABELS[result.share.profile.goal]} · ${result.share.stats.workouts} séances`
                      : 'N’utilise pas encore New Shape ou n’a pas activé le partage'}
                  </div>
                </div>
              </div>
              {isMe ? (
                <span className="small muted">C’est toi 🙂</span>
              ) : already ? (
                <span className="status ok">
                  <Icon name="check" size={14} /> Ajouté
                </span>
              ) : (
                <button
                  className="btn sm primary"
                  onClick={() => {
                    addFriend(result.user!.login);
                    onAdded(result.user!.login);
                  }}
                >
                  <Icon name="plus" size={14} /> Ajouter
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FriendRow({ login, entry, me, active, onSelect }: { login: string; entry?: FriendEntry; me: string; active: boolean; onSelect: () => void }) {
  const { removeFriend } = useStore();
  const s = entry?.share;
  // Ami mutuel : ancien format (pseudos en clair) ou empreinte « ami:moi » dans son partage.
  const [hashMatch, setHashMatch] = useState(false);
  useEffect(() => {
    let alive = true;
    if (s?.friendHashes?.length) void friendHash(login, me).then((h) => alive && setHashMatch(s.friendHashes!.includes(h)));
    else setHashMatch(false);
    return () => {
      alive = false;
    };
  }, [s, login, me]);
  const mutual = hashMatch || s?.friends.some((f) => f.toLowerCase() === me.toLowerCase());
  const thisWeek = s?.weekly.at(-1)?.sessions;
  return (
    <div className="list-item" style={active ? { background: 'var(--surface-2)', margin: '0 -8px', padding: '10px 8px', borderRadius: 8 } : undefined}>
      <button onClick={onSelect} className="row" style={{ flexWrap: 'nowrap', minWidth: 0, background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', flex: 1 }}>
        <Avatar url={entry?.user?.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div>
            <b>{entry?.user?.name || login}</b> <span className="small muted">@{login}</span> {mutual && <span className="tag">Ami mutuel</span>}
          </div>
          <div className="small muted">
            {!entry
              ? 'Chargement…'
              : !s
                ? 'Partage non activé'
                : `${s.stats.lastWorkout ? `dernière séance le ${fmtDate(s.stats.lastWorkout)}` : 'aucune séance'} · ${thisWeek ?? 0} cette semaine`}
          </div>
        </div>
      </button>
      <button className="btn ghost sm" aria-label={`Retirer @${login}`} onClick={() => confirm(`Ne plus suivre @${login} ?`) && removeFriend(login)}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

// ---------- Comparaison ----------

type View = 'force' | 'regularite' | 'corps';

function Compare({ friend }: { friend: SharePayload }) {
  const state = useStore();
  const { user } = useAuth();
  const mine = useMemo(() => buildShare(state, user!), [state.workouts, state.body, state.share, state.friends, state.profile, user]);
  const [view, setView] = useState<View>('force');
  const [indexed, setIndexed] = useState(true);
  // Mouvements de base d'abord : plus parlants à comparer qu'un accessoire.
  const MAIN = ['squat', 'bench', 'deadlift', 'ohp', 'barbell_row', 'pullup', 'hack_squat', 'db_bench', 'leg_press', 'rdl'];
  const rank = (id: string) => (MAIN.includes(id) ? MAIN.indexOf(id) : MAIN.length);
  const common = Object.keys(mine.lifts)
    .filter((id) => friend.lifts[id]?.length)
    .sort((a, b) => rank(a) - rank(b));
  const [lift, setLift] = useState<string>();
  const exId = lift && common.includes(lift) ? lift : common[0];
  const fname = friend.user.name || friend.user.login;

  const liftData = exId
    ? mergeSeries(
        mine.lifts[exId].map((p) => ({ date: p.date, value: p.e1rm })),
        friend.lifts[exId].map((p) => ({ date: p.date, value: p.e1rm })),
        indexed,
      )
    : [];
  const weekly = mine.weekly.slice(-12).map((w, i) => ({ week: w.week, me: w.sessions, friend: friend.weekly.slice(-12)[i]?.sessions ?? 0 }));
  const bodyData =
    mine.body && friend.body
      ? mergeSeries(
          mine.body.map((b) => ({ date: b.date, value: b.weight })),
          friend.body.map((b) => ({ date: b.date, value: b.weight })),
          true,
        )
      : [];
  const legend = [
    { label: 'Moi', color: 'var(--series-1)' },
    { label: fname, color: 'var(--series-2)' },
  ];
  const sum = (w: { sessions: number }[]) => w.slice(-4).reduce((s, x) => s + x.sessions, 0);

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>Moi vs {fname}</h2>
          <span className="small muted">
            {GOAL_LABELS[friend.profile.goal]} · {LEVEL_LABELS[friend.profile.level].split(' (')[0]}
          </span>
        </div>
        <div style={{ marginBottom: 12, overflowX: 'auto' }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'force', label: 'Force' },
              { value: 'regularite', label: 'Régularité' },
              { value: 'corps', label: 'Corps' },
            ]}
          />
        </div>

        {view === 'force' &&
          (common.length === 0 ? (
            <Empty>Pas encore d’exercice en commun. Dès que vous aurez fait le même mouvement, vos courbes apparaîtront ici.</Empty>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 8 }}>
                <select aria-label="Exercice" value={exId} onChange={(e) => setLift(e.target.value)} style={{ width: 'auto', flex: 1 }}>
                  {common.map((id) => (
                    <option key={id} value={id}>
                      {getExercise(id).name}
                    </option>
                  ))}
                </select>
                <Segmented
                  value={indexed ? 'pct' : 'kg'}
                  onChange={(v) => setIndexed(v === 'pct')}
                  options={[
                    { value: 'pct', label: 'Progression %' },
                    { value: 'kg', label: 'kg' },
                  ]}
                />
              </div>
              <Legend items={legend} />
              <div className="chart">
                <ResponsiveContainer>
                  <LineChart data={liftData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                    <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tickFormatter={(v) => (indexed ? `${v > 0 ? '+' : ''}${v} %` : String(v))} />
                    <Tooltip content={<ChartTooltip unit={indexed ? ' %' : ' kg'} />} />
                    <Line type="monotone" dataKey="me" name="Moi" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-1)' }} connectNulls />
                    <Line type="monotone" dataKey="friend" name={fname} stroke="var(--series-2)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-2)' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="small muted">
                {indexed
                  ? 'Progression du 1RM estimé depuis votre première séance respective : compare l’évolution, quel que soit votre niveau de départ.'
                  : 'Valeurs brutes du 1RM estimé (meilleure série de chaque séance).'}
              </p>
            </>
          ))}

        {view === 'regularite' && (
          <>
            <div className="tiles">
              <div className="tile">
                <div className="label">Moi · 4 dernières semaines</div>
                <div className="value">{sum(mine.weekly)} séances</div>
              </div>
              <div className="tile">
                <div className="label">{fname} · 4 dernières semaines</div>
                <div className="value">{sum(friend.weekly)} séances</div>
              </div>
            </div>
            <Legend items={legend} />
            <div className="chart sm">
              <ResponsiveContainer>
                <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickFormatter={(d) => fmtDate(d)} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={16} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip unit=" séance(s)" />} cursor={{ fill: 'var(--surface-2)' }} />
                  <Bar dataKey="me" name="Moi" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="friend" name={fname} fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {view === 'corps' &&
          (!friend.body ? (
            <Empty>{fname} ne partage pas son poids.</Empty>
          ) : !mine.body ? (
            <Empty>Active « Inclure mon poids » dans ton partage pour comparer vos évolutions.</Empty>
          ) : (
            <>
              <Legend items={legend} />
              <div className="chart">
                <ResponsiveContainer>
                  <LineChart data={bodyData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v} %`} />
                    <Tooltip content={<ChartTooltip unit=" %" />} />
                    <Line type="monotone" dataKey="me" name="Moi" stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="friend" name={fname} stroke="var(--series-2)" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="small muted">Variation du poids (tendance lissée) en % depuis le début : la comparaison reste juste quel que soit votre gabarit.</p>
              <BodySummary label="Moi" body={mine.body} />
              <BodySummary label={fname} body={friend.body} />
            </>
          ))}
      </div>

      <div className="card">
        <h2>Dernières séances de {fname}</h2>
        {friend.recent.length === 0 && <Empty>Aucune séance partagée.</Empty>}
        {friend.recent.map((w, i) => (
          <div className="list-item" key={i} style={{ display: 'block' }}>
            <div className="spread">
              <b>{w.dayName}</b>
              <span className="small muted">
                {fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                {w.durationMin ? ` · ${w.durationMin} min` : ''} · {fmtNum(w.tonnage / 1000, 1)} t
              </span>
            </div>
            <div className="small secondary">{w.top.map((t) => `${getExercise(t.id).name} ${t.weight ? `${fmtNum(t.weight)} kg` : 'PDC'} × ${t.reps}`).join(' · ')}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function BodySummary({ label, body }: { label: string; body: NonNullable<SharePayload['body']> }) {
  const first = body[0];
  const last = body.at(-1)!;
  const firstOf = (k: 'bf' | 'muscle') => body.find((b) => b[k] !== undefined)?.[k];
  const lastOf = (k: 'bf' | 'muscle') => [...body].reverse().find((b) => b[k] !== undefined)?.[k];
  const d = (a: number | undefined, b: number | undefined, name: string, unit: string) =>
    a !== undefined && b !== undefined ? `${name} ${b - a > 0 ? '+' : ''}${fmtNum(b - a)}${unit}` : undefined;
  const parts = [d(first.weight, last.weight, 'poids', ' kg'), d(firstOf('bf'), lastOf('bf'), '% gras', ' pt'), d(firstOf('muscle'), lastOf('muscle'), 'muscle', ' kg')].filter(Boolean);
  return (
    <div className="small" style={{ marginTop: 6 }}>
      <b>{label}</b> : {parts.join(' · ')}{' '}
      <span className="muted">(depuis le {fmtDate(first.date)})</span>
    </div>
  );
}
