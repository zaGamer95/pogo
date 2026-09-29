import { useState } from 'react';
import { useGameData, type JpLeague } from '../lib/data';
import { usePrefs, useT } from '../lib/i18n';
import { PokeName, Sprite, Tabs } from './ui';

/**
 * Popular teams observed in real GBL battles (pokemongo-get.com battle-log tool).
 * Counts are how many logged opponent teams used exactly that lead + back line.
 */
export default function JpParties({ league, owned }: { league: JpLeague; owned?: Set<string> }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const [tier, setTier] = useState<'all' | 'high'>('all');
  const [limit, setLimit] = useState(10);
  const parties = league[tier];
  const top = parties[0]?.count ?? 1;
  const fetched = data.jpParties ? new Date(data.jpParties.fetched).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US') : '';

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>{t('Popular teams in real battles')}</h2>
        <span className="spacer" />
        <Tabs
          value={tier}
          onChange={setTier}
          options={[
            { value: 'all', label: t('All ranks') },
            { value: 'high', label: t('Rank 21+ (Ace–Legend)') },
          ]}
        />
      </div>
      <p className="small muted">
        {t('Observed opponent teams logged by players on {site} (recent period, season {season}). Lead = first Pokémon. Updated {date}.', {
          site: 'pokemongo-get.com',
          season: data.jpParties?.season ?? '',
          date: fetched,
        })}{' '}
        <a href={data.jpParties?.source} target="_blank" rel="noreferrer">
          {league.ja} ↗
        </a>
      </p>
      {league.rule && <p className="small">{league.rule}</p>}
      {parties.length === 0 ? (
        <div className="empty">{t('No logged teams for this filter yet.')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('Lead')}</th>
                <th>{t('Back line')}</th>
                <th />
                <th className="right">{t('Teams seen')}</th>
              </tr>
            </thead>
            <tbody>
              {parties.slice(0, limit).map((p) => (
                <tr key={p.rank + p.members.map((m) => m.ja).join()}>
                  <td className="muted">{p.rank}</td>
                  {p.members.map((m, i) => {
                    const sp = m.id ? data.byId.get(m.id) : undefined;
                    const mine = m.id && owned?.has(m.id);
                    return (
                      <td key={i} style={mine ? { background: 'color-mix(in srgb, var(--good) 12%, transparent)' } : undefined}>
                        <div className="mon">
                          <Sprite species={sp} size={32} />
                          {sp ? <PokeName species={sp} /> : <span className="mon-name">{m.ja}</span>}
                        </div>
                      </td>
                    );
                  })}
                  <td className="right" style={{ minWidth: 90 }}>
                    <span className="nowrap">{p.count}</span>
                    <div className="bar">
                      <span style={{ width: `${(p.count / top) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {parties.length > limit && (
            <button style={{ marginTop: 8 }} onClick={() => setLimit(limit + 20)}>
              {t('Show more')}
            </button>
          )}
        </div>
      )}
      {tier === 'all' && league.usage.length > 0 && (
        <>
          <h3 style={{ marginTop: 14 }}>{t('Most used Pokémon')}</h3>
          <div className="row">
            {league.usage.slice(0, 16).map((u) => {
              const sp = data.byId.get(u.id);
              return (
                <span key={u.id} className="pill mon" style={owned?.has(u.id) ? { borderColor: 'var(--good)' } : undefined}>
                  <Sprite species={sp} size={26} />
                  <PokeName species={sp} id={u.id} inline />
                  <span className="muted small">{u.n}</span>
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
