import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameData, type GameData, type LeekRaid } from '../lib/data';
import { DAY, eventStyle, isActive, withDates, type TimedEvent } from '../lib/events';
import { leagueNames, ordered, usePrefs, useT } from '../lib/i18n';
import { gblSchedule, resolveName } from '../lib/names';
import { useRoster } from '../lib/roster';
import EventModal from '../components/EventModal';
import { EventName, OfficialBadge } from '../components/Official';
import { PokeName, Sprite, Types } from '../components/ui';

const locale = (lang: string) => (lang === 'ko' ? 'ko-KR' : 'en-US');

function fmtDateTimeL(d: Date, lang: string) {
  return d.toLocaleString(locale(lang), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function EventRow({ e, onPick }: { e: TimedEvent; onPick: (e: TimedEvent) => void }) {
  const { lang } = usePrefs();
  const t = useT();
  return (
    <div className="event" style={{ ['--ec' as string]: eventStyle(e.eventType).color }} onClick={() => onPick(e)} role="button">
      <img src={e.image} alt="" loading="lazy" />
      <div className="ev-body">
        <div className="ev-name">
                  <EventName event={e} /> <OfficialBadge event={e} />
                </div>
        <div className="muted small">
          {t(eventStyle(e.eventType).label)} · {isActive(e) ? t('ends {date}', { date: fmtDateTimeL(e.endDate, lang) }) : fmtDateTimeL(e.startDate, lang)}
        </div>
      </div>
    </div>
  );
}

/** LeekDuck boss name ("Shadow Alolan Sandslash") → three-language name, raw string if unresolved. */
function BossName({ data, raid }: { data: GameData; raid: LeekRaid }) {
  const t = useT();
  const r = resolveName(data, raid.name);
  if (!r.species) return <span className="mon-name">{raid.name}</span>;
  return (
    <span>
      {r.shadow && <span className="small muted">{t('Shadow')} </span>}
      {r.dynamax && <span className="small muted">{t(r.dynamax === 'gmax' ? 'Gigantamax' : 'Dynamax')} </span>}
      <PokeName species={r.species} />
    </span>
  );
}

function LeagueName({ label }: { label: string }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const { primary, others } = ordered(leagueNames(data, label), lang);
  return (
    <span title={label}>
      <strong>{primary}</strong>
      {others.length > 0 && <span className="small muted"> {others.join(' · ')}</span>}
    </span>
  );
}

export default function Home() {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const { roster } = useRoster();
  const [picked, setPicked] = useState<TimedEvent | null>(null);
  const now = new Date();
  const events = useMemo(() => withDates(data.events), [data.events]);
  const live = events.filter((e) => isActive(e) && !['season', 'go-battle-league', 'go-pass'].includes(e.eventType));
  const soon = events.filter((e) => e.startDate > now && e.startDate.getTime() - now.getTime() < 7 * DAY && e.eventType !== 'go-battle-league');
  const gbl = gblSchedule(data).find((w) => w.start <= now && w.end > now);
  const topRaids = data.raids.filter((r) => /5-star|mega/i.test(r.tier));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{t('Today')}</h1>
          <p className="muted">{now.toLocaleDateString(locale(lang), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="row">
            <h2>{t('Happening now')}</h2>
            <span className="spacer" />
            <Link to="/calendar" className="small">
              {t('Calendar →')}
            </Link>
          </div>
          <div className="event-list">
            {live.length === 0 && <div className="muted">{t('Nothing special live right now.')}</div>}
            {live.map((e) => (
              <EventRow key={e.eventID} e={e} onPick={setPicked} />
            ))}
          </div>
        </div>
        <div className="card">
          <h2>{t('Next 7 days')}</h2>
          <div className="event-list">
            {soon.length === 0 && <div className="muted">{t('No announced events in the next week.')}</div>}
            {soon.map((e) => (
              <EventRow key={e.eventID} e={e} onPick={setPicked} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="row">
            <h2>{t('Headline raids')}</h2>
            <span className="spacer" />
            <Link to="/raids" className="small">
              {t('Counters →')}
            </Link>
          </div>
          <div className="boss-list">
            {topRaids.map((r) => (
              <Link key={r.name} to="/raids" className="card boss-btn" style={{ margin: 0 }}>
                <Sprite src={r.image} size={48} />
                <BossName data={data} raid={r} />
                <Types types={r.types.map((ty) => ty.name)} small />
                <span className="tier">
                  100%: {r.combatPower.normal.max} / {r.combatPower.boosted.max}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="row">
            <h2>{t('GO Battle League')}</h2>
            <span className="spacer" />
            <Link to="/leagues" className="small">
              {t('Schedule →')}
            </Link>
          </div>
          {gbl ? (
            <>
              <p className="muted small">{t('Until {date}', { date: fmtDateTimeL(gbl.end, lang) })}</p>
              <div className="stack">
                {gbl.leagues.map((l) => (
                  <div key={l.label} className="row">
                    <LeagueName label={l.label} />
                    <span className="spacer" />
                    {l.format && (
                      <>
                        <Link className="small" to={`/meta/${l.format.key}`}>
                          {t('Meta')}
                        </Link>
                        <Link className="small" to={`/teams?league=${l.format.key}`}>
                          {t('My team')}
                        </Link>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">{t('No GBL week live.')}</p>
          )}
          <p className="small muted" style={{ marginTop: 12 }}>
            {t('{n} Pokémon saved.', { n: roster.length })} <Link to="/roster">{t('Manage →')}</Link>
          </p>
        </div>
        <div className="card">
          <div className="row">
            <h2>{t('Official news')}</h2>
            <span className="spacer" />
            <a className="small" href="https://pokemongolive.com/news" target="_blank" rel="noreferrer">
              pokemongolive.com ↗
            </a>
          </div>
          {data.news.length === 0 && <p className="muted">{t('No news in the latest data refresh.')}</p>}
          <ul className="news">
            {data.news.slice(0, 8).map((n) => (
              <li key={n.link}>
                <a href={(lang === 'ko' && n.linkKo) || n.link} target="_blank" rel="noreferrer">
                  {(lang === 'ko' && n.titleKo) || n.title}
                </a>
                <span className="small muted"> · {new Date(n.date).toLocaleDateString(locale(lang), { month: 'short', day: 'numeric' })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {picked && <EventModal event={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}
