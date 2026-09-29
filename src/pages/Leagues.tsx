import { Link } from 'react-router-dom';
import { useGameData } from '../lib/data';
import { leagueNames, ordered, usePrefs, useT } from '../lib/i18n';
import { gblSchedule, metaKeyForLabel, pvpokeLink, type GblWeek } from '../lib/names';
import { Empty } from '../components/ui';

const locale = (lang: string) => (lang === 'ko' ? 'ko-KR' : 'en-US');

function fmtDate(d: Date, lang: string) {
  return d.toLocaleDateString(locale(lang), { month: 'short', day: 'numeric' });
}

function fmtDateTime(d: Date, lang: string) {
  return d.toLocaleString(locale(lang), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** League title in the UI language, the other two small. */
function LeagueName({ label, block }: { label: string; block?: boolean }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const { primary, others } = ordered(leagueNames(data, label), lang);
  return (
    <span title={label}>
      {primary}
      {others.length > 0 && (
        <span className="small muted" style={block ? { display: 'block', fontWeight: 'normal' } : undefined}>
          {block ? '' : ' '}
          {others.join(' · ')}
        </span>
      )}
    </span>
  );
}

function LeagueChips({ week }: { week: GblWeek }) {
  const data = useGameData();
  const t = useT();
  return (
    <div className="row">
      {week.leagues.map((l) =>
        metaKeyForLabel(data, l.label) ? (
          <Link key={l.label} className="pill accent" to={`/meta/${metaKeyForLabel(data, l.label)}`} title={l.label}>
            <LeagueName label={l.label} /> →
          </Link>
        ) : (
          <span key={l.label} className="pill" title={t('No PvPoke ranking available for this cup yet')}>
            <LeagueName label={l.label} />
          </span>
        ),
      )}
    </div>
  );
}

export default function Leagues() {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const now = new Date();
  const weeks = gblSchedule(data);
  const current = weeks.filter((w) => w.start <= now && w.end > now);
  const upcoming = weeks.filter((w) => w.start > now);
  const past = weeks.filter((w) => w.end <= now).slice(-2);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{t('PvP Leagues')}</h1>
          <p className="muted">{t('GO Battle League rotation for the current season. Click a league to see its meta.')}</p>
        </div>
      </div>

      <div className="card">
        <h2>{t('Live now')}</h2>
        {current.length === 0 && <Empty>{t('No GBL week is live right now (between seasons?).')}</Empty>}
        {current.map((w) => (
          <div key={w.event.eventID} className="stack">
            <div className="muted small">
              {w.season} · {t('ends {date} ({n} days left)', { date: fmtDateTime(w.end, lang), n: Math.max(0, Math.ceil((w.end.getTime() - now.getTime()) / 86400000)) })}
            </div>
            <LeagueChips week={w} />
            <div className="grid cols-3">
              {w.leagues.map((l) => (
                <div key={l.label} className="card" style={{ margin: 0 }}>
                  <h3>
                    <LeagueName label={l.label} block />
                  </h3>
                  <p className="small muted">{t('CP cap: {cap}', { cap: l.cp >= 10000 ? t('none') : l.cp.toLocaleString() })}</p>
                  {l.format?.rules?.map((r) => (
                    <p key={r} className="small">
                      • {r}
                    </p>
                  ))}
                  {metaKeyForLabel(data, l.label) && !l.format && (
                    <div className="row small">
                      <Link to={`/meta/${metaKeyForLabel(data, l.label)}`}>{t('Popular teams (pokemongo-get.com)')}</Link>
                    </div>
                  )}
                  {l.format ? (
                    <div className="row small">
                      <Link to={`/meta/${l.format.key}`}>{t('Meta comps')}</Link>
                      <Link to={`/teams?league=${l.format.key}`}>{t('My best team')}</Link>
                      <a href={pvpokeLink(l.format)} target="_blank" rel="noreferrer">
                        PvPoke ↗
                      </a>
                    </div>
                  ) : (
                    <p className="small muted">{t("PvPoke doesn't have rankings for this cup yet.")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{t('Upcoming')}</h2>
        {upcoming.length === 0 && <Empty>{t('No upcoming GBL weeks announced yet.')}</Empty>}
        <table>
          <tbody>
            {upcoming.map((w) => (
              <tr key={w.event.eventID}>
                <td className="nowrap" style={{ width: 140 }}>
                  <strong>{fmtDate(w.start, lang)}</strong>
                  <span className="muted"> – {fmtDate(w.end, lang)}</span>
                </td>
                <td>
                  <LeagueChips week={w} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {past.length > 0 && (
        <div className="card">
          <h3 className="muted">{t('Recently ended')}</h3>
          <table>
            <tbody>
              {past.map((w) => (
                <tr key={w.event.eventID}>
                  <td className="nowrap muted" style={{ width: 140 }}>
                    {fmtDate(w.start, lang)} – {fmtDate(w.end, lang)}
                  </td>
                  <td>
                    <LeagueChips week={w} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
