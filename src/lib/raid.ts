import type { GameData, Species } from './data';
import { bestMoveset, bossStats, cpmAt, effectiveness, isUsableMove, statsAt, type BossSpec, type RaidTier, type Stats } from './calc';
import { battleSpecies, type RosterMon } from './roster';

const EXCLUDED_BOSS_MOVES = new Set(['RETURN', 'FRUSTRATION']);

export function bossMovesets(data: GameData, boss: Species, tier: RaidTier): BossSpec[] {
  const stats = bossStats(boss, tier);
  const fasts = boss.fast.filter((m) => isUsableMove(data, m) && !boss.elite.includes(m));
  const chargeds = boss.charged.filter((m) => isUsableMove(data, m) && !boss.elite.includes(m) && !EXCLUDED_BOSS_MOVES.has(m));
  const specs: BossSpec[] = [];
  for (const f of fasts.length ? fasts : boss.fast) for (const c of chargeds.length ? chargeds : boss.charged) specs.push({ species: boss, stats, fast: f, charged: c });
  return specs;
}

export interface CounterOptions {
  level: number;
  shadows: boolean;
  megas: boolean;
  legendaries: boolean;
  weather: string | null;
}

export interface CounterRow {
  species: Species;
  fast: string;
  charged: string;
  dps: number;
  tdo: number;
  er: number;
  shadow: boolean;
  mega: boolean;
  roster?: RosterMon;
}

const isLegendary = (s: Species) => s.tags.some((t) => t === 'legendary' || t === 'mythical' || t === 'ultrabeast');

function attackerPool(data: GameData, opts: CounterOptions): Species[] {
  return data.pokemon.filter((s) => {
    if (!s.released) return false;
    const shadow = s.tags.includes('shadow');
    const mega = s.tags.includes('mega');
    if (shadow && !opts.shadows) return false;
    if (mega && !opts.megas) return false;
    if (!opts.legendaries && isLegendary(s)) return false;
    // skip very weak species to keep the maths quick
    return s.atk >= 150;
  });
}

/** Generic best counters: every species at the chosen level with 15/15/15 IVs. */
export function rankCounters(data: GameData, bosses: BossSpec[], opts: CounterOptions, limit = 20): CounterRow[] {
  const cpm = cpmAt(data, opts.level);
  const rows: CounterRow[] = [];
  for (const s of attackerPool(data, opts)) {
    const shadow = s.tags.includes('shadow');
    // Megas are capped: mega level ~ same as base, fine to reuse level.
    const stats = statsAt(s, [15, 15, 15], cpm, shadow);
    const best = bestMoveset(data, s, stats, bosses, opts.weather);
    if (best) rows.push({ species: s, ...best, shadow, mega: s.tags.includes('mega') });
  }
  rows.sort((a, b) => b.er - a.er);
  return rows.slice(0, limit);
}

export function rosterStats(data: GameData, m: RosterMon): { species: Species; stats: Stats } | null {
  const s = battleSpecies(data, m);
  if (!s) return null;
  return { species: s, stats: statsAt(s, m.ivs, cpmAt(data, m.level), !!m.shadow) };
}

/** Rank the user's own Pokémon (actual IVs, level and known moves) against a boss. */
export function rankRoster(data: GameData, roster: RosterMon[], bosses: BossSpec[], weather: string | null): CounterRow[] {
  const rows: CounterRow[] = [];
  for (const m of roster) {
    const rs = rosterStats(data, m);
    if (!rs) continue;
    const fixed = { fast: m.fast, charged: m.charged.filter(Boolean) };
    const best = bestMoveset(data, rs.species, rs.stats, bosses, weather, fixed);
    if (best) rows.push({ species: rs.species, ...best, shadow: !!m.shadow, mega: false, roster: m });
  }
  return rows.sort((a, b) => b.er - a.er);
}

// ---------- Max Battles (simplified) ----------

export interface MaxRow {
  species: Species;
  score: number;
  moveType: string;
  fast: string;
  detail: string;
  roster?: RosterMon;
}

/**
 * Max Battle damage comes almost entirely from Max Moves, whose type is the fast move's type
 * (G-Max moves use the Pokémon's signature type). So a strong attacker = high Attack × STAB ×
 * effectiveness of its best fast-move type. Tanks = bulk × resistance to the boss's attacks.
 */
export function maxAttackers(data: GameData, boss: Species, candidates: { species: Species; stats: Stats; fixedFast?: string; roster?: RosterMon; gmax?: boolean }[]): MaxRow[] {
  const rows: MaxRow[] = [];
  for (const c of candidates) {
    let best: MaxRow | null = null;
    const fasts = c.fixedFast ? [c.fixedFast] : c.species.fast;
    for (const f of fasts) {
      const mv = data.moves[f];
      if (!mv) continue;
      const type = c.gmax ? c.species.types[0] : mv.type;
      const mult = (c.species.types.includes(type) ? 1.2 : 1) * effectiveness(data, type, boss.types);
      const score = c.stats.atk * mult;
      if (!best || score > best.score) best = { species: c.species, score, moveType: type, fast: f, detail: `×${mult.toFixed(2)}`, roster: c.roster };
    }
    if (best) rows.push(best);
  }
  return rows.sort((a, b) => b.score - a.score);
}

export function maxTanks(data: GameData, boss: Species, candidates: { species: Species; stats: Stats; roster?: RosterMon }[]): MaxRow[] {
  const bossTypes = [...new Set(boss.charged.map((m) => data.moves[m]?.type).filter(Boolean))] as string[];
  return candidates
    .map((c) => {
      const incoming = bossTypes.length ? bossTypes.map((t) => effectiveness(data, t, c.species.types) * (boss.types.includes(t) ? 1.2 : 1)) : [1];
      const avg = incoming.reduce((a, b) => a + b, 0) / incoming.length;
      const worst = Math.max(...incoming);
      const score = (c.stats.def * c.stats.hp) / (avg * 0.5 + worst * 0.5);
      return { species: c.species, score, moveType: '', fast: '', detail: `takes ×${worst.toFixed(2)} worst-case`, roster: c.roster };
    })
    .sort((a, b) => b.score - a.score);
}
