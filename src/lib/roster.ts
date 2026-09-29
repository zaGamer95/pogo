import { useCallback, useEffect, useState } from 'react';
import type { GameData, Species } from './data';
import { levelFromCP, type IVs } from './calc';
import { resolveName } from './names';

export interface RosterMon {
  uid: string;
  speciesId: string; // non-shadow id, e.g. "machamp"
  nickname?: string;
  shadow?: boolean;
  purified?: boolean;
  lucky?: boolean;
  dynamax?: 'dmax' | 'gmax';
  bestBuddy?: boolean;
  ivs: IVs;
  level: number;
  fast?: string;
  charged: string[];
  raidReady?: boolean;
  pvpReady?: boolean;
  shiny?: boolean;
  forTrade?: boolean;
  favorite?: boolean;
  source?: 'pokegenie' | 'manual';
  notes?: string;
  addedAt: number;
}

const KEY = 'pogo-roster-v1';
const listeners = new Set<(r: RosterMon[]) => void>();

function read(): RosterMon[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RosterMon[]) : [];
  } catch {
    return [];
  }
}

function persist(roster: RosterMon[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(roster));
  } catch {
    /* storage full or blocked – keep in memory */
  }
  listeners.forEach((l) => l(roster));
}

let current: RosterMon[] = read();

export function newUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function useRoster() {
  const [roster, setRoster] = useState<RosterMon[]>(current);
  useEffect(() => {
    listeners.add(setRoster);
    return () => void listeners.delete(setRoster);
  }, []);

  const save = useCallback((next: RosterMon[]) => {
    current = next;
    persist(next);
  }, []);

  return {
    roster,
    upsert: (m: RosterMon) => {
      const exists = current.some((x) => x.uid === m.uid);
      save(exists ? current.map((x) => (x.uid === m.uid ? m : x)) : [...current, m]);
    },
    remove: (uid: string) => save(current.filter((x) => x.uid !== uid)),
    replaceAll: (next: RosterMon[]) => save(next),
    addMany: (items: RosterMon[]) => save([...current, ...items]),
  };
}

/** Species entry to use for battle maths (shadow variant when the mon is shadow). */
export function battleSpecies(data: GameData, m: RosterMon): Species | undefined {
  if (m.shadow) return data.byId.get(`${m.speciesId}_shadow`) ?? data.byId.get(m.speciesId);
  return data.byId.get(m.speciesId);
}

export function exportRoster(roster: RosterMon[]): string {
  return JSON.stringify({ app: 'pogo-companion', version: 1, exported: new Date().toISOString(), roster }, null, 2);
}

export function parseRosterJson(text: string): RosterMon[] {
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : parsed.roster;
  if (!Array.isArray(list)) throw new Error('No roster array found in file');
  return list.map((m: RosterMon) => ({ ...m, uid: m.uid ?? newUid(), charged: m.charged ?? [] }));
}

// ---------- Poke Genie CSV import ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const FORM_MAP: Record<string, string> = {
  alola: 'Alolan',
  alolan: 'Alolan',
  galar: 'Galarian',
  galarian: 'Galarian',
  hisui: 'Hisuian',
  hisuian: 'Hisuian',
  paldea: 'Paldean',
  paldean: 'Paldean',
};

function moveIdByName(data: GameData, name: string): string | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [id, m] of Object.entries(data.moves)) {
    if (m.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n) return id;
  }
  const guess = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return data.moves[guess] ? guess : undefined;
}

const truthy = (v: string | undefined) => ['1', 'true', 'yes', 'y'].includes((v ?? '').trim().toLowerCase());

export interface ImportResult {
  added: RosterMon[];
  skipped: string[];
}

/** Accepts the CSV exported from Poke Genie (Settings → Export). Column names are matched loosely. */
export function importPokeGenieCsv(data: GameData, text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV looks empty');
  // Poke Genie renames/relabels columns between versions, so match on letters+digits only
  const squash = (h: string) => h.toLowerCase().replace(/[^a-z0-9%#]/g, '');
  const header = rows[0].map(squash);
  const col = (...names: string[]) => header.findIndex((h) => names.map(squash).includes(h));
  const c = {
    name: col('name'),
    form: col('form'),
    cp: col('cp'),
    atk: col('atk iv', 'attack iv', 'atk'),
    def: col('def iv', 'defense iv', 'def'),
    sta: col('sta iv', 'stamina iv', 'sta', 'hp iv'),
    lvlMin: col('level min', 'level'),
    lvlMax: col('level max'),
    fast: col('quick move', 'fast move'),
    c1: col('charge move', 'charged move', 'charge move 1'),
    c2: col('charge move 2', 'charged move 2'),
    lucky: col('lucky'),
    shadow: col('shadow/purified'),
    nick: col('nickname'),
    fav: col('favorite', 'favourite'),
    pvp: col('marked for pvp use'),
  };
  if (c.name < 0 || c.atk < 0) throw new Error('Could not find "Name" and "Atk IV" columns – is this a Poke Genie export?');

  const added: RosterMon[] = [];
  const skipped: string[] = [];
  for (const r of rows.slice(1)) {
    const rawName = r[c.name]?.trim();
    if (!rawName) continue;
    const formRaw = (c.form >= 0 ? r[c.form] : '').trim();
    const form = FORM_MAP[formRaw.toLowerCase()] ?? formRaw;
    const query = form && !/^normal$/i.test(form) ? (FORM_MAP[formRaw.toLowerCase()] ? `${form} ${rawName}` : `${rawName} (${form})`) : rawName;
    let { species } = resolveName(data, query);
    if (!species) species = resolveName(data, rawName).species;
    if (!species) {
      skipped.push(`${rawName}${formRaw ? ` (${formRaw})` : ''}`);
      continue;
    }
    const ivs: IVs = [Number(r[c.atk]) || 0, Number(r[c.def]) || 0, Number(r[c.sta]) || 0];
    const cp = Number(r[c.cp]);
    const lmin = Number(r[c.lvlMin]);
    const lmax = c.lvlMax >= 0 ? Number(r[c.lvlMax]) : lmin;
    let level = Number.isFinite(lmin) && lmin > 0 ? Math.round(((lmin + (lmax || lmin)) / 2) * 2) / 2 : 20;
    if (cp) level = levelFromCP(data, species, ivs, cp) ?? level;
    const shadowFlag = c.shadow >= 0 ? r[c.shadow]?.trim() : '0';
    const charged = [moveIdByName(data, r[c.c1]), moveIdByName(data, r[c.c2])].filter((x): x is string => !!x);
    added.push({
      uid: newUid(),
      speciesId: species.id.replace(/_shadow$/, ''),
      nickname: c.nick >= 0 ? r[c.nick]?.trim() || undefined : undefined,
      shadow: shadowFlag === '1' || /shadow/i.test(shadowFlag ?? ''),
      purified: shadowFlag === '2' || /purified/i.test(shadowFlag ?? ''),
      lucky: c.lucky >= 0 && truthy(r[c.lucky]),
      ivs,
      level,
      fast: moveIdByName(data, r[c.fast]),
      charged,
      favorite: c.fav >= 0 && truthy(r[c.fav]) ? true : undefined,
      pvpReady: c.pvp >= 0 && truthy(r[c.pvp]) ? true : undefined,
      source: 'pokegenie',
      addedAt: Date.now(),
    });
  }
  return { added, skipped };
}

// Flags the user sets on this site; a Poke Genie re-import must never wipe them.
const USER_FLAGS = ['raidReady', 'pvpReady', 'shiny', 'forTrade', 'dynamax', 'bestBuddy', 'notes', 'nickname'] as const;
const matchKey = (m: RosterMon) => `${m.speciesId}|${m.ivs.join('/')}|${m.shadow ? 's' : m.purified ? 'p' : 'n'}`;

/**
 * Re-importing a fresh Poke Genie export: replaces every previously imported (source=pokegenie)
 * entry, keeps manual entries, and carries user flags + uid over to the matching new row
 * (same species, IVs and shadow state – level can change after power-ups).
 */
export function mergePokeGenie(current: RosterMon[], incoming: RosterMon[]): { roster: RosterMon[]; kept: number; removed: number } {
  const manual = current.filter((m) => m.source !== 'pokegenie');
  const pool = new Map<string, RosterMon[]>();
  for (const m of current.filter((x) => x.source === 'pokegenie')) {
    const k = matchKey(m);
    pool.set(k, [...(pool.get(k) ?? []), m]);
  }
  let kept = 0;
  const merged = incoming.map((m) => {
    const old = pool.get(matchKey(m))?.shift();
    if (!old) return m;
    kept++;
    const carried: Partial<RosterMon> = { uid: old.uid, addedAt: old.addedAt };
    for (const f of USER_FLAGS) if (old[f] !== undefined) (carried as Record<string, unknown>)[f] = old[f];
    return { ...m, ...carried };
  });
  const removed = [...pool.values()].reduce((a, l) => a + l.length, 0);
  return { roster: [...manual, ...merged], kept, removed };
}
