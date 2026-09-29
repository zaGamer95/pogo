import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameData, type RankEntry } from '../lib/data';
import { pvpokeLink } from '../lib/names';
import { assignRoles, suggestTeams } from '../lib/pvp';
import { useRoster } from '../lib/roster';
import { useRankings } from '../components/useRankings';
import { LeaguePicker, defaultLeague } from '../components/LeaguePicker';
import { Empty, MoveName, Sprite, Tabs, TypeBadge, Types } from '../components/ui';

type Cat = 'overall' | 'leads' | 'switches' | 'closers' | 'attackers' | 'chargers';

export default function Meta() {
  const data = useGameData();
  const params = useParams();
  const nav = useNavigate();
  const key = params.key ?? defaultLeague(data);
  const format = data.formats.find((f) => f.key === key);
  const { rankings, error } = useRankings(key);
  const { roster } = useRoster();
  const [cat, setCat] = useState<Cat>('overall');
  const owned = new Set(roster.map((m) => (m.shadow ? `${m.speciesId}_shadow` : m.speciesId)));

  const teams = useMemo(() => (rankings ? suggestTeams(data, rankings) : []), [data, rankings]);
  const list = rankings?.[cat] ?? [];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Meta: {format?.title ?? key}</h1>
          <p className="muted">
            Top Pokémon and team cores from PvPoke rankings (updated {data.meta.pvpokeUpdated}).{' '}
            {format && (
              <a href={pvpokeLink(format)} target="_blank" rel="noreferrer">
                Open on PvPoke ↗
              </a>
            )}
          </p>
        </div>
        <LeaguePicker value={key} onChange={(k) => nav(`/meta/${k}`)} />
      </div>
      {error && <div className="card error">Couldn't load rankings for this league.</div>}
      {!rankings && !error && <div className="loading">Loading rankings…</div>}
      {rankings && (
        <>
          <div className="card">
            <h2>Meta team cores</h2>
            <p className="small muted">
              Lead, safe swap and closer picked from PvPoke's role rankings, avoiding teams where two members share a weakness. Green = you own it.
            </p>
            <div className="grid cols-2">
              {teams.map((t, i) => (
                <div key={i} className="card" style={{ margin: 0 }}>
                  <div className="team">
                    {assignRoles([t.lead, t.swap, t.closer].map((rank) => ({ rank }))).map(({ role, m }) => (
                      <TeamSlot key={m.rank.id} role={role} entry={m.rank} owned={owned.has(m.rank.id)} />
                    ))}
                  </div>
                  <div className="row small" style={{ marginTop: 6 }}>
                    <span className="muted">Shared weaknesses:</span>
                    {t.weak.length ? t.weak.map((w) => <TypeBadge key={w} type={w} small />) : <span className="pill good">none</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <Tabs
              value={cat}
              onChange={setCat}
              options={(['overall', 'leads', 'switches', 'closers', 'attackers', 'chargers'] as Cat[])
                .filter((c) => rankings[c])
                .map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))}
            />
            <RankTable list={list.slice(0, 50)} owned={owned} full={cat === 'overall'} />
          </div>
        </>
      )}
    </div>
  );
}

function TeamSlot({ role, entry, owned }: { role: string; entry: RankEntry; owned: boolean }) {
  const data = useGameData();
  const sp = data.byId.get(entry.id);
  return (
    <div className="team-slot" style={owned ? { boxShadow: 'inset 0 0 0 2px var(--good)' } : undefined}>
      <span className="role">{role}</span>
      <Sprite species={sp} size={48} />
      <span className="mon-name small">{sp?.name ?? entry.id}</span>
      {sp && <Types types={sp.types} small />}
      <span className="small">
        {entry.moves.map((m, i) => (
          <span key={m}>
            {i > 0 && ' · '}
            <MoveName id={m} elite={sp?.elite.includes(m)} />
          </span>
        ))}
      </span>
    </div>
  );
}

function RankTable({ list, owned, full }: { list: RankEntry[]; owned: Set<string>; full: boolean }) {
  const data = useGameData();
  if (!list.length) return <Empty>No rankings in this category.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Pokémon</th>
            <th>Moveset</th>
            <th className="right">Score</th>
            {full && <th>Beats</th>}
            {full && <th>Loses to</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((e, i) => {
            const sp = data.byId.get(e.id);
            return (
              <tr key={e.id} className={owned.has(e.id) ? 'mine' : ''}>
                <td className="muted">{i + 1}</td>
                <td>
                  <div className="mon">
                    <Sprite species={sp} size={32} />
                    <div>
                      <div className="mon-name">{sp?.name ?? e.id}</div>
                      {sp && <Types types={sp.types} small />}
                    </div>
                  </div>
                </td>
                <td className="small">
                  {e.moves.map((m, j) => (
                    <span key={m}>
                      {j > 0 && ' / '}
                      <MoveName id={m} elite={sp?.elite.includes(m)} />
                    </span>
                  ))}
                </td>
                <td className="right">{e.score.toFixed(1)}</td>
                {full && <td className="small muted">{e.wins?.slice(0, 3).map((id) => data.byId.get(id)?.name ?? id).join(', ')}</td>}
                {full && <td className="small muted">{e.losses?.slice(0, 3).map((id) => data.byId.get(id)?.name ?? id).join(', ')}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
