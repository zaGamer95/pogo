import { useMemo, useState } from 'react';
import { spriteUrl, useGameData, type GameData } from '../lib/data';
import { DEX_FLAGS, GENERATIONS, dexEntries, formatDexList, parseDexList, spares, useDex, type DexEntry, type DexFlag } from '../lib/dex';
import { resolveName } from '../lib/names';
import { useRoster } from '../lib/roster';
import { Empty, PokeName, Sprite, Tabs, Types } from '../components/ui';
import { ordered, pokeNames, searchText, usePrefs, useT, type Lang, type Tri } from '../lib/i18n';

type View = 'dex' | 'wants' | 'give' | 'share';

// Dex entries are species-level, so drop the form suffix: "Giratina (Altered)" → "Giratina", "기라티나(어나더폼)" → "기라티나".
const stripForm = (s: string) => s.replace(/\s*[（(][^()（）]*[)）]$/, '');
function dexNames(data: GameData, e: DexEntry): Tri {
  const n = pokeNames(data, e.species);
  return { ko: stripForm(n.ko), en: stripForm(n.en), ja: stripForm(n.ja) };
}

/** Species-level name in all three languages (same look as PokeName). */
function DexName({ entry, prefix }: { entry: DexEntry; prefix?: string }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const tri = dexNames(data, entry);
  const { primary, others } = ordered(tri, lang);
  return (
    <span className="pname" title={`${tri.ko} / ${tri.en} / ${tri.ja}`}>
      <span className="mon-name">
        {prefix}
        {primary}
      </span>
      {others.length > 0 && <span className="pname-alt">{others.join(' · ')}</span>}
    </span>
  );
}

/** Translate a spares() reason like "Duplicate (3 owned)". */
function reasonText(t: ReturnType<typeof useT>, reason: string): string {
  const m = reason.match(/^(.*) \((\d+) owned\)$/);
  return m ? t('{reason} ({n} owned)', { reason: t(m[1]), n: m[2] }) : t(reason);
}

export default function Trade() {
  const data = useGameData();
  const t = useT();
  const dex = useDex();
  const entries = dexEntries(data);
  const [view, setView] = useState<View>('dex');
  const shinyReleased = entries.filter((e) => e.shinyReleased);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{t('Trade')}</h1>
          <p className="muted">
            {t('Pokédex {caught}/{total} · Shiny dex {shiny}/{released} released · Lucky {lucky}', {
              caught: dex.sets.caught.size,
              total: entries.length,
              shiny: entries.filter((e) => dex.sets.shiny.has(e.dex)).length,
              released: shinyReleased.length,
              lucky: dex.sets.lucky.size,
            })}
          </p>
        </div>
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: 'dex', label: t('My Pokédex') },
            { value: 'wants', label: t('Wants') },
            { value: 'give', label: t('Can give') },
            { value: 'share', label: t('Share list') },
          ]}
        />
      </div>
      {view === 'dex' && <DexView entries={entries} />}
      {view === 'wants' && <WantsView entries={entries} />}
      {view === 'give' && <GiveView />}
      {view === 'share' && <ShareView entries={entries} />}
    </div>
  );
}

// ---------------- Pokédex tracker ----------------

function DexView({ entries }: { entries: DexEntry[] }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const dex = useDex();
  const { roster } = useRoster();
  const [mode, setMode] = useState<DexFlag>('caught');
  const [gen, setGen] = useState(0);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [q, setQ] = useState('');
  const [bulk, setBulk] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const shown = entries.filter((e) => {
    if (gen) {
      const g = GENERATIONS[gen - 1];
      if (e.dex < g.from || e.dex > g.to) return false;
    }
    if (onlyMissing && dex.sets[mode].has(e.dex)) return false;
    if (mode === 'shiny' && onlyMissing && !e.shinyReleased) return false;
    const n = q.trim().toLowerCase().normalize('NFKC');
    return !n || searchText(data, e.species).includes(n) || String(e.dex) === n;
  });

  const fromRoster = () => {
    const caught = roster.map((m) => data.byId.get(m.speciesId)?.dex).filter((d): d is number => !!d);
    const shiny = roster.filter((m) => m.shiny).map((m) => data.byId.get(m.speciesId)?.dex).filter((d): d is number => !!d);
    const lucky = roster.filter((m) => m.lucky).map((m) => data.byId.get(m.speciesId)?.dex).filter((d): d is number => !!d);
    dex.add('caught', caught);
    dex.add('shiny', shiny);
    dex.add('lucky', lucky);
    setMsg(t('Marked {caught} species caught, {shiny} shiny and {lucky} lucky from My Pokémon.', { caught: new Set(caught).size, shiny: new Set(shiny).size, lucky: new Set(lucky).size }));
  };

  return (
    <>
      <div className="card stack">
        <div className="row">
          <span className="small muted">{t('Tap to toggle:')}</span>
          <Tabs value={mode} onChange={setMode} options={DEX_FLAGS.map((f) => ({ value: f.flag, label: `${t(f.label)} (${dex.sets[f.flag].size})` }))} />
        </div>
        <div className="row">
          <select value={gen} onChange={(e) => setGen(Number(e.target.value))}>
            <option value={0}>{t('All generations')}</option>
            {GENERATIONS.map((g) => (
              <option key={g.gen} value={g.gen}>
                {t('Gen {n} · {region}', { n: g.gen, region: t(g.region) })}
              </option>
            ))}
          </select>
          <input placeholder={t('Search name (한국어 / English / 日本語) / #')} value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="check">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> {t('Only show unmarked')}
          </label>
          <span className="spacer" />
          <button onClick={fromRoster} disabled={!roster.length} title={t('Uses species, shiny and lucky flags from the My Pokémon page')}>
            {t('Fill from My Pokémon')}
          </button>
        </div>
        <details>
          <summary className="small">{t('Bulk entry: paste dex numbers or ranges for “{list}”', { list: t(DEX_FLAGS.find((f) => f.flag === mode)?.label ?? '') })}</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <textarea rows={2} style={{ flex: 1, minWidth: 240 }} placeholder={t('e.g. 1-151, 155, 158-160')} value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <button
              onClick={() => {
                const list = parseDexList(bulk);
                dex.add(mode, list);
                setMsg(t('Added {n} entries.', { n: list.length }));
                setBulk('');
              }}
            >
              {t('Add')}
            </button>
            <button
              onClick={() => {
                if (!confirm(t('Replace this whole list with what you pasted?'))) return;
                const list = parseDexList(bulk);
                dex.add(mode, list, true);
                setMsg(t('List replaced ({n} entries).', { n: list.length }));
                setBulk('');
              }}
            >
              {t('Replace')}
            </button>
            <button onClick={() => setBulk(formatDexList(dex.state[mode]))}>{t('Show current as ranges')}</button>
          </div>
        </details>
        {msg && <p className="small">{msg}</p>}
      </div>
      <div className="dex-grid">
        {shown.map((e) => {
          const on = dex.sets[mode].has(e.dex);
          const shinyMode = mode === 'shiny' || mode === 'wantShiny';
          const noShiny = shinyMode && !e.shinyReleased;
          const tri = dexNames(data, e);
          const { primary, others } = ordered(tri, lang);
          const names = `${tri.ko} / ${tri.en} / ${tri.ja}`;
          return (
            <button
              key={e.dex}
              className={`dex-cell${on ? ' on' : ''}${noShiny ? ' disabled' : ''}`}
              onClick={() => dex.toggle(mode, e.dex)}
              title={noShiny ? `${names}\n${t('Shiny not released yet')}` : names}
            >
              <span className="dex-num">#{e.dex}</span>
              <Sprite src={spriteUrl(e.dex, shinyMode)} size={48} />
              <span className="dex-name">{primary}</span>
              {others.length > 0 && (
                <span className="dex-name muted" style={{ fontSize: '0.6rem' }}>
                  {others.join(' · ')}
                </span>
              )}
              <span className="dex-flags">
                {dex.sets.caught.has(e.dex) && <span title={t('Caught')}>●</span>}
                {dex.sets.shiny.has(e.dex) && <span title={t('Shiny')}>✨</span>}
                {dex.sets.lucky.has(e.dex) && <span title={t('Lucky')}>★</span>}
                {(dex.sets.want.has(e.dex) || dex.sets.wantShiny.has(e.dex)) && <span title={t('Wanted')}>♥</span>}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Wants ----------------

function WantsView({ entries }: { entries: DexEntry[] }) {
  const data = useGameData();
  const t = useT();
  const dex = useDex();
  const missing = entries.filter((e) => !dex.sets.caught.has(e.dex));
  const missingShiny = entries.filter((e) => e.shinyReleased && !dex.sets.shiny.has(e.dex)).sort((a, b) => (b.shinyReleased ?? '').localeCompare(a.shinyReleased ?? ''));

  // Shinies catchable right now from current raids / events
  const availableNow = useMemo(() => {
    const s = new Set<number>();
    for (const r of data.raids) if (r.canBeShiny) {
      const sp = resolveName(data, r.name).species;
      if (sp) s.add(sp.dex);
    }
    return s;
  }, [data]);

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2>{t('Missing from Pokédex ({n})', { n: missing.length })}</h2>
        <p className="small muted">{t("Trade for these to get a new Pokédex entry. Trading for a species you haven't registered costs much more Stardust.")}</p>
        <WantList items={missing} flag="want" availableNow={new Set()} />
      </div>
      <div className="card">
        <h2>{t('Missing shinies ({n})', { n: missingShiny.length })}</h2>
        <p className="small muted">{t('Only shinies that have been released (LeekDuck shiny checklist). Newest first. “Raid now” = catchable in current raids.')}</p>
        <WantList items={missingShiny} flag="wantShiny" shiny availableNow={availableNow} />
      </div>
    </div>
  );
}

function WantList({ items, flag, shiny, availableNow }: { items: DexEntry[]; flag: DexFlag; shiny?: boolean; availableNow: Set<number> }) {
  const dex = useDex();
  const t = useT();
  const [limit, setLimit] = useState(60);
  if (!items.length) return <Empty>{t('Nothing missing. 🎉')}</Empty>;
  return (
    <>
      <table>
        <tbody>
          {items.slice(0, limit).map((e) => (
            <tr key={e.dex}>
              <td>
                <div className="mon">
                  <Sprite src={spriteUrl(e.dex, shiny)} size={32} />
                  <div>
                    <DexName entry={e} prefix={`#${e.dex} `} />
                    <Types types={e.species.types} small />
                  </div>
                </div>
              </td>
              <td className="small">
                {e.untradeable ? (
                  <span className="pill bad">{t('Not tradeable')}</span>
                ) : e.legendary ? (
                  <span className="pill warn">{t('Special trade')}</span>
                ) : null}
                {availableNow.has(e.dex) && <span className="pill good">{t('Raid now')}</span>}
                {shiny && e.shinyReleased && e.shinyReleased !== 'yes' && <span className="muted"> {t('since {date}', { date: e.shinyReleased.slice(0, 7) })}</span>}
              </td>
              <td className="right">
                <label className="check small">
                  <input type="checkbox" checked={dex.sets[flag].has(e.dex)} onChange={() => dex.toggle(flag, e.dex)} /> {t('Want')}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > limit && (
        <button style={{ marginTop: 8 }} onClick={() => setLimit(limit + 100)}>
          {t('Show more ({n} left)', { n: items.length - limit })}
        </button>
      )}
    </>
  );
}

// ---------------- Can give ----------------

function GiveView() {
  const data = useGameData();
  const t = useT();
  const { roster, upsert } = useRoster();
  const list = useMemo(() => spares(data, roster), [data, roster]);
  const [limit, setLimit] = useState(80);
  if (!roster.length) return <Empty>{t('Import or add your Pokémon on the “My Pokémon” page first.')}</Empty>;
  return (
    <div className="card">
      <h2>{t('Trade candidates ({n})', { n: list.length })}</h2>
      <p className="small muted">
        {t(
          "Pokémon you've marked “For trade”, plus spare copies (the best copy of each species is kept). Shadows, luckies (already traded once), mythicals, favorites, best buddies and anything marked raid- or PvP-ready are left out.",
        )}
      </p>
      {list.length === 0 ? (
        <Empty>{t('No spares found. Mark Pokémon “For trade” on the My Pokémon page.')}</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <tbody>
              {list.slice(0, limit).map((s) => (
                <tr key={s.mon.uid}>
                  <td>
                    <div className="mon">
                      <Sprite src={spriteUrl(s.species.dex, s.mon.shiny)} size={32} />
                      <div>
                        <div>
                          <PokeName species={s.species} nickname={s.mon.nickname} /> {s.mon.shiny && '✨'}
                        </div>
                        <div className="small muted">
                          {s.mon.ivs.join('/')} · {t('Lv {level}', { level: s.mon.level })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="small">{reasonText(t, s.reason)}</td>
                  <td className="right">
                    <label className="check small">
                      <input type="checkbox" checked={!!s.mon.forTrade} onChange={(e) => upsert({ ...s.mon, forTrade: e.target.checked })} /> {t('For trade')}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > limit && <button onClick={() => setLimit(limit + 200)}>{t('Show more')}</button>}
        </div>
      )}
    </div>
  );
}

// ---------------- Share ----------------

function ShareView({ entries }: { entries: DexEntry[] }) {
  const data = useGameData();
  const dex = useDex();
  const { roster } = useRoster();
  const t = useT();
  const { lang: uiLang } = usePrefs();
  const [lang, setLang] = useState<Lang | 'ja'>(uiLang);
  const [copied, setCopied] = useState(false);
  const byDex = new Map(entries.map((e) => [e.dex, e]));
  const nm = (d: number) => {
    const e = byDex.get(d);
    return e ? dexNames(data, e)[lang] : `#${d}`;
  };
  const wants = dex.state.want.map(nm);
  const wantShiny = dex.state.wantShiny.map(nm);
  const giving = spares(data, roster)
    .filter((s) => s.mon.forTrade)
    .map((s) => `${s.mon.shiny ? '✨' : ''}${pokeNames(data, s.species)[lang]}`);
  const text = [
    wants.length ? `LF: ${wants.join(', ')}` : '',
    wantShiny.length ? `LF ✨: ${wantShiny.join(', ')}` : '',
    giving.length ? `FT: ${[...new Set(giving)].join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const backup = JSON.stringify(dex.state);

  return (
    <div className="grid cols-2">
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{t('Trade post')}</h2>
          <span className="spacer" />
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang | 'ja')}>
            <option value="ko">한국어 이름</option>
            <option value="en">English names</option>
            <option value="ja">日本語の名前</option>
          </select>
        </div>
        <p className="small muted">{t('Built from your “Want” / “Want shiny” marks and Pokémon marked “For trade”.')}</p>
        <textarea readOnly rows={10} style={{ width: '100%' }} value={text || t('Mark some wants and trade candidates first.')} />
        <button
          className="primary"
          disabled={!text}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t('Copied!') : t('Copy')}
        </button>
      </div>
      <div className="card">
        <h2>{t('Pokédex backup')}</h2>
        <p className="small muted">{t('Your Pokédex marks are saved in this browser. Copy this to move them to another device, or paste a backup here to restore it.')}</p>
        <textarea rows={6} style={{ width: '100%' }} defaultValue={backup} id="dex-backup" />
        <div className="row">
          <button onClick={() => navigator.clipboard.writeText(backup)}>{t('Copy backup')}</button>
          <button
            onClick={() => {
              const el = document.getElementById('dex-backup') as HTMLTextAreaElement;
              try {
                dex.replaceAll(JSON.parse(el.value));
                alert(t('Pokédex restored.'));
              } catch {
                alert(t("That doesn't look like a Pokédex backup."));
              }
            }}
          >
            {t('Restore from box')}
          </button>
        </div>
      </div>
    </div>
  );
}
