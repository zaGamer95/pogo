// Tier-0 source: official Pokémon GO news posts (pokemongo.com/news), English + Korean.
//
// Official posts are prose, but the main event window is always written on its own line in one of two forms:
//   "Saturday, October 10, 2026, from 2:00 p.m. to 5:00 p.m. local time"
//   "Tuesday, October 13, at 10:00 a.m. to Monday, October 19, 2026, at 8:00 p.m. local time"
// We only accept those standalone lines (never times buried in sentences), so a post we can't read
// confidently simply has no window and LeekDuck stays the source for it.
//
// Then each LeekDuck event is matched to an official post (same local start day + similar name/slug):
//   - matched → event.official = { url, urlKo, title, titleKo, start, end, mismatch }
//     and the official times win when they differ.
//   - official posts with a window but no LeekDuck event → added as eventType "official".

const SITE = 'https://pokemongo.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (personal pogo companion; low-volume)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

async function get(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function textLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

const meta = (html, prop) => html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`))?.[1] ?? null;
const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const pageTitle = (html) => {
  const t = html.match(/<title>([^<]*)<\/title>/)?.[1];
  return t ? decode(t).replace(/\s*—\s*Pokémon GO\s*$/, '').trim() : null;
};

function to24(h, m, ap) {
  let hh = Number(h) % 12;
  if (ap.startsWith('p')) hh += 12;
  return `${String(hh).padStart(2, '0')}:${m}`;
}

const DAY = String.raw`(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?`;
const DATE = String.raw`(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?`;
const TIME = String.raw`(\d{1,2}):(\d{2})\s*([ap])\.?m\.?`;
// "Tuesday, October 13, at 10:00 a.m. to Monday, October 19, 2026, at 8:00 p.m. local time"
const RANGE_A = new RegExp(String.raw`^(?:From\s+)?${DAY}${DATE},?\s+at\s+${TIME}\s+to\s+${DAY}${DATE},?\s+at\s+${TIME}(?:\s+local time)?\.?$`, 'i');
// "Saturday, October 10, 2026, from 2:00 p.m. to 5:00 p.m. local time"
const RANGE_B = new RegExp(String.raw`^${DAY}${DATE},?\s+from\s+${TIME}\s+to\s+${TIME}(?:\s+local time)?\.?$`, 'i');

/** Parse standalone window lines → [{ start, end }] as local wall-clock "YYYY-MM-DDTHH:MM". */
export function parseWindows(lines, publishedYear, publishedMonth) {
  const out = [];
  const iso = (mon, d, y, t) => `${y}-${String(MONTHS.indexOf(mon.toLowerCase()) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${t}`;
  const guessYear = (mon) => {
    const m = MONTHS.indexOf(mon.toLowerCase());
    // a post from November talking about "January" means next year
    return m + 6 < publishedMonth ? publishedYear + 1 : publishedYear;
  };
  for (const line of lines) {
    if (line.length > 160 || /PDT|PST|UTC|GMT|JST/.test(line)) continue;
    let m = line.match(RANGE_A);
    if (m) {
      const [, m1, d1, y1, h1, mi1, ap1, m2, d2, y2, h2, mi2, ap2] = m;
      const yEnd = Number(y2 || y1) || guessYear(m2);
      let yStart = Number(y1) || yEnd;
      if (!y1 && MONTHS.indexOf(m1.toLowerCase()) > MONTHS.indexOf(m2.toLowerCase())) yStart = yEnd - 1; // Dec → Jan
      out.push({ start: iso(m1, d1, yStart, to24(h1, mi1, ap1.toLowerCase())), end: iso(m2, d2, yEnd, to24(h2, mi2, ap2.toLowerCase())), text: line });
      continue;
    }
    m = line.match(RANGE_B);
    if (m) {
      const [, mon, d, y, h1, mi1, ap1, h2, mi2, ap2] = m;
      const yy = Number(y) || guessYear(mon);
      out.push({ start: iso(mon, d, yy, to24(h1, mi1, ap1.toLowerCase())), end: iso(mon, d, yy, to24(h2, mi2, ap2.toLowerCase())), text: line });
    }
  }
  return out;
}

export async function fetchOfficialPosts({ max = 30 } = {}) {
  const list = await get(`${SITE}/news`);
  const slugs = [...new Set([...list.matchAll(/href="\/(?:[a-z]{2}\/)?news\/([a-z0-9-]+)\/?"/g)].map((m) => m[1]))].slice(0, max);
  const posts = [];
  for (const slug of slugs) {
    try {
      const en = await get(`${SITE}/news/${slug}`);
      await sleep(300);
      const ko = await get(`${SITE}/ko/news/${slug}`).catch(() => null);
      await sleep(300);
      const published = en.match(/"datePublished":"([^"]+)"/)?.[1] ?? null;
      const pub = published ? new Date(published) : new Date();
      const titleKo = ko ? pageTitle(ko) : null;
      const title = pageTitle(en) ?? slug;
      posts.push({
        slug,
        url: `${SITE}/news/${slug}`,
        urlKo: `${SITE}/ko/news/${slug}`,
        title,
        titleKo: titleKo && titleKo !== title ? titleKo : null,
        published,
        image: meta(en, 'og:image'),
        windows: parseWindows(textLines(en), pub.getUTCFullYear(), pub.getUTCMonth()),
      });
    } catch (e) {
      console.warn(`  official post ${slug} failed: ${e.message}`);
    }
  }
  return posts;
}

// ---------- Matching LeekDuck events ↔ official posts ----------

const STOP = new Set(['the', 'and', 'of', 'in', 'a', 'to', 'for', 'with', 'event', 'events', 'pokemon', 'pokémon', 'go', 'during', 'day', 'returns', 'return', 'celebrate', 'celebration']);
const tokens = (s) =>
  new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/(\d{4})/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
const similarity = (a, b) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / Math.max(1, Math.min(a.size, b.size));
};
const localStamp = (s) => s?.replace('Z', '').slice(0, 16); // "2026-10-10T14:00"
const isLocal = (s) => !!s && !s.endsWith('Z');

export function applyOfficial(events, posts) {
  const used = new Set();
  let matched = 0;
  let mismatched = 0;
  // Only compare events whose LeekDuck times are local wall-clock (official "local time" windows)
  for (const e of events) {
    if (!isLocal(e.start)) continue;
    const et = new Set([...tokens(e.name), ...tokens(e.eventID)]);
    let best = null;
    for (const p of posts) {
      const pt = new Set([...tokens(p.title), ...tokens(p.slug)]);
      const sim = similarity(et, pt);
      for (const w of p.windows) {
        if (w.start.slice(0, 10) !== e.start.slice(0, 10)) continue; // same local start day
        if (sim < 0.5) continue;
        const score = sim + (w.start === localStamp(e.start) ? 0.5 : 0);
        if (!best || score > best.score) best = { p, w, score };
      }
    }
    if (!best) continue;
    matched++;
    used.add(best.p.slug);
    const mismatch = best.w.start !== localStamp(e.start) || best.w.end !== localStamp(e.end);
    if (mismatch) mismatched++;
    e.official = {
      url: best.p.url,
      urlKo: best.p.urlKo,
      title: best.p.title,
      titleKo: best.p.titleKo,
      start: `${best.w.start}:00.000`,
      end: `${best.w.end}:00.000`,
      leekStart: e.start,
      leekEnd: e.end,
      mismatch,
    };
    // Official wins
    e.start = e.official.start;
    e.end = e.official.end;
  }

  // Official posts LeekDuck doesn't list (yet): add them if the window hasn't ended.
  const now = new Date();
  const added = [];
  for (const p of posts) {
    if (used.has(p.slug) || !p.windows.length) continue;
    const w = p.windows[0];
    if (new Date(w.end) < now) continue;
    // skip if some LeekDuck event already covers this post by name (different start day, e.g. multi-part events)
    const pt = new Set([...tokens(p.title), ...tokens(p.slug)]);
    if (events.some((e) => similarity(new Set([...tokens(e.name), ...tokens(e.eventID)]), pt) >= 0.8)) continue;
    added.push({
      eventID: `official-${p.slug}`,
      name: p.title,
      eventType: 'official',
      heading: 'Official',
      link: p.url,
      image: p.image ?? '',
      start: `${w.start}:00.000`,
      end: `${w.end}:00.000`,
      official: { url: p.url, urlKo: p.urlKo, title: p.title, titleKo: p.titleKo, start: `${w.start}:00.000`, end: `${w.end}:00.000`, mismatch: false, only: true },
    });
  }
  return { events: [...events, ...added], stats: { matched, mismatched, officialOnly: added.length } };
}
