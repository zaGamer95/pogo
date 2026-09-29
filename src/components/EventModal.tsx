import { useGameData } from '../lib/data';
import { eventStyle, type TimedEvent } from '../lib/events';
import { resolveName } from '../lib/names';
import { Sprite, fmtDateTime } from './ui';

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
            {style.label}
          </span>
          <span className="spacer" />
          <button onClick={onClose}>Close</button>
        </div>
        <h2 style={{ marginTop: 8 }}>{event.name}</h2>
        <p className="muted">
          {fmtDateTime(event.startDate)} → {fmtDateTime(event.endDate)}
        </p>
        {lists.map((l) => (
          <div key={l.title} style={{ marginBottom: 10 }}>
            <h3>{l.title}</h3>
            <div className="row">
              {l.items.map((i) => {
                const sp = resolveName(data, i.name).species ?? undefined;
                return (
                  <span key={i.name} className="mon pill">
                    <Sprite src={i.image} species={sp} size={28} />
                    {i.name}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {spot?.bonus && <p>Bonus: {spot.bonus}</p>}
        {cd?.bonuses?.length ? (
          <>
            <h3>Bonuses</h3>
            <ul>
              {cd.bonuses.map((b) => (
                <li key={b.text}>{b.text}</li>
              ))}
            </ul>
          </>
        ) : null}
        <a href={event.link} target="_blank" rel="noreferrer">
          Full details on LeekDuck ↗
        </a>
      </div>
    </div>
  );
}
