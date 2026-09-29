import { Link } from 'react-router-dom';
import { useGameData } from '../lib/data';
import { gblSchedule, pvpokeLink, type GblWeek } from '../lib/names';
import { Empty, fmtDate, fmtDateTime } from '../components/ui';

function LeagueChips({ week }: { week: GblWeek }) {
  return (
    <div className="row">
      {week.leagues.map((l) =>
        l.format ? (
          <Link key={l.label} className="pill accent" to={`/meta/${l.format.key}`} title={`Meta for ${l.format.title}`}>
            {l.label} →
          </Link>
        ) : (
          <span key={l.label} className="pill" title="No PvPoke ranking available for this cup yet">
            {l.label}
          </span>
        ),
      )}
    </div>
  );
}

export default function Leagues() {
  const data = useGameData();
  const now = new Date();
  const weeks = gblSchedule(data);
  const current = weeks.filter((w) => w.start <= now && w.end > now);
  const upcoming = weeks.filter((w) => w.start > now);
  const past = weeks.filter((w) => w.end <= now).slice(-2);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>PvP Leagues</h1>
          <p className="muted">GO Battle League rotation for the current season. Click a league to see its meta.</p>
        </div>
      </div>

      <div className="card">
        <h2>Live now</h2>
        {current.length === 0 && <Empty>No GBL week is live right now (between seasons?).</Empty>}
        {current.map((w) => (
          <div key={w.event.eventID} className="stack">
            <div className="muted small">
              {w.season} · ends {fmtDateTime(w.end)} ({Math.max(0, Math.ceil((w.end.getTime() - now.getTime()) / 86400000))} days left)
            </div>
            <LeagueChips week={w} />
            <div className="grid cols-3">
              {w.leagues.map((l) => (
                <div key={l.label} className="card" style={{ margin: 0 }}>
                  <h3>{l.label}</h3>
                  <p className="small muted">CP cap: {l.cp >= 10000 ? 'none' : l.cp.toLocaleString()}</p>
                  {l.format?.rules?.map((r) => (
                    <p key={r} className="small">
                      • {r}
                    </p>
                  ))}
                  {l.format ? (
                    <div className="row small">
                      <Link to={`/meta/${l.format.key}`}>Meta comps</Link>
                      <Link to={`/teams?league=${l.format.key}`}>My best team</Link>
                      <a href={pvpokeLink(l.format)} target="_blank" rel="noreferrer">
                        PvPoke ↗
                      </a>
                    </div>
                  ) : (
                    <p className="small muted">PvPoke doesn't have rankings for this cup yet.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Upcoming</h2>
        {upcoming.length === 0 && <Empty>No upcoming GBL weeks announced yet.</Empty>}
        <table>
          <tbody>
            {upcoming.map((w) => (
              <tr key={w.event.eventID}>
                <td className="nowrap" style={{ width: 140 }}>
                  <strong>{fmtDate(w.start)}</strong>
                  <span className="muted"> – {fmtDate(w.end)}</span>
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
          <h3 className="muted">Recently ended</h3>
          <table>
            <tbody>
              {past.map((w) => (
                <tr key={w.event.eventID}>
                  <td className="nowrap muted" style={{ width: 140 }}>
                    {fmtDate(w.start)} – {fmtDate(w.end)}
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
