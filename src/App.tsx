import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { DataContext, loadGameData, type GameData } from './lib/data';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import Raids from './pages/Raids';
import Roster from './pages/Roster';
import Leagues from './pages/Leagues';
import Meta from './pages/Meta';
import Teams from './pages/Teams';
import Trade from './pages/Trade';

const NAV = [
  { to: '/', label: 'Today', icon: '◎' },
  { to: '/calendar', label: 'Calendar', icon: '▦' },
  { to: '/raids', label: 'Raids & Max', icon: '⚔' },
  { to: '/roster', label: 'My Pokémon', icon: '❖' },
  { to: '/leagues', label: 'Leagues', icon: '⚑' },
  { to: '/meta', label: 'Meta', icon: '★' },
  { to: '/teams', label: 'My Teams', icon: '⛨' },
  { to: '/trade', label: 'Trade', icon: '⇄' },
];

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGameData().then(setData, (e) => setError(String(e)));
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="ball" aria-hidden />
          PoGo Companion
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon" aria-hidden>
                {n.icon}
              </span>
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        {error && <div className="card error">Couldn't load game data: {error}. Try running <code>npm run data</code>.</div>}
        {!data && !error && <div className="loading">Loading game data…</div>}
        {data && (
          <DataContext.Provider value={data}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/raids" element={<Raids />} />
              <Route path="/roster" element={<Roster />} />
              <Route path="/leagues" element={<Leagues />} />
              <Route path="/meta" element={<Meta />} />
              <Route path="/meta/:key" element={<Meta />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <footer className="footer">
              Data refreshed {new Date(data.meta.updated).toLocaleString()} · Events &amp; raids via LeekDuck (ScrapedDuck) · PvP
              rankings via PvPoke · Stats via PokeMiners game master · Shiny list via LeekDuck · News via pokemongolive.com. Personal, non-commercial use.
            </footer>
          </DataContext.Provider>
        )}
      </main>
    </div>
  );
}
