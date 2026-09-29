// Pulls public Pokémon GO data sources and writes compact JSON into public/data.
// Run with `npm run data`. Also runs daily in GitHub Actions.
//
// Sources:
//   - PokeMiners game master  (PvE move stats, CP multipliers, type chart, Dynamax list)
//   - PvPoke game master      (species list, PvP move stats, formats)
//   - PvPoke rankings         (league meta)
//   - ScrapedDuck (LeekDuck)  (events calendar, current raid bosses)

import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../public/data');
const POKEMINERS = 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json';
const PVPOKE = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data';
const SCRAPEDDUCK = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data';
const LEEKDUCK_SHINY = 'https://leekduck.com/shiny';
const OFFICIAL_FEED = 'https://pokemongolive.com/feed';

const TYPES = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'];

async function getJson(url, { optional = false } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 404 && optional) return null;
    if (attempt === 2) throw new Error(`${res.status} fetching ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
}

async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal pogo companion)' } });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

/** Tier-0 source: the official news RSS feed. Titles + links only. */
function parseRss(xml) {
  const decode = (t) => t.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
    title: decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
    link: decode(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ''),
    date: new Date(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '').toISOString(),
  }));
}

async function write(name, data) {
  const file = path.join(OUT, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
  console.log(`  wrote ${name} (${(JSON.stringify(data).length / 1024).toFixed(0)} KB)`);
}

const typeName = (t) => t?.replace('POKEMON_TYPE_', '').toLowerCase();

async function main() {
  if (process.argv.includes('--if-missing')) {
    try {
      await access(path.join(OUT, 'meta.json'));
      console.log('Data already present – run `npm run data` to refresh.');
      return;
    } catch {
      /* no data yet – fetch it */
    }
  }
  console.log('Fetching sources…');
  const [gm, pv, events, raids, shinyRaw, namesRaw, feed] = await Promise.all([
    getJson(POKEMINERS),
    getJson(`${PVPOKE}/gamemaster.min.json`),
    getJson(`${SCRAPEDDUCK}/events.min.json`),
    getJson(`${SCRAPEDDUCK}/raids.min.json`),
    getJson(`${LEEKDUCK_SHINY}/pms.json`).catch((e) => (console.warn('  shiny list unavailable:', e.message), [])),
    getJson(`${LEEKDUCK_SHINY}/name.json`).catch(() => ({})),
    getText(OFFICIAL_FEED).catch((e) => (console.warn('  official feed unavailable:', e.message), '')),
  ]);

  // ---- Released shinies (LeekDuck shiny checklist) ----
  // aa_fn looks like "pm3", "pm3.fMEGA", "pm1.fFALL_2019", "pm19.fALOLA"
  const shinies = shinyRaw.map((s) => {
    const form = s.aa_fn?.split('.f')[1] ?? null;
    return { dex: s.dex, form: form && form.replace(/^_/, ''), released: s.released_date?.replace(/\//g, '-') ?? null };
  });
  // Dex number -> localized names (en + ko), useful for searching in either language
  const names = Object.fromEntries(Object.entries(namesRaw).map(([dex, n]) => [dex, { en: n.en, ko: n.ko }]));
  const news = feed ? parseRss(feed) : [];

  // ---- CP multipliers (levels 1 … 55 in 0.5 steps) ----
  const levelSettings = gm.find((t) => t.templateId === 'PLAYER_LEVEL_SETTINGS').data.playerLevel;
  const whole = levelSettings.cpMultiplier;
  const cpm = [];
  for (let i = 0; i < Math.min(whole.length, 55); i++) {
    cpm.push(whole[i]);
    if (i + 1 < whole.length) cpm.push(Math.sqrt((whole[i] ** 2 + whole[i + 1] ** 2) / 2));
  }

  // ---- Type chart ----
  const chart = {};
  for (const t of gm) {
    const te = t.data.typeEffective;
    if (!te) continue;
    const atk = typeName(te.attackType);
    chart[atk] = Object.fromEntries(TYPES.map((d, i) => [d, te.attackScalar[i]]));
  }

  // ---- PvE moves from PokeMiners, keyed by move id without the _FAST suffix ----
  const pve = {};
  for (const t of gm) {
    const m = t.data.moveSettings;
    if (!m) continue;
    const idFromTemplate = t.templateId.replace(/^V\d+_MOVE_/, '');
    const id = idFromTemplate.replace(/_FAST$/, '');
    pve[id] = {
      power: m.power ?? 0,
      dur: (m.durationMs ?? 1000) / 1000,
      energy: Math.abs(m.energyDelta ?? 0),
      type: typeName(m.pokemonType),
    };
  }
  // Hidden Power is one PvE move whose type varies; PvPoke splits it per type.
  const hp = pve.HIDDEN_POWER;

  const moves = {};
  for (const mv of pv.moves) {
    const fast = mv.energyGain > 0 || mv.moveId.endsWith('_FAST');
    let pveStats = pve[mv.moveId] ?? null;
    if (!pveStats && hp && mv.moveId.startsWith('HIDDEN_POWER_')) pveStats = { ...hp, type: mv.type };
    moves[mv.moveId] = {
      name: mv.name,
      type: mv.type,
      fast,
      pvp: fast
        ? { power: mv.power, energy: mv.energyGain, turns: mv.turns ?? mv.cooldown / 500 }
        : { power: mv.power, energy: mv.energy, buffs: mv.buffs, buffTarget: mv.buffTarget, chance: mv.buffApplyChance },
      pve: pveStats && { power: pveStats.power, dur: pveStats.dur, energy: pveStats.energy },
    };
  }

  // ---- Dynamax / Gigantamax availability ----
  const scaling = gm.find((t) => t.templateId === 'BREAD_POKEMON_SCALING_SETTINGS')?.data.breadPokemonScalingSettings;
  const dmax = new Set();
  const gmax = new Set();
  const normForm = (f) => f.toLowerCase()
    .replace(/_normal$/, '')
    .replace(/_alola$/, '_alolan')
    .replace(/_galarian$/, '_galarian')
    .replace(/_hisuian$/, '_hisuian');
  for (const p of scaling?.visualSettings ?? []) {
    for (const f of p.pokemonFormData ?? [{ pokemonForm: p.pokemonId }]) {
      const id = normForm(f.pokemonForm ?? p.pokemonId);
      for (const v of f.visualData ?? []) {
        if (v.breadMode === 'BREAD_MODE') dmax.add(id);
        if (v.breadMode === 'BREAD_DOUGH_MODE') gmax.add(id);
      }
    }
  }

  // ---- Species ----
  const pokemon = pv.pokemon
    .filter((p) => !p.tags?.includes('duplicate'))
    .map((p) => ({
      id: p.speciesId,
      name: p.speciesName,
      dex: p.dex,
      types: p.types.filter((t) => t !== 'none'),
      atk: p.baseStats.atk,
      def: p.baseStats.def,
      hp: p.baseStats.hp,
      fast: p.fastMoves,
      charged: p.chargedMoves,
      elite: p.eliteMoves ?? [],
      tags: p.tags ?? [],
      family: p.family?.id,
      released: p.released !== false,
      dmax: dmax.has(p.speciesId) || undefined,
      gmax: gmax.has(p.speciesId) || undefined,
    }));

  // ---- PvP formats + rankings ----
  const formatList = [
    { title: 'Great League', cup: 'all', cp: 1500 },
    { title: 'Ultra League', cup: 'all', cp: 2500 },
    { title: 'Master League', cup: 'all', cp: 10000 },
    ...pv.formats
      .filter((f) => !f.hideRankings && f.cup !== 'custom')
      .map((f) => ({ title: f.title, cup: f.cup, cp: f.cp, rules: f.rules })),
    // Cups PvPoke keeps rankings for but doesn't list as a format (older / rotating GBL cups).
    ...pv.cups
      .filter((c) => !['all', 'custom'].includes(c.name))
      .map((c) => ({ title: c.title ?? c.name, cup: c.name, cp: 1500, extra: true })),
  ];
  const seen = new Set();
  const formats = [];
  const categories = ['overall', 'leads', 'closers', 'switches', 'attackers', 'chargers'];
  const compact = (r, full) => {
    const out = { id: r.speciesId, score: r.score, moves: r.moveset };
    if (full) {
      out.rating = r.rating;
      out.scores = r.scores;
      out.wins = r.matchups?.map((m) => m.opponent);
      out.losses = r.counters?.map((m) => m.opponent);
      out.product = r.stats?.product;
    }
    return out;
  };
  console.log(`Fetching rankings for ${formatList.length} formats…`);
  for (const f of formatList) {
    const key = `${f.cup}-${f.cp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rankings = {};
    await Promise.all(categories.map(async (cat) => {
      const data = await getJson(`${PVPOKE}/rankings/${f.cup}/${cat}/rankings-${f.cp}.json`, { optional: true });
      if (data) rankings[cat] = data.slice(0, cat === 'overall' ? 200 : 60).map((r) => compact(r, cat === 'overall'));
    }));
    if (!rankings.overall) continue;
    const { extra, ...info } = f;
    formats.push(info);
    formats.at(-1).key = key;
    await write(`pvp/${key}.json`, rankings);
  }

  await Promise.all([
    write('pokemon.json', pokemon),
    write('moves.json', moves),
    write('types.json', { types: TYPES, chart }),
    write('cpm.json', cpm),
    write('events.json', events),
    write('raids.json', raids),
    write('pvp/formats.json', formats),
    write('shinies.json', shinies),
    write('names.json', names),
    write('news.json', news),
    write('meta.json', {
      updated: new Date().toISOString(),
      pvpokeUpdated: pv.timestamp,
      counts: { shinies: shinies.length, news: news.length, pokemon: pokemon.length, moves: Object.keys(moves).length, formats: formats.length, events: events.length, raids: raids.length, dmax: dmax.size, gmax: gmax.size },
    }),
  ]);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
