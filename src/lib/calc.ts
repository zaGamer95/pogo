import type { GameData, Species } from './data';

export type IVs = [number, number, number];

export const SHADOW_ATK = 1.2;
export const SHADOW_DEF = 5 / 6;

export function cpmAt(data: GameData, level: number): number {
  const idx = Math.round((level - 1) * 2);
  return data.cpm[Math.max(0, Math.min(idx, data.cpm.length - 1))];
}

export function calcCP(sp: Pick<Species, 'atk' | 'def' | 'hp'>, ivs: IVs, cpm: number): number {
  const cp = Math.floor(((sp.atk + ivs[0]) * Math.sqrt(sp.def + ivs[1]) * Math.sqrt(sp.hp + ivs[2]) * cpm * cpm) / 10);
  return Math.max(10, cp);
}

export function cpAtLevel(data: GameData, sp: Species, ivs: IVs, level: number): number {
  return calcCP(sp, ivs, cpmAt(data, level));
}

export interface Stats {
  atk: number;
  def: number;
  hp: number;
}

export function statsAt(sp: Species, ivs: IVs, cpm: number, shadow = false): Stats {
  return {
    atk: (sp.atk + ivs[0]) * cpm * (shadow ? SHADOW_ATK : 1),
    def: (sp.def + ivs[1]) * cpm * (shadow ? SHADOW_DEF : 1),
    hp: Math.max(10, Math.floor((sp.hp + ivs[2]) * cpm)),
  };
}

export const LEVELS: number[] = Array.from({ length: 101 }, (_, i) => 1 + i * 0.5);

/** Highest level (≤ maxLevel) whose CP fits under the cap, or null if even level 1 is over. */
export function bestLevelUnderCap(data: GameData, sp: Species, ivs: IVs, cap: number, maxLevel = 50): number | null {
  const maxIdx = Math.round((maxLevel - 1) * 2);
  if (cap >= 10000) return maxLevel;
  let lo = 0;
  let hi = maxIdx;
  if (calcCP(sp, ivs, data.cpm[0]) > cap) return null;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (calcCP(sp, ivs, data.cpm[mid]) <= cap) lo = mid;
    else hi = mid - 1;
  }
  return 1 + lo / 2;
}

export interface PvpIvResult {
  level: number;
  cp: number;
  product: number;
  rank: number; // 1 = best IV spread for this league
  percent: number; // stat product vs rank-1
}

const ivTableCache = new Map<string, number[]>();

/** Stat products for all 4096 IV spreads, sorted descending. Cached per species+cap. */
function ivTable(data: GameData, sp: Species, cap: number, maxLevel: number): number[] {
  const key = `${sp.id}|${cap}|${maxLevel}`;
  let table = ivTableCache.get(key);
  if (!table) {
    table = [];
    for (let a = 0; a <= 15; a++)
      for (let d = 0; d <= 15; d++)
        for (let s = 0; s <= 15; s++) {
          const ivs: IVs = [a, d, s];
          const lvl = bestLevelUnderCap(data, sp, ivs, cap, maxLevel);
          if (lvl === null) continue;
          const st = statsAt(sp, ivs, cpmAt(data, lvl));
          table.push(st.atk * st.def * st.hp);
        }
    table.sort((x, y) => y - x);
    ivTableCache.set(key, table);
  }
  return table;
}

export function pvpIvRank(data: GameData, sp: Species, ivs: IVs, cap: number, maxLevel = 50): PvpIvResult | null {
  const lvl = bestLevelUnderCap(data, sp, ivs, cap, maxLevel);
  if (lvl === null) return null;
  const st = statsAt(sp, ivs, cpmAt(data, lvl));
  const product = st.atk * st.def * st.hp;
  const table = ivTable(data, sp, cap, maxLevel);
  let rank = 1;
  // binary search for number of spreads strictly better
  let lo = 0;
  let hi = table.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid] > product + 1e-9) lo = mid + 1;
    else hi = mid;
  }
  rank = lo + 1;
  return { level: lvl, cp: cpAtLevel(data, sp, ivs, lvl), product, rank, percent: (product / table[0]) * 100 };
}

export function levelFromCP(data: GameData, sp: Species, ivs: IVs, cp: number): number | null {
  for (const lvl of LEVELS) if (cpAtLevel(data, sp, ivs, lvl) === cp) return lvl;
  return null;
}

// ---------- Type effectiveness ----------

export function effectiveness(data: GameData, moveType: string, defTypes: string[]): number {
  return defTypes.reduce((m, t) => m * (data.chart[moveType]?.[t] ?? 1), 1);
}

export function weaknesses(data: GameData, defTypes: string[]): { type: string; mult: number }[] {
  return data.types
    .map((t) => ({ type: t, mult: effectiveness(data, t, defTypes) }))
    .filter((x) => x.mult > 1.01)
    .sort((a, b) => b.mult - a.mult);
}

export function resistances(data: GameData, defTypes: string[]): { type: string; mult: number }[] {
  return data.types
    .map((t) => ({ type: t, mult: effectiveness(data, t, defTypes) }))
    .filter((x) => x.mult < 0.99)
    .sort((a, b) => a.mult - b.mult);
}

// ---------- Raid simulation (GamePress-style DPS/TDO estimator) ----------

export interface RaidTier {
  cpm: number;
  hp: number;
  label: string;
}

export function raidTier(tier: string): RaidTier {
  const t = tier.toLowerCase();
  if (t.includes('mega') && t.includes('legendary')) return { cpm: 0.79, hp: 22500, label: 'Mega Legendary' };
  if (t.includes('mega') || t.includes('primal')) return { cpm: 0.79, hp: 9000, label: 'Mega' };
  if (t.includes('6') || t.includes('elite')) return { cpm: 0.79, hp: 22500, label: 'Elite' };
  if (t.includes('5')) return { cpm: 0.79, hp: 15000, label: 'Tier 5' };
  if (t.includes('4')) return { cpm: 0.79, hp: 7500, label: 'Tier 4' };
  if (t.includes('3')) return { cpm: 0.73, hp: 3600, label: 'Tier 3' };
  return { cpm: 0.5974, hp: 600, label: 'Tier 1' };
}

export interface Attacker {
  species: Species;
  stats: Stats;
  fast: string;
  charged: string;
}

export interface BossSpec {
  species: Species;
  stats: Stats; // defense/attack as a raid boss
  fast: string;
  charged: string;
}

export function bossStats(boss: Species, tier: RaidTier): Stats {
  return { atk: (boss.atk + 15) * tier.cpm, def: (boss.def + 15) * tier.cpm, hp: tier.hp };
}

function damage(power: number, atk: number, def: number, mult: number): number {
  return Math.floor(0.5 * power * (atk / def) * mult) + 1;
}

function moveMult(data: GameData, moveType: string, userTypes: string[], targetTypes: string[], weather: string | null): number {
  const stab = userTypes.includes(moveType) ? 1.2 : 1;
  const wb = weather && WEATHER_TYPES[weather]?.includes(moveType) ? 1.2 : 1;
  return stab * wb * effectiveness(data, moveType, targetTypes);
}

export const WEATHER_TYPES: Record<string, string[]> = {
  sunny: ['fire', 'grass', 'ground'],
  rainy: ['water', 'electric', 'bug'],
  'partly cloudy': ['normal', 'rock'],
  cloudy: ['fairy', 'fighting', 'poison'],
  windy: ['dragon', 'flying', 'psychic'],
  snow: ['ice', 'steel'],
  fog: ['dark', 'ghost'],
};

export interface RaidResult {
  dps: number;
  tdo: number;
  er: number; // (DPS^3 * TDO)^(1/4) – single number used for ranking
}

/** Estimate how an attacker performs against one boss moveset. */
export function simulate(data: GameData, a: Attacker, b: BossSpec, weather: string | null = null): RaidResult | null {
  const fm = data.moves[a.fast]?.pve;
  const cm = data.moves[a.charged]?.pve;
  const bfm = data.moves[b.fast]?.pve;
  const bcm = data.moves[b.charged]?.pve;
  if (!fm || !cm || !bfm || !bcm) return null;
  const fType = data.moves[a.fast].type;
  const cType = data.moves[a.charged].type;

  const fDmg = damage(fm.power, a.stats.atk, b.stats.def, moveMult(data, fType, a.species.types, b.species.types, weather));
  const cDmg = damage(cm.power, a.stats.atk, b.stats.def, moveMult(data, cType, a.species.types, b.species.types, weather));
  const FDPS = fDmg / fm.dur;
  const FEPS = fm.energy / fm.dur;
  const CDPS = cDmg / cm.dur;
  const CEPS = cm.energy / cm.dur;

  // Incoming boss damage per second (bosses wait ~2s between attacks)
  const bf = damage(bfm.power, b.stats.atk, a.stats.def, moveMult(data, data.moves[b.fast].type, b.species.types, a.species.types, weather));
  const bc = damage(bcm.power, b.stats.atk, a.stats.def, moveMult(data, data.moves[b.charged].type, b.species.types, a.species.types, weather));
  const bFDPS = bf / (bfm.dur + 2);
  const bFEPS = bfm.energy / (bfm.dur + 2);
  const bCDPS = bc / (bcm.dur + 2);
  const bCEPS = bcm.energy / (bcm.dur + 2);
  const y = (bFDPS * bCEPS + bCDPS * bFEPS) / (bCEPS + bFEPS || 1);

  const x = 0.5 * cm.energy + 0.5 * fm.energy;
  const dps0 = (FDPS * CEPS + CDPS * FEPS) / (CEPS + FEPS);
  let dps = dps0 + ((CDPS - FDPS) / (CEPS + FEPS)) * (0.5 - x / a.stats.hp) * y;
  dps = Math.max(dps, FDPS);
  const tdo = (dps * a.stats.hp) / y;
  return { dps, tdo, er: Math.pow(dps * dps * dps * tdo, 0.25) };
}

export function isUsableMove(data: GameData, id: string): boolean {
  return !!data.moves[id]?.pve;
}

/** Best moveset for an attacker vs a set of boss movesets (averaging the score). */
export function bestMoveset(
  data: GameData,
  species: Species,
  stats: Stats,
  bosses: BossSpec[],
  weather: string | null,
  fixed?: { fast?: string; charged?: string[] },
): { fast: string; charged: string; er: number; dps: number; tdo: number } | null {
  const fasts = fixed?.fast ? [fixed.fast] : species.fast;
  const chargeds = fixed?.charged?.length ? fixed.charged : species.charged;
  let best: { fast: string; charged: string; er: number; dps: number; tdo: number } | null = null;
  for (const f of fasts) {
    if (!isUsableMove(data, f)) continue;
    for (const c of chargeds) {
      if (!isUsableMove(data, c)) continue;
      let er = 0;
      let dps = 0;
      let tdo = 0;
      let n = 0;
      for (const b of bosses) {
        const r = simulate(data, { species, stats, fast: f, charged: c }, b, weather);
        if (!r) continue;
        er += r.er;
        dps += r.dps;
        tdo += r.tdo;
        n++;
      }
      if (!n) continue;
      er /= n;
      if (!best || er > best.er) best = { fast: f, charged: c, er, dps: dps / n, tdo: tdo / n };
    }
  }
  return best;
}
