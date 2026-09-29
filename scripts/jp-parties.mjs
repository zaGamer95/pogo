// Popular GBL teams from pokemongo-get.com (ポケモンGO攻略・情報サイト) "人気のバトルパーティ検索".
// Their numbers come from opponent teams logged by players with the site's GBL battle-log tool,
// so this is *observed usage*, complementing PvPoke's *simulated* rankings.
// Personal use: a few small requests per refresh, spaced out.

const BASE = 'https://pokemongo-get.com/wp-content/themes/simplicity2-child/ajax';
const PAGE = 'https://pokemongo-get.com/taimanparty/';
const UA = { 'User-Agent': 'Mozilla/5.0 (personal pogo companion; low-volume)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REGION_SHORT = { アローラ: 'alolan', ガラル: 'galarian', ヒスイ: 'hisuian', パルデア: 'paldean' };

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
}

/** Parse the HTML table the site returns: rank, 3 members (dex, ja name, shadow), count. */
function parseParties(html) {
  const blocks = html.split('<div class="league_party_sc').slice(1);
  return blocks
    .map((b) => {
      const rank = Number(b.match(/<span class="font-s12">(\d+)<\/span>位/)?.[1]);
      const count = Number(b.match(/<span class="font-s12">(\d+)<\/span>件/)?.[1]);
      const members = [...b.matchAll(/<div class="w33 tc-top">([\s\S]*?)<\/p>/g)].map(([, m]) => ({
        dex: Number(m.match(/pokemongo\/(\d+)-/)?.[1]),
        ja: decode(m.match(/text-center">([^<]+)$/)?.[1] ?? ''),
        shadow: m.includes('class="shadow"'),
      }));
      return { rank, count, members };
    })
    .filter((p) => p.members.length === 3 && p.count);
}

export async function fetchJpParties({ i18n, byId }) {
  const page = await (await fetch(PAGE, { headers: UA })).text();
  const season = Number(page.match(/season\s*:\s*(\d+)/)?.[1]);
  if (!season) throw new Error('could not find current season on pokemongo-get.com');

  const leagues = await (
    await fetch(`${BASE}/gblleague/getSeasonLeague.php`, {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `season=${season}`,
    })
  ).json();

  const resolve = (raw) => {
    const m = { ...raw, ja: raw.ja.normalize('NFKC') };
    const exact = i18n.jaToSpecies[m.ja];
    let id = exact;
    if (!id) {
      const [, base, form] = m.ja.match(/^(.+?)(?:[(（](.+)[)）])?$/) ?? [];
      const b = i18n.dexJa[base];
      if (b) {
        if (form && REGION_SHORT[form] && byId.has(`${b.id}_${REGION_SHORT[form]}`)) id = `${b.id}_${REGION_SHORT[form]}`;
        else if (form) {
          // other forms: match the form text inside our Japanese form label, same dex
          id = Object.entries(i18n.jaToSpecies).find(([ja, sid]) => byId.get(sid)?.dex === b.dex && ja.includes(form) && !sid.endsWith('_shadow'))?.[1] ?? b.id;
        } else id = b.id;
      }
    }
    if (id && m.shadow && byId.has(`${id}_shadow`)) id = `${id}_shadow`;
    return { ...raw, id: id ?? null };
  };

  const url = (league, rank) =>
    `${BASE}/battlelog_240822/battleparty/BattlePvpRecommendNewVue.php?season=${season}&league=${league}&between=1&rank=${rank}&pokemon=&pokemon_first=0&search_type=0&ary_search=,,&en_flg=false`;

  const out = [];
  const unresolved = new Set();
  for (const l of leagues) {
    const entry = { id: Number(l.lr_league_id), ja: l.name, en: l.name_en, cp: Number(l.maxcp) >= 9999 ? 10000 : Number(l.maxcp), rule: l.rule?.replace(/&/g, ' · ') ?? '' };
    for (const [key, rank] of [['all', ''], ['high', '21,22,23,24']]) {
      try {
        const html = await (await fetch(url(entry.id, rank), { headers: UA })).text();
        entry[key] = parseParties(html)
          .slice(0, 30)
          .map((p) => ({ ...p, members: p.members.map(resolve) }));
        entry[key].forEach((p) => p.members.forEach((m) => !m.id && unresolved.add(m.ja)));
      } catch (e) {
        console.warn(`  jp parties ${entry.en} (${key}) failed: ${e.message}`);
        entry[key] = [];
      }
      await sleep(700);
    }
    // Usage = how often each Pokémon appears across the listed teams (weighted by team count)
    const usage = new Map();
    for (const p of entry.all) for (const m of p.members) if (m.id) usage.set(m.id, (usage.get(m.id) ?? 0) + p.count);
    entry.usage = [...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, n]) => ({ id, n }));
    out.push(entry);
  }
  if (unresolved.size) console.warn(`  jp parties: unresolved names: ${[...unresolved].join(', ')}`);
  return { source: PAGE, season, fetched: new Date().toISOString(), leagues: out };
}
