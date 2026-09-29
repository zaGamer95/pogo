import { useMemo, useState } from 'react';
import { spriteUrl, useGameData } from '../lib/data';
import { DEX_FLAGS, GENERATIONS, dexEntries, formatDexList, parseDexList, spares, useDex, type DexEntry, type DexFlag } from '../lib/dex';
import { resolveName } from '../lib/names';
import { useRoster } from '../lib/roster';
import { Empty, Sprite, Tabs, Types } from '../components/ui';

type View = 'dex' | 'wants' | 'give' | 'share';

export default function Trade() {
  const data = useGameData();
  const dex = useDex();
  const entries = dexEntries(data);
  const [view, setView] = useState<View>('dex');
  const shinyReleased = entries.filter((e) => e.shinyReleased);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Trade</h1>
          <p className="muted">
            Pokédex {dex.sets.caught.size}/{entries.length} · Shiny dex {entries.filter((e) => dex.sets.shiny.has(e.dex)).length}/{shinyReleased.length} released · Lucky{' '}
            {dex.sets.lucky.size}
          </p>
        </div>
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: 'dex', label: 'My Pokédex' },
            { value: 'wants', label: 'Wants' },
            { value: 'give', label: 'Can give' },
            { value: 'share', label: 'Share list' },
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
    const n = q.trim().toLowerCase();
    return !n || e.name.toLowerCase().includes(n) || e.ko?.includes(n) || String(e.dex) === n;
  });

  const fromRoster = () => {
    const caught = roster.map((m) => data.byId.get(m.speciesId)?.dex).filter((d): d is number => !!d);
    const shiny = roster.filter((m) => m.shiny).map((m) => data.byId.get(m.speciesId)?.dex).filter((d): d is number => !!d);
    const lucky = roster.filter((m) => m.lucky).map((m) => data.byId.get(m.speciesId)?.dex).filter((d): d is number => !!d);
    dex.add('caught', caught);
    dex.add('shiny', shiny);
    dex.add('lucky', lucky);
    setMsg(`Marked ${new Set(caught).size} species caught, ${new Set(shiny).size} shiny and ${new Set(lucky).size} lucky from My Pokémon.`);
  };

  return (
    <>
      <div className="card stack">
        <div className="row">
          <span className="small muted">Tap to toggle:</span>
          <Tabs value={mode} onChange={setMode} options={DEX_FLAGS.map((f) => ({ value: f.flag, label: `${f.label} (${dex.sets[f.flag].size})` }))} />
        </div>
        <div className="row">
          <select value={gen} onChange={(e) => setGen(Number(e.target.value))}>
            <option value={0}>All generations</option>
            {GENERATIONS.map((g) => (
              <option key={g.gen} value={g.gen}>
                Gen {g.gen} · {g.region}
              </option>
            ))}
          </select>
          <input placeholder="Search name / 이름 / #" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="check">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Only show unmarked
          </label>
          <span className="spacer" />
          <button onClick={fromRoster} disabled={!roster.length} title="Uses species, shiny and lucky flags from the My Pokémon page">
            Fill from My Pokémon
          </button>
        </div>
        <details>
          <summary className="small">Bulk entry: paste dex numbers or ranges for “{DEX_FLAGS.find((f) => f.flag === mode)?.label}”</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <textarea rows={2} style={{ flex: 1, minWidth: 240 }} placeholder="e.g. 1-151, 155, 158-160" value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <button
              onClick={() => {
                const list = parseDexList(bulk);
                dex.add(mode, list);
                setMsg(`Added ${list.length} entries.`);
                setBulk('');
              }}
            >
              Add
            </button>
            <button
              onClick={() => {
                if (!confirm('Replace this whole list with what you pasted?')) return;
                const list = parseDexList(bulk);
                dex.add(mode, list, true);
                setMsg(`List replaced (${list.length} entries).`);
                setBulk('');
              }}
            >
              Replace
            </button>
            <button onClick={() => setBulk(formatDexList(dex.state[mode]))}>Show current as ranges</button>
          </div>
        </details>
        {msg && <p className="small">{msg}</p>}
      </div>
      <div className="dex-grid">
        {shown.map((e) => {
          const on = dex.sets[mode].has(e.dex);
          const shinyMode = mode === 'shiny' || mode === 'wantShiny';
          const noShiny = shinyMode && !e.shinyReleased;
          return (
            <button key={e.dex} className={`dex-cell${on ? ' on' : ''}${noShiny ? ' disabled' : ''}`} onClick={() => dex.toggle(mode, e.dex)} title={noShiny ? 'Shiny not released yet' : undefined}>
              <span className="dex-num">#{e.dex}</span>
              <Sprite src={spriteUrl(e.dex, shinyMode)} size={48} />
              <span className="dex-name">{e.name}</span>
              <span className="dex-flags">
                {dex.sets.caught.has(e.dex) && <span title="Caught">●</span>}
                {dex.sets.shiny.has(e.dex) && <span title="Shiny">✨</span>}
                {dex.sets.lucky.has(e.dex) && <span title="Lucky">★</span>}
                {(dex.sets.want.has(e.dex) || dex.sets.wantShiny.has(e.dex)) && <span title="Wanted">♥</span>}
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
        <h2>Missing from Pokédex ({missing.length})</h2>
        <p className="small muted">Trade for these to get a new Pokédex entry. Trading for a species you haven't registered costs much more Stardust.</p>
        <WantList items={missing} flag="want" availableNow={new Set()} />
      </div>
      <div className="card">
        <h2>Missing shinies ({missingShiny.length})</h2>
        <p className="small muted">Only shinies that have been released (LeekDuck shiny checklist). Newest first. “Raid now” = catchable in current raids.</p>
        <WantList items={missingShiny} flag="wantShiny" shiny availableNow={availableNow} />
      </div>
    </div>
  );
}

function WantList({ items, flag, shiny, availableNow }: { items: DexEntry[]; flag: DexFlag; shiny?: boolean; availableNow: Set<number> }) {
  const dex = useDex();
  const [limit, setLimit] = useState(60);
  if (!items.length) return <Empty>Nothing missing. 🎉</Empty>;
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
                    <div className="mon-name">
                      #{e.dex} {e.name} {e.ko && <span className="small muted">{e.ko}</span>}
                    </div>
                    <Types types={e.species.types} small />
                  </div>
                </div>
              </td>
              <td className="small">
                {e.untradeable ? (
                  <span className="pill bad">Not tradeable</span>
                ) : e.legendary ? (
                  <span className="pill warn">Special trade</span>
                ) : null}
                {availableNow.has(e.dex) && <span className="pill good">Raid now</span>}
                {shiny && e.shinyReleased && e.shinyReleased !== 'yes' && <span className="muted"> since {e.shinyReleased.slice(0, 7)}</span>}
              </td>
              <td className="right">
                <label className="check small">
                  <input type="checkbox" checked={dex.sets[flag].has(e.dex)} onChange={() => dex.toggle(flag, e.dex)} /> Want
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > limit && (
        <button style={{ marginTop: 8 }} onClick={() => setLimit(limit + 100)}>
          Show more ({items.length - limit} left)
        </button>
      )}
    </>
  );
}

// ---------------- Can give ----------------

function GiveView() {
  const data = useGameData();
  const { roster, upsert } = useRoster();
  const list = useMemo(() => spares(data, roster), [data, roster]);
  const [limit, setLimit] = useState(80);
  if (!roster.length) return <Empty>Import or add your Pokémon on the “My Pokémon” page first.</Empty>;
  return (
    <div className="card">
      <h2>Trade candidates ({list.length})</h2>
      <p className="small muted">
        Pokémon you've marked “For trade”, plus spare copies (the best copy of each species is kept). Shadows, luckies (already traded once), mythicals, favorites, best buddies and anything marked raid- or PvP-ready are left out.
      </p>
      {list.length === 0 ? (
        <Empty>No spares found. Mark Pokémon “For trade” on the My Pokémon page.</Empty>
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
                        <div className="mon-name">
                          {s.mon.nickname || s.species.name} {s.mon.shiny && '✨'}
                        </div>
                        <div className="small muted">
                          {s.mon.ivs.join('/')} · Lv {s.mon.level}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="small">{s.reason}</td>
                  <td className="right">
                    <label className="check small">
                      <input type="checkbox" checked={!!s.mon.forTrade} onChange={(e) => upsert({ ...s.mon, forTrade: e.target.checked })} /> For trade
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > limit && <button onClick={() => setLimit(limit + 200)}>Show more</button>}
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
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [copied, setCopied] = useState(false);
  const byDex = new Map(entries.map((e) => [e.dex, e]));
  const nm = (d: number) => {
    const e = byDex.get(d);
    return e ? (lang === 'ko' && e.ko ? e.ko : e.name) : `#${d}`;
  };
  const wants = dex.state.want.map(nm);
  const wantShiny = dex.state.wantShiny.map(nm);
  const giving = spares(data, roster)
    .filter((s) => s.mon.forTrade)
    .map((s) => `${s.mon.shiny ? '✨' : ''}${lang === 'ko' ? byDex.get(s.species.dex)?.ko ?? s.species.name : s.species.name}`);
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
          <h2 style={{ margin: 0 }}>Trade post</h2>
          <span className="spacer" />
          <select value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'ko')}>
            <option value="en">English names</option>
            <option value="ko">한국어 이름</option>
          </select>
        </div>
        <p className="small muted">Built from your “Want” / “Want shiny” marks and Pokémon marked “For trade”.</p>
        <textarea readOnly rows={10} style={{ width: '100%' }} value={text || 'Mark some wants and trade candidates first.'} />
        <button
          className="primary"
          disabled={!text}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="card">
        <h2>Pokédex backup</h2>
        <p className="small muted">Your Pokédex marks are saved in this browser. Copy this to move them to another device, or paste a backup here to restore it.</p>
        <textarea rows={6} style={{ width: '100%' }} defaultValue={backup} id="dex-backup" />
        <div className="row">
          <button onClick={() => navigator.clipboard.writeText(backup)}>Copy backup</button>
          <button
            onClick={() => {
              const el = document.getElementById('dex-backup') as HTMLTextAreaElement;
              try {
                dex.replaceAll(JSON.parse(el.value));
                alert('Pokédex restored.');
              } catch {
                alert("That doesn't look like a Pokédex backup.");
              }
            }}
          >
            Restore from box
          </button>
        </div>
      </div>
    </div>
  );
}
