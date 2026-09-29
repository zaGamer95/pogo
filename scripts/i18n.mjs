// Builds Korean / English / Japanese names for Pokémon, moves, types, weather and GBL leagues
// from the official in-game text (PokeMiners pogo_assets i18n files).
//
// Output:
//   data/i18n/*.csv          committed, human-readable reference (UTF-8 with BOM so Excel shows 한글/日本語)
//   data/i18n/overrides.csv  hand corrections — always wins (kind,id,ko,en,ja)
//   public/data/i18n.json    compact lookup used by the site

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const TEXTS = 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON';
const CSV_DIR = path.resolve(import.meta.dirname, '../data/i18n');

async function loadText(lang) {
  const res = await fetch(`${TEXTS}/i18n_${lang}.json`);
  if (!res.ok) throw new Error(`${res.status} fetching i18n_${lang}`);
  const { data } = await res.json();
  const out = new Map();
  for (let i = 0; i < data.length; i += 2) out.set(data[i], String(data[i + 1]).replace(/\s*\n\s*/g, ''));
  return out;
}

// Region labels as the game writes them: 블레이범(히스이의 모습) / バクフーン（ヒスイのすがた）
const REGION = {
  Alolan: { ko: '알로라의 모습', ja: 'アローラのすがた' },
  Galarian: { ko: '가라르의 모습', ja: 'ガラルのすがた' },
  Hisuian: { ko: '히스이의 모습', ja: 'ヒスイのすがた' },
  Paldean: { ko: '팔데아의 모습', ja: 'パルデアのすがた' },
};
const FIXED = {
  Shadow: { ko: '그림자', ja: 'シャドウ' }, // in-game filter labels
  Purified: { ko: '정화', ja: 'ライト' },
  Male: { ko: '수컷', ja: 'オス' },
  Female: { ko: '암컷', ja: 'メス' },
};
const MEGA_SUFFIX = { Mega: 1, 'Mega X': 2, 'Mega Y': 3, Primal: 4 };

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

async function readOverrides() {
  try {
    const rows = parseCsv(await readFile(path.join(CSV_DIR, 'overrides.csv'), 'utf8'));
    const [head, ...body] = rows;
    const idx = (k) => head.indexOf(k);
    return body
      .filter((r) => !r[idx('kind')]?.startsWith('#'))
      .map((r) => ({ kind: r[idx('kind')], id: r[idx('id')], ko: r[idx('ko')], en: r[idx('en')], ja: r[idx('ja')] }));
  } catch {
    return [];
  }
}

// Fallback for moves the game-text file doesn't have yet: PokeAPI main-series names (language ids: ko=3, ja=11, en=9)
async function pokeapiMoveNames() {
  const get = async (f) => (await fetch(`https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/${f}`)).text();
  const [movesCsv, namesCsv] = await Promise.all([get('moves.csv'), get('move_names.csv')]);
  const ident = new Map(parseCsv(movesCsv).slice(1).map((r) => [r[0], r[1]]));
  const out = {};
  for (const [id, lang, name] of parseCsv(namesCsv).slice(1)) {
    const key = ident.get(id)?.toUpperCase().replace(/-/g, '_');
    if (!key) continue;
    out[key] ??= {};
    if (lang === '3') out[key].ko = name;
    if (lang === '11') out[key].ja = name;
  }
  return out;
}

async function pokeapiSpeciesNames() {
  const csv = await (await fetch('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv')).text();
  const out = {};
  for (const [dex, lang, name] of parseCsv(csv).slice(1)) {
    out[dex] ??= {};
    if (lang === '3') out[dex].ko = name;
    if (lang === '11') out[dex].ja = name;
    if (lang === '9') out[dex].en = name;
  }
  return out;
}

export async function buildI18n({ gm, pv, dexNames = {} }) {
  const [ko, ja, en, apiMoves, apiSpecies] = await Promise.all([
    loadText('korean'),
    loadText('japanese'),
    loadText('english'),
    pokeapiMoveNames().catch(() => ({})),
    pokeapiSpeciesNames().catch(() => ({})),
  ]);
  const tri = (key) => (en.has(key) ? { en: en.get(key), ko: ko.get(key) ?? en.get(key), ja: ja.get(key) ?? en.get(key) } : null);
  const pad = (n) => String(n).padStart(4, '0');

  // ---- Types & weather ----
  const types = {};
  for (const t of ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'])
    types[t] = tri(`pokemon_type_${t}`);
  const weather = {};
  for (const [id, key] of Object.entries({ sunny: 'weather_sunny', rainy: 'weather_rainy', 'partly cloudy': 'weather_partly_cloudy', cloudy: 'weather_overcast', windy: 'weather_windy', snow: 'weather_snow', fog: 'weather_fog', extreme: 'weather_extreme' }))
    weather[id] = tri(key);

  // ---- Form labels: English label → {ko, ja} from form_* keys ----
  const formKeys = [...en.keys()].filter((k) => k.startsWith('form_'));
  const formLabel = (token, slug) => {
    if (REGION[token]) return REGION[token];
    if (FIXED[token]) return FIXED[token];
    if (types[token.toLowerCase()]) return { ko: types[token.toLowerCase()].ko, ja: types[token.toLowerCase()].ja };
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9%]/g, '');
    const t = norm(token);
    const hits = formKeys.filter((k) => norm(en.get(k)).startsWith(t) || norm(en.get(k)) === t);
    const translated = (k) => ko.get(k) !== en.get(k);
    const pick = hits.find((k) => k.includes(slug) && translated(k)) ?? hits.find(translated) ?? hits[0];
    if (!pick) return null;
    return { ko: ko.get(pick), ja: ja.get(pick) };
  };

  // ---- Pokémon ----
  const missing = [];
  const pokemon = {};
  for (const p of pv.pokemon) {
    let base = tri(`pokemon_name_${pad(p.dex)}`);
    let source = 'game';
    if (!base && dexNames[p.dex]) {
      base = { en: dexNames[p.dex].en, ko: dexNames[p.dex].ko, ja: dexNames[p.dex].ja };
      source = 'leekduck';
    }
    if (!base && apiSpecies[p.dex]?.ko) {
      base = { en: apiSpecies[p.dex].en, ko: apiSpecies[p.dex].ko, ja: apiSpecies[p.dex].ja };
      source = 'pokeapi';
    }
    if (!base) {
      missing.push(`pokemon:${p.speciesId}`);
      continue;
    }
    const tokens = [...p.speciesName.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
    const slug = p.speciesId.split('_')[0];
    let names = { ko: base.ko, ja: base.ja };
    const extras = { ko: [], ja: [] };
    for (const tok of tokens) {
      if (MEGA_SUFFIX[tok]) {
        const m = tri(`pokemon_name_${pad(p.dex)}_${pad(MEGA_SUFFIX[tok])}`);
        if (m) names = { ko: m.ko, ja: m.ja };
        else names = { ko: `${tok === 'Primal' ? '원시' : '메가'}${base.ko}`, ja: `${tok === 'Primal' ? 'ゲンシ' : 'メガ'}${base.ja}` };
        continue;
      }
      const f = formLabel(tok, slug);
      if (!f || f.ko === tok || /[a-z]/i.test(f.ko ?? '')) missing.push(`form:${p.speciesId}:${tok}`);
      extras.ko.push(f?.ko ?? tok);
      extras.ja.push(f?.ja ?? tok);
    }
    pokemon[p.speciesId] = {
      source,
      dex: p.dex,
      en: p.speciesName,
      ko: names.ko + extras.ko.map((x) => `(${x})`).join(''),
      ja: names.ja + extras.ja.map((x) => `（${x}）`).join(''),
    };
  }

  // ---- Moves: PvPoke id → game move number (from game master template ids) → move_name_#### ----
  const moveNo = {};
  for (const t of gm) {
    const m = t.templateId.match(/^V(\d{4})_MOVE_(.+)$/);
    if (m) moveNo[m[2].replace(/_FAST$/, '')] = Number(m[1]);
  }
  const moves = {};
  for (const mv of pv.moves) {
    let id = mv.moveId;
    let suffix = { ko: '', ja: '' };
    if (id.startsWith('HIDDEN_POWER_')) {
      const tp = types[id.replace('HIDDEN_POWER_', '').toLowerCase()];
      suffix = tp ? { ko: `(${tp.ko})`, ja: `（${tp.ja}）` } : suffix;
      id = 'HIDDEN_POWER';
    } else if (id.endsWith('_PLUS')) {
      id = id.replace(/_PLUS$/, '');
      suffix = { ko: '+', ja: '+' };
    }
    const n = moveNo[id];
    let names = n !== undefined ? tri(`move_name_${pad(n)}`) : null;
    let source = 'game';
    if (!names && apiMoves[id]?.ko) {
      names = { en: mv.name, ko: apiMoves[id].ko, ja: apiMoves[id].ja ?? mv.name };
      source = 'pokeapi';
    }
    if (!names) missing.push(`move:${mv.moveId}`);
    moves[mv.moveId] = { source: names ? source : 'english', type: mv.type, en: mv.name, ko: (names?.ko ?? mv.name) + suffix.ko, ja: (names?.ja ?? mv.name) + suffix.ja };
  }

  // ---- GBL league / cup titles ----
  const leagues = {};
  const titleKeys = new Set(gm.filter((t) => t.data.combatLeague).map((t) => t.data.combatLeague.title));
  for (const k of en.keys()) if (/(_cup_title|_cup_name|^combat_.*_league)$/.test(k)) titleKeys.add(k);
  for (const k of titleKeys) {
    const n = tri(k);
    if (n && !leagues[n.en]) leagues[n.en] = { ko: n.ko, ja: n.ja };
  }

  // ---- Overrides win ----
  const overrides = await readOverrides();
  const tables = { pokemon, move: moves, type: types, weather, league: leagues };
  for (const o of overrides) {
    const table = tables[o.kind];
    if (!table) continue;
    table[o.id] = { ...(table[o.id] ?? {}), source: 'override', ...Object.fromEntries(Object.entries({ ko: o.ko, en: o.en, ja: o.ja }).filter(([, v]) => v)) };
  }

  // ---- CSVs ----
  await mkdir(CSV_DIR, { recursive: true });
  const byDex = Object.entries(pokemon).sort((a, b) => a[1].dex - b[1].dex || a[0].localeCompare(b[0]));
  await writeFile(path.join(CSV_DIR, 'pokemon_names.csv'), toCsv(['id', 'dex', 'ko', 'en', 'ja', 'source'], byDex.map(([id, n]) => [id, n.dex, n.ko, n.en, n.ja, n.source])));
  await writeFile(
    path.join(CSV_DIR, 'move_names.csv'),
    toCsv(['id', 'type', 'ko', 'en', 'ja', 'source'], Object.entries(moves).sort((a, b) => a[0].localeCompare(b[0])).map(([id, n]) => [id, n.type, n.ko, n.en, n.ja, n.source])),
  );
  await writeFile(path.join(CSV_DIR, 'type_names.csv'), toCsv(['id', 'ko', 'en', 'ja'], Object.entries(types).map(([id, n]) => [id, n.ko, n.en, n.ja])));
  await writeFile(path.join(CSV_DIR, 'weather_names.csv'), toCsv(['id', 'ko', 'en', 'ja'], Object.entries(weather).map(([id, n]) => [id, n.ko, n.en, n.ja])));
  await writeFile(
    path.join(CSV_DIR, 'league_names.csv'),
    toCsv(['en', 'ko', 'ja'], Object.entries(leagues).sort().map(([e, n]) => [e, n.ko, n.ja])),
  );
  try {
    await readFile(path.join(CSV_DIR, 'overrides.csv'));
  } catch {
    await writeFile(
      path.join(CSV_DIR, 'overrides.csv'),
      toCsv(['kind', 'id', 'ko', 'en', 'ja'], [['# kind = pokemon | move | type | weather | league. Leave a cell empty to keep the generated value.', '', '', '', '']]),
    );
  }
  const overridden = new Set(overrides.map((o) => `${o.kind}:${o.id}`));
  const stillMissing = missing.filter((m) => {
    const [kind, id] = m.split(':');
    return !overridden.has(`${kind === 'form' ? 'pokemon' : kind}:${id}`);
  });
  missing.length = 0;
  missing.push(...stillMissing);
  await writeFile(path.join(CSV_DIR, '_untranslated.txt'), missing.join('\n') + '\n');

  // Compact JSON for the site: [ko, ja] pairs (English already lives in pokemon.json / moves.json)
  const pair = (t) => Object.fromEntries(Object.entries(t).filter(([, n]) => n).map(([id, n]) => [id, [n.ko, n.ja]]));
  return {
    json: { pokemon: pair(pokemon), moves: pair(moves), types: pair(types), weather: pair(weather), leagues: pair(leagues) },
    missing,
    jaToSpecies: Object.fromEntries(Object.entries(pokemon).map(([id, n]) => [n.ja.normalize('NFKC'), id])),
    // base Japanese name → default species (first non-shadow entry for that dex, e.g. ギラティナ → giratina_altered)
    dexJa: Object.fromEntries(
      [...byDex]
        .reverse()
        .filter(([id]) => !id.endsWith('_shadow') && !id.includes('_mega'))
        .map(([id, n]) => [n.ja.normalize('NFKC').replace(/[(（].*$/, ''), { id, dex: n.dex }]),
    ),
  };
}
