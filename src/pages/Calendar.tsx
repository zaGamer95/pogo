import { useMemo, useState } from 'react';
import { useGameData } from '../lib/data';
import { DAY, durationDays, eventStyle, isActive, overlapsDay, withDates, type TimedEvent } from '../lib/events';
import { usePrefs, useT } from '../lib/i18n';
import EventModal from '../components/EventModal';

const HIDDEN_BY_DEFAULT = ['go-battle-league', 'season', 'go-pass'];
const LONG_EVENT_DAYS = 10;
const MAX_PER_DAY = 4;

const locale = (lang: string) => (lang === 'ko' ? 'ko-KR' : 'en-US');

function fmtDate(d: Date, lang: string) {
  return d.toLocaleDateString(locale(lang), { month: 'short', day: 'numeric' });
}

function fmtDateTime(d: Date, lang: string) {
  return d.toLocaleString(locale(lang), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function loadHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem('pogo-cal-hidden') ?? 'null') ?? HIDDEN_BY_DEFAULT;
  } catch {
    return HIDDEN_BY_DEFAULT;
  }
}

function Month({ year, month, events, onPick }: { year: number; month: number; events: TimedEvent[]; onPick: (e: TimedEvent) => void }) {
  const { lang } = usePrefs();
  const t = useT();
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  const lastOfMonth = new Date(year, month + 1, 0);
  const weeks = Math.ceil((first.getDay() + lastOfMonth.getDate()) / 7);
  const today = new Date();
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <h2 style={{ padding: '12px 14px 0' }}>{first.toLocaleDateString(locale(lang), { month: 'long', year: 'numeric' })}</h2>
      <div className="cal" style={{ border: 'none', borderRadius: 0, marginTop: 10 }}>
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} className="cal-dow">
            {d.toLocaleDateString(locale(lang), { weekday: 'short' })}
          </div>
        ))}
        {days.map((d) => {
          const todays = events.filter((e) => overlapsDay(e, d));
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={d.toISOString()} className={`cal-day${d.getMonth() !== month ? ' other' : ''}${isToday ? ' today' : ''}`}>
              <span className="cal-num">{d.getDate()}</span>
              {todays.slice(0, MAX_PER_DAY).map((e) => {
                const cont = e.startDate < new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return (
                  <button
                    key={e.eventID}
                    className={`cal-ev${cont ? ' cont' : ''}`}
                    style={{ ['--ec' as string]: eventStyle(e.eventType).color }}
                    title={`${e.name}\n${fmtDateTime(e.startDate, lang)} → ${fmtDateTime(e.endDate, lang)}`}
                    onClick={() => onPick(e)}
                  >
                    {e.name}
                  </button>
                );
              })}
              {todays.length > MAX_PER_DAY && <span className="cal-more">{t('+{n} more', { n: todays.length - MAX_PER_DAY })}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar() {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const [hidden, setHidden] = useState<string[]>(loadHidden);
  const [picked, setPicked] = useState<TimedEvent | null>(null);
  const [offset, setOffset] = useState(0);
  const all = useMemo(() => withDates(data.events), [data.events]);
  const types = useMemo(() => [...new Set(all.map((e) => e.eventType))], [all]);

  const toggle = (ty: string) => {
    const next = hidden.includes(ty) ? hidden.filter((x) => x !== ty) : [...hidden, ty];
    setHidden(next);
    try {
      localStorage.setItem('pogo-cal-hidden', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const visible = all.filter((e) => !hidden.includes(e.eventType));
  const shortEvents = visible.filter((e) => durationDays(e) <= LONG_EVENT_DAYS);
  const longEvents = visible.filter((e) => durationDays(e) > LONG_EVENT_DAYS);

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const rangeEnd = new Date(next.getFullYear(), next.getMonth() + 1, 1);
  const inRange = visible.filter((e) => e.endDate >= base && e.startDate < rangeEnd);
  const upcoming = inRange.filter((e) => e.endDate > now);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{t('Event Calendar')}</h1>
          <p className="muted">
            {t('Featured events for {a} and {b}. Only announced events appear, so later weeks fill in over time.', {
              a: base.toLocaleDateString(locale(lang), { month: 'long' }),
              b: next.toLocaleDateString(locale(lang), { month: 'long' }),
            })}
          </p>
        </div>
        <div className="row">
          <button onClick={() => setOffset(offset - 1)}>{t('← Prev')}</button>
          <button onClick={() => setOffset(0)} disabled={offset === 0}>
            {t('This month')}
          </button>
          <button onClick={() => setOffset(offset + 1)}>{t('Next →')}</button>
        </div>
      </div>

      <div className="legend">
        {types.map((ty) => (
          <button key={ty} className={hidden.includes(ty) ? 'off' : ''} onClick={() => toggle(ty)} style={{ ['--ec' as string]: eventStyle(ty).color }}>
            <span className="dot" />
            {t(eventStyle(ty).label)}
          </button>
        ))}
      </div>

      {longEvents.filter((e) => e.endDate >= base && e.startDate < rangeEnd).length > 0 && (
        <div className="card">
          <h3>{t('Ongoing / long-running')}</h3>
          <div className="row">
            {longEvents
              .filter((e) => e.endDate >= base && e.startDate < rangeEnd)
              .map((e) => (
                <button key={e.eventID} className="pill" style={{ borderColor: eventStyle(e.eventType).color }} onClick={() => setPicked(e)}>
                  {e.name} · {fmtDate(e.startDate, lang)}–{fmtDate(e.endDate, lang)}
                </button>
              ))}
          </div>
        </div>
      )}

      <Month year={base.getFullYear()} month={base.getMonth()} events={shortEvents} onPick={setPicked} />
      <Month year={next.getFullYear()} month={next.getMonth()} events={shortEvents} onPick={setPicked} />

      <div className="card">
        <h2>{t('List view')}</h2>
        <div className="event-list">
          {upcoming.length === 0 && <div className="empty">{t('No events in this range.')}</div>}
          {upcoming.map((e) => (
            <div key={e.eventID} className="event" style={{ ['--ec' as string]: eventStyle(e.eventType).color }} onClick={() => setPicked(e)} role="button">
              <img src={e.image} alt="" loading="lazy" />
              <div className="ev-body">
                <div className="ev-name">{e.name}</div>
                <div className="muted small">
                  {t(eventStyle(e.eventType).label)} · {fmtDateTime(e.startDate, lang)} → {fmtDateTime(e.endDate, lang)}
                  {isActive(e) && <span className="pill good" style={{ marginLeft: 6 }}>{t('Live')}</span>}
                  {!isActive(e) && e.startDate.getTime() - now.getTime() < 2 * DAY && e.startDate > now && (
                    <span className="pill warn" style={{ marginLeft: 6 }}>{t('Soon')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {picked && <EventModal event={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}
