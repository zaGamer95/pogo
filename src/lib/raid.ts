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

export type MaxMode = 'dmax' | 'gmax' | 'special';

/**
 * Max Move base power at Max Move level 1/2/3. Dynamax Max Attack 250/300/350, G-Max 350/400/450;
 * Behemoth Blade/Bash use the Dynamax values, Dynamax Cannon the G-Max ones (Bulbapedia "Max Move (GO)",
 * matching Dittobase's modelled damage: G-Max Duraludon ÷ Dynamax Duraludon ≈ 450/350).
 */
export const MAX_POWER = { max: [250, 300, 350], gmax: [350, 400, 450] } as const;

/**
 * Fixed Max Moves. A Gigantamax Pokémon always uses its signature G-Max Move (type fixed, whatever its
 * fast move is); Eternatus and Crowned Zacian/Zamazenta use their own move. Types from the game master's
 * VN_BM_0xx move templates (vfx gmax_wildfire = Fire, …); species ↔ move from the main-series games.
 */
export const FIXED_MAX_MOVES: Record<string, { name: string; type: string; power: 'max' | 'gmax' }> = {
  venusaur: { name: 'G-Max Vine Lash', type: 'grass', power: 'gmax' },
  charizard: { name: 'G-Max Wildfire', type: 'fire', power: 'gmax' },
  blastoise: { name: 'G-Max Cannonade', type: 'water', power: 'gmax' },
  butterfree: { name: 'G-Max Befuddle', type: 'bug', power: 'gmax' },
  pikachu: { name: 'G-Max Volt Crash', type: 'electric', power: 'gmax' },
  meowth: { name: 'G-Max Gold Rush', type: 'normal', power: 'gmax' },
  machamp: { name: 'G-Max Chi Strike', type: 'fighting', power: 'gmax' },
  gengar: { name: 'G-Max Terror', type: 'ghost', power: 'gmax' },
  kingler: { name: 'G-Max Foam Burst', type: 'water', power: 'gmax' },
  lapras: { name: 'G-Max Resonance', type: 'ice', power: 'gmax' },
  eevee: { name: 'G-Max Cuddle', type: 'normal', power: 'gmax' },
  snorlax: { name: 'G-Max Replenish', type: 'normal', power: 'gmax' },
  garbodor: { name: 'G-Max Malodor', type: 'poison', power: 'gmax' },
  melmetal: { name: 'G-Max Meltdown', type: 'steel', power: 'gmax' },
  rillaboom: { name: 'G-Max Drum Solo', type: 'grass', power: 'gmax' },
  cinderace: { name: 'G-Max Fireball', type: 'fire', power: 'gmax' },
  inteleon: { name: 'G-Max Hydrosnipe', type: 'water', power: 'gmax' },
  corviknight: { name: 'G-Max Wind Rage', type: 'flying', power: 'gmax' },
  orbeetle: { name: 'G-Max Gravitas', type: 'psychic', power: 'gmax' },
  drednaw: { name: 'G-Max Stonesurge', type: 'water', power: 'gmax' },
  coalossal: { name: 'G-Max Volcalith', type: 'rock', power: 'gmax' },
  flapple: { name: 'G-Max Tartness', type: 'grass', power: 'gmax' },
  appletun: { name: 'G-Max Sweetness', type: 'grass', power: 'gmax' },
  sandaconda: { name: 'G-Max Sandblast', type: 'ground', power: 'gmax' },
  toxtricity: { name: 'G-Max Stun Shock', type: 'electric', power: 'gmax' },
  centiskorch: { name: 'G-Max Centiferno', type: 'fire', power: 'gmax' },
  hatterene: { name: 'G-Max Smite', type: 'fairy', power: 'gmax' },
  grimmsnarl: { name: 'G-Max Snooze', type: 'dark', power: 'gmax' },
  alcremie: { name: 'G-Max Finale', type: 'fairy', power: 'gmax' },
  copperajah: { name: 'G-Max Steelsurge', type: 'steel', power: 'gmax' },
  duraludon: { name: 'G-Max Depletion', type: 'dragon', power: 'gmax' },
  urshifu_single_strike: { name: 'G-Max One Blow', type: 'dark', power: 'gmax' },
  urshifu_rapid_strike: { name: 'G-Max Rapid Flow', type: 'water', power: 'gmax' },
  // special (no Dynamax form needed)
  zacian_crowned_sword: { name: 'Behemoth Blade', type: 'steel', power: 'max' },
  zamazenta_crowned_shield: { name: 'Behemoth Bash', type: 'steel', power: 'max' },
  eternatus: { name: 'Dynamax Cannon', type: 'dragon', power: 'gmax' },
};

/** Dynamax Max Attack per type (game master BREAD_MOVE_MAPPING_SETTINGS → VN_BM_001…018 vfx names). */
export const MAX_ATTACK_BY_TYPE: Record<string, string> = {
  fire: 'Max Flare', bug: 'Max Flutterby', electric: 'Max Lightning', normal: 'Max Strike', fighting: 'Max Knuckle',
  ghost: 'Max Phantasm', ice: 'Max Hailstorm', poison: 'Max Ooze', water: 'Max Geyser', flying: 'Max Airstream',
  fairy: 'Max Starfall', dragon: 'Max Wyrmwind', psychic: 'Max Mindstorm', rock: 'Max Rockfall', ground: 'Max Quake',
  dark: 'Max Darkness', grass: 'Max Overgrowth', steel: 'Max Steelspike',
};

/** "pikachu_rock_star" → pikachu, "toxtricity_amped" → toxtricity (same G-Max Move for every form). */
export function fixedMaxMove(sp: Species) {
  return FIXED_MAX_MOVES[sp.id] ?? FIXED_MAX_MOVES[sp.id.split('_')[0]] ?? null;
}

/** Which ways a species can fight in Max Battles (game-master flags). */
export function maxModes(sp: Species): MaxMode[] {
  if (sp.maxSpecial) return fixedMaxMove(sp) ? ['special'] : [];
  return [...(sp.dmax ? (['dmax'] as const) : []), ...(sp.gmax && fixedMaxMove(sp) ? (['gmax'] as const) : [])];
}

export interface MaxRow {
  species: Species;
  score: number;
  mode: MaxMode | null;
  moveType: string;
  /** Fast move (for Dynamax this sets the Max Move type) */
  fast: string;
  /** Max Move used, English game name (render with <MaxMoveName>) */
  maxMove?: string;
  detail: string;
  roster?: RosterMon;
}

export interface MaxCandidate {
  species: Species;
  stats: Stats;
  mode: MaxMode;
  fixedFast?: string;
  roster?: RosterMon;
}

/**
 * Max Battle damage comes almost entirely from Max Moves (level 3 assumed):
 * - Dynamax: Max Attack, type = the fast move's type, power 350.
 * - Gigantamax: the signature G-Max Move, type fixed whatever the fast move, power 450.
 * - Eternatus / Crowned Zacian / Zamazenta: Dynamax Cannon (Dragon, 450) / Behemoth Blade, Bash (Steel, 350).
 * Score = Attack × power × STAB × type effectiveness (relative; no simulation).
 */
export function maxAttackers(data: GameData, boss: Species, candidates: MaxCandidate[]): MaxRow[] {
  const rows: MaxRow[] = [];
  for (const c of candidates) {
    let best: MaxRow | null = null;
    const fixed = c.mode === 'dmax' ? null : fixedMaxMove(c.species);
    const fasts = c.fixedFast ? [c.fixedFast] : c.species.fast;
    for (const f of fasts) {
      const mv = data.moves[f];
      if (!mv && !fixed) continue;
      const type = fixed ? fixed.type : mv!.type;
      const power = MAX_POWER[fixed?.power ?? 'max'][2];
      const mult = (c.species.types.includes(type) ? 1.2 : 1) * effectiveness(data, type, boss.types);
      const score = c.stats.atk * power * mult;
      if (!best || score > best.score)
        best = { species: c.species, score, mode: c.mode, moveType: type, fast: f, maxMove: fixed?.name ?? MAX_ATTACK_BY_TYPE[type], detail: `×${mult.toFixed(2)}`, roster: c.roster };
      if (fixed) break; // the fast move doesn't change a fixed Max Move
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
      return { species: c.species, score, mode: null, moveType: '', fast: '', detail: `takes ×${worst.toFixed(2)} worst-case`, roster: c.roster };
    })
    .sort((a, b) => b.score - a.score);
}
