import { useGameData } from '../lib/data';
import { gblSchedule } from '../lib/names';

/** League dropdown with the live GBL leagues pinned to the top. */
export function LeaguePicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const data = useGameData();
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
        <optgroup label="Live in GO Battle League">
          {liveFormats.map((f) => (
            <option key={f.key} value={f.key}>
              {f.title}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="All formats">
        {others.map((f) => (
          <option key={f.key} value={f.key}>
            {f.title}
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
