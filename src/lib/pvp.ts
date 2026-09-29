import type { GameData, PvpFormat, RankEntry, Rankings, Species } from './data';
import { effectiveness, pvpIvRank, type PvpIvResult } from './calc';
import { battleSpecies, type RosterMon } from './roster';

/** Number of attacking types that hit at least two team members super-effectively. */
export function sharedWeaknesses(data: GameData, team: Species[]): string[] {
  return data.types.filter((t) => team.filter((s) => effectiveness(data, t, s.types) > 1.01).length >= 2);
}

/** Types that no team member resists (or is neutral to) – i.e. everyone is weak to it. */
export function uncovered(data: GameData, team: Species[]): string[] {
  return data.types.filter((t) => team.every((s) => effectiveness(data, t, s.types) > 1.01));
}

const baseId = (id: string) => id.replace(/_shadow$/, '');

export interface SuggestedTeam {
  lead: RankEntry;
  swap: RankEntry;
  closer: RankEntry;
  score: number;
  weak: string[];
}

/** Algorithmic "meta cores": lead + safe swap + closer from PvPoke role rankings, avoiding stacked weaknesses. */
export function suggestTeams(data: GameData, r: Rankings, count = 6): SuggestedTeam[] {
  const leads = (r.leads ?? r.overall ?? []).slice(0, 12);
  const swaps = (r.switches ?? r.overall ?? []).slice(0, 20);
  const closers = (r.closers ?? r.overall ?? []).slice(0, 20);
  const teams: SuggestedTeam[] = [];
  for (const l of leads)
    for (const s of swaps)
      for (const c of closers) {
        const ids = [baseId(l.id), baseId(s.id), baseId(c.id)];
        if (new Set(ids).size < 3) continue;
        const sp = [l, s, c].map((x) => data.byId.get(x.id)).filter((x): x is Species => !!x);
        if (sp.length < 3) continue;
        const weak = sharedWeaknesses(data, sp);
        const score = l.score + s.score + c.score - weak.length * 6 - uncovered(data, sp).length * 15;
        teams.push({ lead: l, swap: s, closer: c, score, weak });
      }
  teams.sort((a, b) => b.score - a.score);
  // prefer variety: same lead at most twice, any Pokémon in at most three cores
  const out: SuggestedTeam[] = [];
  const leadCount = new Map<string, number>();
  const seen = new Set<string>();
  for (const t of teams) {
    const key = [t.lead.id, t.swap.id, t.closer.id].sort().join('|');
    if (seen.has(key)) continue;
    const members = [t.lead.id, t.swap.id, t.closer.id];
    if ((leadCount.get(`lead:${t.lead.id}`) ?? 0) >= 2 || members.some((id) => (leadCount.get(id) ?? 0) >= 3)) continue;
    seen.add(key);
    leadCount.set(`lead:${t.lead.id}`, (leadCount.get(`lead:${t.lead.id}`) ?? 0) + 1);
    for (const id of members) leadCount.set(id, (leadCount.get(id) ?? 0) + 1);
    out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

export interface MyPvpCandidate {
  mon: RosterMon;
  species: Species;
  rank: RankEntry;
  metaRank: number;
  iv: PvpIvResult;
  value: number;
  movesMatch: boolean;
}

export function myCandidates(data: GameData, roster: RosterMon[], format: PvpFormat, r: Rankings): MyPvpCandidate[] {
  const overall = r.overall ?? [];
  const pos = new Map(overall.map((e, i) => [e.id, i]));
  const out: MyPvpCandidate[] = [];
  for (const m of roster) {
    const sp = battleSpecies(data, m);
    if (!sp) continue;
    const id = m.shadow ? `${m.speciesId}_shadow` : m.speciesId;
    const idx = pos.get(id) ?? pos.get(m.speciesId);
    if (idx === undefined) continue;
    const rank = overall[idx];
    const iv = pvpIvRank(data, data.byId.get(m.speciesId) ?? sp, m.ivs, format.cp, m.bestBuddy ? 51 : 50);
    // Pokémon can't be powered down, so anything already above the cap level is out
    if (!iv || m.level > iv.level) continue;
    // Master League: the Pokémon has to actually be powered up – use current level, not the ceiling
    const levelFactor = format.cp >= 10000 ? Math.min(1, m.level / 50) : 1;
    // Under-leveled for the league (e.g. an unpowered Lv 20 in UL) still counts, but at its potential
    const ivFactor = Math.pow(iv.percent / 100, 3);
    const movesMatch = !!m.fast && rank.moves[0] === m.fast && rank.moves.slice(1).every((c) => m.charged.includes(c));
    const value = rank.score * ivFactor * levelFactor * (m.fast && m.fast !== rank.moves[0] ? 0.93 : 1);
    out.push({ mon: m, species: sp, rank, metaRank: idx + 1, iv, value, movesMatch });
  }
  return out.sort((a, b) => b.value - a.value);
}

export interface MyTeam {
  members: MyPvpCandidate[];
  score: number;
  weak: string[];
}

export function bestTeams(data: GameData, cands: MyPvpCandidate[], count = 3): MyTeam[] {
  const pool = cands.slice(0, 18);
  const teams: MyTeam[] = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const members = [pool[i], pool[j], pool[k]];
        const ids = members.map((m) => m.mon.speciesId);
        if (new Set(ids).size < 3) continue; // GBL forbids duplicate species
        const sp = members.map((m) => m.species);
        const weak = sharedWeaknesses(data, sp);
        const score = members.reduce((a, m) => a + m.value, 0) - weak.length * 6 - uncovered(data, sp).length * 15;
        teams.push({ members, score, weak });
      }
  teams.sort((a, b) => b.score - a.score);
  const out: MyTeam[] = [];
  for (const t of teams) {
    // keep alternatives meaningfully different (share at most one member with an earlier pick)
    if (out.some((o) => o.members.filter((m) => t.members.includes(m)).length > 1)) continue;
    out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

/** Order a team as lead / safe swap / closer using PvPoke's role scores (index 0 lead, 1 closer, 2 switch). */
export function assignRoles<T extends { rank: RankEntry }>(members: T[]): { role: string; m: T }[] {
  const roles = ['Lead', 'Safe swap', 'Closer'];
  const idx = { Lead: 0, 'Safe swap': 2, Closer: 1 } as const;
  let best: { order: T[]; score: number } | null = null;
  const perms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const p of perms) {
    const order = p.map((i) => members[i]);
    const score = order.reduce((a, m, i) => a + (m.rank.scores?.[idx[roles[i] as keyof typeof idx]] ?? m.rank.score), 0);
    if (!best || score > best.score) best = { order, score };
  }
  return best!.order.map((m, i) => ({ role: roles[i], m }));
}
