import type { GameData, LeekEvent, PvpFormat, Species } from './data';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const REGIONAL: Record<string, string> = {
  alolan: 'Alolan',
  galarian: 'Galarian',
  hisuian: 'Hisuian',
  paldean: 'Paldean',
};

let nameIndex: Map<string, Species> | null = null;
function index(data: GameData): Map<string, Species> {
  if (!nameIndex) {
    nameIndex = new Map();
    for (const p of data.pokemon) {
      const k = norm(p.name);
      if (!nameIndex.has(k)) nameIndex.set(k, p);
    }
  }
  return nameIndex;
}

export interface ResolvedName {
  species: Species | null;
  shadow: boolean;
  mega: boolean;
  dynamax: 'dmax' | 'gmax' | null;
}

/** Resolve names such as "Shadow Alolan Sandslash", "Mega Charizard Y", "Thundurus (Incarnate)". */
export function resolveName(data: GameData, raw: string): ResolvedName {
  let name = raw.trim();
  let shadow = false;
  let mega = false;
  let dynamax: ResolvedName['dynamax'] = null;
  const idx = index(data);

  if (/^shadow\s+/i.test(name)) {
    shadow = true;
    name = name.replace(/^shadow\s+/i, '');
  }
  if (/^(dynamax)\s+/i.test(name)) {
    dynamax = 'dmax';
    name = name.replace(/^dynamax\s+/i, '');
  }
  if (/^(gigantamax)\s+/i.test(name)) {
    dynamax = 'gmax';
    name = name.replace(/^gigantamax\s+/i, '');
  }
  let megaSuffix = '';
  const megaMatch = name.match(/^(mega|primal)\s+(.+?)(?:\s+([XY]))?$/i);
  if (megaMatch) {
    mega = true;
    megaSuffix = megaMatch[1].toLowerCase() === 'primal' ? 'Primal' : `Mega${megaMatch[3] ? ' ' + megaMatch[3].toUpperCase() : ''}`;
    name = megaMatch[2];
  }
  let form = '';
  const paren = name.match(/^(.+?)\s*\((.+)\)$/);
  if (paren) {
    name = paren[1];
    form = paren[2].replace(/\s*forme?$/i, '');
  }
  const regional = name.match(/^(alolan|galarian|hisuian|paldean)\s+(.+)$/i);
  if (regional) {
    form = REGIONAL[regional[1].toLowerCase()] + (form ? ` ${form}` : '');
    name = regional[2];
  }

  const candidates: string[] = [];
  if (megaSuffix) candidates.push(`${name} (${megaSuffix})`);
  if (form) candidates.push(`${name} (${form})`, `${name} (${form} Forme)`);
  candidates.push(name);
  let species: Species | null = null;
  for (const c of candidates) {
    const hit = idx.get(norm(c));
    if (hit) {
      species = hit;
      break;
    }
  }
  if (!species) {
    // Fallback: first species whose name starts with the base name ("Thundurus" → "Thundurus (Incarnate)")
    const n = norm(name);
    species = data.pokemon.find((p) => norm(p.name).startsWith(n) && !p.id.endsWith('_shadow')) ?? null;
  }
  return { species, shadow, mega, dynamax };
}

/** The non-shadow entry for a species (PvPoke keeps shadows as separate ids). */
export function baseSpecies(data: GameData, sp: Species): Species {
  if (sp.id.endsWith('_shadow')) return data.byId.get(sp.id.replace(/_shadow$/, '')) ?? sp;
  return sp;
}

// ---------- GO Battle League ----------

export interface GblLeague {
  label: string;
  cp: number;
  format: PvpFormat | null;
}

export interface GblWeek {
  event: LeekEvent;
  start: Date;
  end: Date;
  season: string;
  leagues: GblLeague[];
}

const EDITION_CP: [RegExp, number][] = [
  [/great league/i, 1500],
  [/ultra league/i, 2500],
  [/master league/i, 10000],
  [/little/i, 500],
];

const STOP = new Set(['cup', 'league', 'edition', 'great', 'ultra', 'master', 'go', 'the', 'battle', 'series', 'championship']);
const tokens = (s: string) => norm(s).split(' ').filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));

export function matchLeague(data: GameData, label: string): GblLeague {
  let cp = 1500;
  for (const [re, v] of EDITION_CP) if (re.test(label)) { cp = v; break; }
  const [head, edition] = label.split(':').map((s) => s.trim());
  const isMegaEdition = /mega edition/i.test(edition ?? '');
  const pick = (key: string) => data.formats.find((f) => f.key === key) ?? null;

  let format: PvpFormat | null = null;
  if (/^(great|ultra|master) league$/i.test(head)) {
    format = pick(`${isMegaEdition ? 'mega' : 'all'}-${cp}`);
  } else if (/^little cup$/i.test(head)) {
    format = pick('little-500');
    cp = 500;
  } else {
    const want = tokens(head);
    let bestScore = 0;
    for (const f of data.formats.filter((x) => x.cp === cp)) {
      const have = new Set([...tokens(f.title), ...tokens(f.cup)]);
      // match whole tokens, or the cup id containing the token ("laic" in "laic2027")
      const score = want.filter((w) => w !== 'mega' && (have.has(w) || f.cup.includes(w))).length;
      if (score > bestScore) {
        bestScore = score;
        format = f;
      }
    }
  }
  return { label, cp, format };
}

export function gblSchedule(data: GameData): GblWeek[] {
  return data.events
    .filter((e) => e.eventType === 'go-battle-league')
    .map((e) => {
      const [leaguePart, season = ''] = e.name.split('|').map((s) => s.trim());
      const labels = leaguePart
        .split(/,\s*(?:and\s+)?|\s+and\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        event: e,
        start: new Date(e.start),
        end: new Date(e.end),
        season,
        leagues: labels.map((l) => matchLeague(data, l)),
      };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function pvpokeLink(format: PvpFormat, speciesId?: string): string {
  return `https://pvpoke.com/rankings/${format.cup}/${format.cp}/overall/${speciesId ? speciesId + '/' : ''}`;
}
