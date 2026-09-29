import type { LeekEvent } from './data';

// Labels are English i18n keys; components render them with t(label) (Korean in src/i18n/ko/calendar.ts).
export const EVENT_TYPES: Record<string, { label: string; color: string }> = {
  'community-day': { label: 'Community Day', color: '#2f9e44' },
  'raid-day': { label: 'Raid Day', color: '#d9480f' },
  'raid-hour': { label: 'Raid Hour', color: '#e8590c' },
  'raid-battles': { label: 'Raid Bosses', color: '#c92a2a' },
  'max-battles': { label: 'Max Battles', color: '#ae3ec9' },
  'max-mondays': { label: 'Max Monday', color: '#9c36b5' },
  'pokemon-spotlight-hour': { label: 'Spotlight Hour', color: '#e0a800' },
  event: { label: 'Event', color: '#1c7ed6' },
  research: { label: 'Research', color: '#0c8599' },
  'go-battle-league': { label: 'GO Battle League', color: '#5f3dc4' },
  'go-pass': { label: 'GO Pass', color: '#495057' },
  season: { label: 'Season', color: '#343a40' },
  'pokemon-go-tour': { label: 'GO Tour', color: '#d6336c' },
  'pokemon-go-fest': { label: 'GO Fest', color: '#d6336c' },
  'wild-area': { label: 'Wild Area', color: '#087f5b' },
  'choose-your-path': { label: 'Choose Your Path', color: '#5c7cfa' },
  'elite-raids': { label: 'Elite Raids', color: '#a61e4d' },
  'research-day': { label: 'Research Day', color: '#1098ad' },
  'go-rocket-takeover': { label: 'Rocket Takeover', color: '#212529' },
  'team-go-rocket': { label: 'Team GO Rocket', color: '#212529' },
  'safari-zone': { label: 'Safari Zone', color: '#5c940d' },
  'city-safari': { label: 'City Safari', color: '#5c940d' },
  'ticketed-event': { label: 'Ticketed', color: '#f08c00' },
};

export function eventStyle(type: string) {
  return EVENT_TYPES[type] ?? { label: type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), color: '#6c757d' };
}

export interface TimedEvent extends LeekEvent {
  startDate: Date;
  endDate: Date;
}

/** LeekDuck times without a "Z" are local (same wall-clock time in every timezone). */
export function withDates(events: LeekEvent[]): TimedEvent[] {
  return events
    .map((e) => ({ ...e, startDate: new Date(e.start), endDate: new Date(e.end) }))
    .filter((e) => !isNaN(e.startDate.getTime()))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export const DAY = 24 * 3600 * 1000;

export function durationDays(e: TimedEvent) {
  return (e.endDate.getTime() - e.startDate.getTime()) / DAY;
}

export function isActive(e: TimedEvent, now = new Date()) {
  return e.startDate <= now && e.endDate > now;
}

export function overlapsDay(e: TimedEvent, day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start.getTime() + DAY);
  return e.startDate < end && e.endDate > start;
}
