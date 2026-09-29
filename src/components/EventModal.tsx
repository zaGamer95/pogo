import { useGameData } from '../lib/data';
import { eventStyle, type TimedEvent } from '../lib/events';
import { usePrefs, useT } from '../lib/i18n';
import { resolveName } from '../lib/names';
import { PokeName, Sprite } from './ui';

function fmtDateTime(d: Date, lang: string) {
  return d.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface Named {
  name: string;
  image?: string;
}

function namedList(extra: Record<string, unknown> | undefined): { title: string; items: Named[] }[] {
  if (!extra) return [];
  const out: { title: string; items: Named[] }[] = [];
  const cd = extra.communityday as { spawns?: Named[]; bonuses?: { text: string }[] } | undefined;
  if (cd?.spawns?.length) out.push({ title: 'Featured', items: cd.spawns });
  const rb = extra.raidbattles as { bosses?: Named[] } | undefined;
  if (rb?.bosses?.length) out.push({ title: 'Bosses', items: rb.bosses });
  const sp = extra.spotlight as { list?: Named[] } | undefined;
  if (sp?.list?.length) out.push({ title: 'Spotlight', items: sp.list });
  return out;
}

export default function EventModal({ event, onClose }: { event: TimedEvent; onClose: () => void }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const style = eventStyle(event.eventType);
  const lists = namedList(event.extraData);
  const cd = event.extraData?.communityday as { bonuses?: { text: string }[] } | undefined;
  const spot = event.extraData?.spotlight as { bonus?: string } | undefined;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <img className="hero" src={event.image} alt="" />
        <div className="row">
          <span className="pill" style={{ borderColor: style.color, color: style.color }}>
            {t(style.label)}
          </span>
          <span className="spacer" />
          <button onClick={onClose}>{t('Close')}</button>
        </div>
        <h2 style={{ marginTop: 8 }}>{event.name}</h2>
        <p className="muted">
          {fmtDateTime(event.startDate, lang)} → {fmtDateTime(event.endDate, lang)}
        </p>
        {lists.map((l) => (
          <div key={l.title} style={{ marginBottom: 10 }}>
            <h3>{t(l.title)}</h3>
            <div className="row">
              {l.items.map((i) => {
                const r = resolveName(data, i.name);
                const sp = r.species ?? undefined;
                return (
                  <span key={i.name} className="mon pill">
                    <Sprite src={i.image} species={sp} size={28} />
                    {sp ? (
                      <>
                        {r.shadow && <span className="muted">{t('Shadow')} </span>}
                        {r.dynamax && <span className="muted">{t(r.dynamax === 'gmax' ? 'Gigantamax' : 'Dynamax')} </span>}
                        <PokeName species={sp} inline />
                      </>
                    ) : (
                      i.name
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {spot?.bonus && <p>{t('Bonus: {text}', { text: spot.bonus })}</p>}
        {cd?.bonuses?.length ? (
          <>
            <h3>{t('Bonuses')}</h3>
            <ul>
              {cd.bonuses.map((b) => (
                <li key={b.text}>{b.text}</li>
              ))}
            </ul>
          </>
        ) : null}
        <a href={event.link} target="_blank" rel="noreferrer">
          {t('Full details on LeekDuck ↗')}
        </a>
      </div>
    </div>
  );
}
