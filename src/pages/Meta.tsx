import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameData, type RankEntry } from '../lib/data';
import { jpLeagueForFormat, pvpokeLink } from '../lib/names';
import JpParties from '../components/JpParties';
import { assignRoles, suggestTeams } from '../lib/pvp';
import { useRoster } from '../lib/roster';
import { useRankings } from '../components/useRankings';
import { LeaguePicker, defaultLeague, leagueLabel } from '../components/LeaguePicker';
import { Empty, MoveName, PokeName, Sprite, Tabs, TypeBadge, Types } from '../components/ui';
import { usePrefs, useT } from '../lib/i18n';

type Cat = 'overall' | 'leads' | 'switches' | 'closers' | 'attackers' | 'chargers';

export default function Meta() {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const params = useParams();
  const nav = useNavigate();
  const key = params.key ?? defaultLeague(data);
  const jpOnlyId = key.startsWith('jp-') ? Number(key.slice(3)) : null;
  const format = jpOnlyId === null ? data.formats.find((f) => f.key === key) : undefined;
  const jpLeague = jpOnlyId !== null ? data.jpParties?.leagues.find((l) => l.id === jpOnlyId) ?? null : jpLeagueForFormat(data, key);
  const { rankings, error } = useRankings(format ? key : undefined);
  const { roster } = useRoster();
  const [cat, setCat] = useState<Cat>('overall');
  const owned = new Set(roster.map((m) => (m.shadow ? `${m.speciesId}_shadow` : m.speciesId)));

  const teams = useMemo(() => (rankings ? suggestTeams(data, rankings) : []), [data, rankings]);
  const list = rankings?.[cat] ?? [];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{t('Meta: {league}', { league: format ? leagueLabel(data, format.title, lang) : jpLeague ? leagueLabel(data, jpLeague.en, lang) : key })}</h1>
          <p className="muted">
            {t('Top Pokémon and team cores from PvPoke rankings (updated {date}).', { date: data.meta.pvpokeUpdated })}{' '}
            {format && (
              <a href={pvpokeLink(format)} target="_blank" rel="noreferrer">
                {t('Open on PvPoke ↗')}
              </a>
            )}
          </p>
        </div>
        <LeaguePicker value={key} onChange={(k) => nav(`/meta/${k}`)} includeJp />
      </div>
      {!format && <div className="card">{t("PvPoke doesn't rank this cup, so only the popular teams from real battles are shown.")}</div>}
      {jpLeague && <JpParties league={jpLeague} owned={owned} />}
      {format && error && <div className="card error">{t("Couldn't load rankings for this league.")}</div>}
      {format && !rankings && !error && <div className="loading">{t('Loading rankings…')}</div>}
      {rankings && (
        <>
          <div className="card">
            <h2>{t('Meta team cores')}</h2>
            <p className="small muted">
              {t("Lead, safe swap and closer picked from PvPoke's role rankings, avoiding teams where two members share a weakness. Green = you own it.")}
            </p>
            <div className="grid cols-2">
              {teams.map((tm, i) => (
                <div key={i} className="card" style={{ margin: 0 }}>
                  <div className="team">
                    {assignRoles([tm.lead, tm.swap, tm.closer].map((rank) => ({ rank }))).map(({ role, m }) => (
                      <TeamSlot key={m.rank.id} role={role} entry={m.rank} owned={owned.has(m.rank.id)} />
                    ))}
                  </div>
                  <div className="row small" style={{ marginTop: 6 }}>
                    <span className="muted">{t('Shared weaknesses:')}</span>
                    {tm.weak.length ? tm.weak.map((w) => <TypeBadge key={w} type={w} small />) : <span className="pill good">{t('none')}</span>}
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
                .map((c) => ({ value: c, label: t(c[0].toUpperCase() + c.slice(1)) }))}
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
  const t = useT();
  const sp = data.byId.get(entry.id);
  return (
    <div className="team-slot" style={owned ? { boxShadow: 'inset 0 0 0 2px var(--good)' } : undefined}>
      <span className="role">{t(role)}</span>
      <Sprite species={sp} size={48} />
      <PokeName species={sp} id={entry.id} className="small" />
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
  const t = useT();
  if (!list.length) return <Empty>{t('No rankings in this category.')}</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{t('Pokémon')}</th>
            <th>{t('Moveset')}</th>
            <th className="right">{t('Score')}</th>
            {full && <th>{t('Beats')}</th>}
            {full && <th>{t('Loses to')}</th>}
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
                      <PokeName species={sp} id={e.id} />
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
                {full && <td className="small muted">{e.wins && <MonList ids={e.wins.slice(0, 3)} />}</td>}
                {full && <td className="small muted">{e.losses && <MonList ids={e.losses.slice(0, 3)} />}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonList({ ids }: { ids: string[] }) {
  return (
    <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
      {ids.map((id) => (
        <PokeName key={id} id={id} />
      ))}
    </div>
  );
}
