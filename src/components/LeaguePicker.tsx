import { useGameData, type GameData } from '../lib/data';
import { leagueNames, usePrefs, useT, type Lang } from '../lib/i18n';
import { gblSchedule, jpLeagueForFormat } from '../lib/names';

/** Korean title for a league/cup, with fallbacks for PvPoke-only titles like "Mega Great League". */
function leagueKo(data: GameData, title: string): string | null {
  const exact = data.i18n.leagues[title];
  if (exact) return exact[0];
  const ko = (en: string): string | null => data.i18n.leagues[en]?.[0] ?? null;
  // "Mega Great League", "Mega Color Cup"
  const mega = title.match(/^Mega (.+)$/);
  if (mega) {
    const base = leagueKo(data, mega[1]);
    return base ? `메가 ${base}` : null;
  }
  // "Color Cup: Great League Mega Edition", "Willpower Cup: Great League Edition", "Great League: Mega Edition"
  const ed = title.match(/^(.+?)\s*:\s*(Great League|Ultra League|Master League|Little)?\s*(Mega )?Edition$/);
  if (ed) {
    const cup = ko(ed[1]);
    if (!cup) return null;
    const league = ed[2] ? (ed[2] === 'Little' ? '리틀' : ko(ed[2])) : null;
    return `${ed[3] ? '메가 ' : ''}${cup}${league ? `: ${league} 버전` : ''}`;
  }
  const n = leagueNames(data, title);
  return n.ko !== title ? n.ko : null;
}

/** League title in the UI language: "하이퍼리그 · Ultra League" (ko) or "Ultra League" (en). */
export function leagueLabel(data: GameData, title: string, lang: Lang): string {
  if (lang !== 'ko') return title;
  const ko = leagueKo(data, title);
  return ko && ko !== title ? `${ko} · ${title}` : title;
}

/** League dropdown with the live GBL leagues pinned to the top. */
export function LeaguePicker({ value, onChange, includeJp }: { value: string; onChange: (key: string) => void; includeJp?: boolean }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  // JP-site leagues that PvPoke doesn't rank (e.g. Fantasy Cup, Mega Halloween Cup)
  const jpOnly = includeJp ? (data.jpParties?.leagues ?? []).filter((l) => !data.formats.some((f) => jpLeagueForFormat(data, f.key)?.id === l.id)) : [];
  const now = new Date();
  const live = new Set(
    gblSchedule(data)
      .filter((w) => w.start <= now && w.end > now)
      .flatMap((w) => w.leagues.map((l) => l.format?.key).filter((k): k is string => !!k)),
  );
  const liveFormats = data.formats.filter((f) => live.has(f.key));
  const others = data.formats.filter((f) => !live.has(f.key));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {liveFormats.length > 0 && (
        <optgroup label={t('Live in GO Battle League')}>
          {liveFormats.map((f) => (
            <option key={f.key} value={f.key}>
              {leagueLabel(data, f.title, lang)}
            </option>
          ))}
        </optgroup>
      )}
      {jpOnly.length > 0 && (
        <optgroup label={t('This season (popular teams only, pokemongo-get.com)')}>
          {jpOnly.map((l) => (
            <option key={l.id} value={`jp-${l.id}`}>
              {leagueLabel(data, l.en, lang)} · {l.ja}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={t('All formats')}>
        {others.map((f) => (
          <option key={f.key} value={f.key}>
            {leagueLabel(data, f.title, lang)}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export function defaultLeague(data: ReturnType<typeof useGameData>): string {
  const now = new Date();
  const live = gblSchedule(data).find((w) => w.start <= now && w.end > now);
  return live?.leagues.find((l) => l.format)?.format?.key ?? 'all-1500';
}
