import type { LeekEvent } from '../lib/data';
import { usePrefs, useT } from '../lib/i18n';

/** "공식 ✓" when an official post confirms the event, "공식 발표만" when only the official site has it. */
export function OfficialBadge({ event }: { event: LeekEvent }) {
  const t = useT();
  const o = event.official;
  if (!o) return null;
  if (o.only)
    return (
      <span className="pill official-only" title={t('Announced on pokemongo.com, not listed on LeekDuck yet')}>
        {t('Official only')}
      </span>
    );
  return (
    <span className={`pill official${o.mismatch ? ' corrected' : ''}`} title={t(o.mismatch ? 'Times corrected from the official announcement' : 'Confirmed by the official announcement')}>
      {t('Official')} ✓{o.mismatch ? ` · ${t('time fixed')}` : ''}
    </span>
  );
}

/** Event name in the UI language: the official Korean title when there is one. */
export function EventName({ event }: { event: LeekEvent }) {
  const { lang } = usePrefs();
  const ko = event.official?.titleKo;
  if (lang === 'ko' && ko)
    return (
      <span className="pname">
        <span>{ko}</span>
        <span className="pname-alt">{event.name}</span>
      </span>
    );
  return <>{event.name}</>;
}

/** Link to the official post, Korean version in the Korean UI. */
export function officialLink(event: LeekEvent, lang: string): string | null {
  const o = event.official;
  if (!o) return null;
  return lang === 'ko' ? o.urlKo : o.url;
}
