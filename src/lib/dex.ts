import { useCallback, useEffect, useState } from 'react';
import type { GameData, Species } from './data';
import type { RosterMon } from './roster';

export type DexFlag = 'caught' | 'shiny' | 'lucky' | 'want' | 'wantShiny';
export type DexState = Record<DexFlag, number[]>;

export const DEX_FLAGS: { flag: DexFlag; label: string }[] = [
  { flag: 'caught', label: 'Caught' },
  { flag: 'shiny', label: 'Shiny caught' },
  { flag: 'lucky', label: 'Lucky' },
  { flag: 'want', label: 'Want' },
  { flag: 'wantShiny', label: 'Want shiny' },
];

export const GENERATIONS: { gen: number; from: number; to: number; region: string }[] = [
  { gen: 1, from: 1, to: 151, region: 'Kanto' },
  { gen: 2, from: 152, to: 251, region: 'Johto' },
  { gen: 3, from: 252, to: 386, region: 'Hoenn' },
  { gen: 4, from: 387, to: 493, region: 'Sinnoh' },
  { gen: 5, from: 494, to: 649, region: 'Unova' },
  { gen: 6, from: 650, to: 721, region: 'Kalos' },
  { gen: 7, from: 722, to: 809, region: 'Alola' },
  { gen: 8, from: 810, to: 905, region: 'Galar / Hisui' },
  { gen: 9, from: 906, to: 1025, region: 'Paldea' },
];

const KEY = 'pogo-dex-v1';
const empty = (): DexState => ({ caught: [], shiny: [], lucky: [], want: [], wantShiny: [] });

function read(): DexState {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return empty();
  }
}

let current = read();
const listeners = new Set<(s: DexState) => void>();

export function useDex() {
  const [state, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    return () => void listeners.delete(setState);
  }, []);
  const save = useCallback((next: DexState) => {
    current = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l(next));
  }, []);
  const sets = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, new Set(v)])) as Record<DexFlag, Set<number>>;
  return {
    state,
    sets,
    toggle: (flag: DexFlag, dex: number) => {
      const s = new Set(current[flag]);
      if (s.has(dex)) s.delete(dex);
      else s.add(dex);
      save({ ...current, [flag]: [...s].sort((a, b) => a - b) });
    },
    add: (flag: DexFlag, dexes: number[], replace = false) => {
      const s = new Set(replace ? [] : current[flag]);
      dexes.forEach((d) => s.add(d));
      save({ ...current, [flag]: [...s].sort((a, b) => a - b) });
    },
    replaceAll: (next: DexState) => save({ ...empty(), ...next }),
  };
}

/** "1-151, 155 200" → [1..151, 155, 200] */
export function parseDexList(text: string, max = 1025): number[] {
  const out: number[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const m = part.match(/^#?(\d+)(?:-#?(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.min(Math.max(a, b), max); i++) if (i > 0) out.push(i);
  }
  return out;
}

/** Compact "1-5, 7, 9-12" form, handy for backups and sharing. */
export function formatDexList(dexes: number[]): string {
  const sorted = [...new Set(dexes)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return parts.join(', ');
}

export interface DexEntry {
  dex: number;
  name: string;
  ko?: string;
  species: Species;
  legendary: boolean;
  mythical: boolean;
  untradeable: boolean;
  shinyReleased: string | null; // release date of the base-form shiny
}

let dexCache: DexEntry[] | null = null;

/** One entry per released national dex number (base form). */
export function dexEntries(data: GameData): DexEntry[] {
  if (dexCache) return dexCache;
  const byDex = new Map<number, Species[]>();
  for (const p of data.pokemon) {
    if (!p.released || p.tags.includes('shadow') || p.tags.includes('mega')) continue;
    byDex.set(p.dex, [...(byDex.get(p.dex) ?? []), p]);
  }
  const shinyBase = new Map<number, string | null>();
  for (const s of data.shinies) if (!s.form && !shinyBase.has(s.dex)) shinyBase.set(s.dex, s.released);
  dexCache = [...byDex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dex, list]) => {
      const base = list.find((p) => !p.id.includes('_')) ?? list.sort((a, b) => a.id.length - b.id.length)[0];
      const n = data.names[String(dex)];
      return {
        dex,
        name: n?.en ?? base.name.replace(/\s*\(.*\)$/, ''),
        ko: n?.ko,
        species: base,
        legendary: base.tags.includes('legendary') || base.tags.includes('ultrabeast'),
        mythical: base.tags.includes('mythical'),
        untradeable: base.tags.includes('untradeable') || base.tags.includes('mythical'),
        shinyReleased: shinyBase.has(dex) ? shinyBase.get(dex) ?? 'yes' : null,
      };
    });
  return dexCache;
}

export interface SpareMon {
  mon: RosterMon;
  species: Species;
  reason: string;
}

/**
 * Trade candidates from the roster. Rules of thumb:
 *  - Shadow Pokémon can't be traded, and a Pokémon that's already been traded (all luckies) can't be traded again.
 *  - Explicit "For trade" flags always count.
 *  - Duplicates: keep the best copy (IV % / favorite / best buddy / shiny), offer the rest.
 */
export function spares(data: GameData, roster: RosterMon[]): SpareMon[] {
  const out: SpareMon[] = [];
  const tradeable = (m: RosterMon, sp: Species) => !m.shadow && !m.lucky && !sp.tags.includes('untradeable') && !sp.tags.includes('mythical');
  const groups = new Map<string, RosterMon[]>();
  for (const m of roster) {
    const sp = data.byId.get(m.speciesId);
    if (!sp) continue;
    if (m.forTrade) {
      out.push({ mon: m, species: sp, reason: tradeable(m, sp) ? 'Marked for trade' : 'Marked for trade (⚠ not tradeable)' });
      continue;
    }
    if (!tradeable(m, sp) || m.favorite || m.bestBuddy || m.raidReady || m.pvpReady) continue;
    const key = `${m.speciesId}|${m.shiny ? 's' : ''}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const keepScore = (m: RosterMon) => m.ivs[0] + m.ivs[1] + m.ivs[2] + (m.purified ? 1 : 0);
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const sp = data.byId.get(list[0].speciesId)!;
    const sorted = [...list].sort((a, b) => keepScore(b) - keepScore(a));
    const regional = sp.tags.includes('regional');
    for (const m of sorted.slice(1)) {
      out.push({ mon: m, species: sp, reason: `${m.shiny ? 'Spare shiny' : regional ? 'Spare regional' : 'Duplicate'} (${list.length} owned)` });
    }
  }
  const weight = (s: SpareMon) => (s.reason.startsWith('Marked') ? 0 : s.mon.shiny ? 1 : s.reason.includes('regional') ? 2 : s.species.tags.includes('legendary') ? 3 : 4);
  return out.sort((a, b) => weight(a) - weight(b) || a.species.dex - b.species.dex);
}
