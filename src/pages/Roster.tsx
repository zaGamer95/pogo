import { useMemo, useRef, useState } from 'react';
import { useGameData, type Species } from '../lib/data';
import { cpAtLevel, levelFromCP, LEVELS, pvpIvRank, type IVs } from '../lib/calc';
import { exportRoster, importPokeGenieCsv, mergePokeGenie, newUid, parseRosterJson, useRoster, type RosterMon } from '../lib/roster';
import { Empty, MoveName, SpeciesPicker, Sprite, Types } from '../components/ui';

function blank(): RosterMon {
  return { uid: newUid(), speciesId: '', ivs: [15, 15, 15], level: 40, charged: [], source: 'manual', addedAt: Date.now() };
}

export default function Roster() {
  const data = useGameData();
  const { roster, upsert, remove, addMany, replaceAll } = useRoster();
  const [editing, setEditing] = useState<RosterMon | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'raid' | 'pvp' | 'dmax' | 'shiny' | 'trade'>('all');
  const [limit, setLimit] = useState(100);
  const [sort, setSort] = useState<'cp' | 'name' | 'iv' | 'recent' | 'gl' | 'ul'>('cp');
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const list = roster
      .map((m) => {
        const sp = data.byId.get(m.speciesId);
        if (!sp) return null;
        const cp = cpAtLevel(data, sp, m.ivs, m.level);
        const maxLvl = m.bestBuddy ? 51 : 50;
        return {
          m,
          sp,
          cp,
          ivPct: ((m.ivs[0] + m.ivs[1] + m.ivs[2]) / 45) * 100,
          gl: pvpIvRank(data, sp, m.ivs, 1500, maxLvl),
          ul: pvpIvRank(data, sp, m.ivs, 2500, maxLvl),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const n = q.trim().toLowerCase();
    return list
      .filter((r) => !n || r.sp.name.toLowerCase().includes(n) || r.m.nickname?.toLowerCase().includes(n) || r.sp.types.some((t) => t === n))
      .filter((r) => filter === 'all' || (filter === 'raid' && r.m.raidReady) || (filter === 'pvp' && r.m.pvpReady) || (filter === 'dmax' && r.m.dynamax) || (filter === 'shiny' && r.m.shiny) || (filter === 'trade' && r.m.forTrade))
      .sort((a, b) => {
        switch (sort) {
          case 'name':
            return a.sp.name.localeCompare(b.sp.name);
          case 'iv':
            return b.ivPct - a.ivPct;
          case 'recent':
            return b.m.addedAt - a.m.addedAt;
          case 'gl':
            return (a.gl?.rank ?? 9999) - (b.gl?.rank ?? 9999);
          case 'ul':
            return (a.ul?.rank ?? 9999) - (b.ul?.rank ?? 9999);
          default:
            return b.cp - a.cp;
        }
      });
  }, [roster, data, q, filter, sort]);

  const download = () => {
    const blob = new Blob([exportRoster(roster)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pogo-roster-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        const { added, skipped } = importPokeGenieCsv(data, text);
        const { roster: next, kept, removed } = mergePokeGenie(roster, added);
        replaceAll(next);
        setMsg(`Imported ${added.length} Pokémon from Poke Genie (${kept} matched earlier imports and kept your flags, ${removed} no longer in the export were removed; manual entries untouched).${skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? '…' : ''}` : ''}`);
      } else {
        const list = parseRosterJson(text);
        if (roster.length && !confirm(`Replace your ${roster.length} saved Pokémon with ${list.length} from this backup? Cancel to merge instead.`)) {
          const have = new Set(roster.map((r) => r.uid));
          addMany(list.filter((r) => !have.has(r.uid)));
          setMsg(`Merged backup into your roster.`);
        } else {
          replaceAll(list);
          setMsg(`Restored ${list.length} Pokémon from backup.`);
        }
      }
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>My Pokémon</h1>
          <p className="muted">
            {roster.length} saved · {roster.filter((m) => m.raidReady).length} raid-ready · {roster.filter((m) => m.pvpReady).length} PvP-ready · saved in this browser only
          </p>
        </div>
        <div className="row">
          <button className="primary" onClick={() => setEditing(blank())}>
            + Add Pokémon
          </button>
          <button onClick={() => fileRef.current?.click()}>Import (Poke Genie CSV / backup)</button>
          <button onClick={download} disabled={!roster.length}>
            Export backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {msg && (
        <div className="card row">
          <span>{msg}</span>
          <span className="spacer" />
          <button onClick={() => setMsg(null)}>OK</button>
        </div>
      )}

      {editing && (
        <Editor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(m) => {
            upsert(m);
            setEditing(null);
          }}
        />
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder="Search name, nickname or type…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All</option>
            <option value="raid">Raid-ready</option>
            <option value="pvp">PvP-ready</option>
            <option value="dmax">Dynamax / Gigantamax</option>
            <option value="shiny">Shiny</option>
            <option value="trade">For trade</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="cp">Sort: CP</option>
            <option value="name">Sort: Name</option>
            <option value="iv">Sort: IV %</option>
            <option value="gl">Sort: Great League IV rank</option>
            <option value="ul">Sort: Ultra League IV rank</option>
            <option value="recent">Sort: Recently added</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty>
            {roster.length ? 'Nothing matches that filter.' : 'No Pokémon yet. Add them one at a time, or import a CSV exported from Poke Genie (Poke Genie → Settings → Export data).'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pokémon</th>
                  <th className="right">CP</th>
                  <th>IVs</th>
                  <th>Moves</th>
                  <th title="IV rank for Great League (1 = best of 4096)">GL rank</th>
                  <th title="IV rank for Ultra League">UL rank</th>
                  <th>Ready</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map(({ m, sp, cp, ivPct, gl, ul }) => (
                  <tr key={m.uid}>
                    <td>
                      <div className="mon">
                        <Sprite species={sp} size={36} />
                        <div>
                          <div className="mon-name">
                            {m.nickname || sp.name}
                            {m.shadow && <span className="pill bad" style={{ marginLeft: 4 }}>Shadow</span>}
                            {m.purified && <span className="pill accent" style={{ marginLeft: 4 }}>Purified</span>}
                            {m.shiny && <span className="pill warn" style={{ marginLeft: 4 }}>✨</span>}
                            {m.forTrade && <span className="pill good" style={{ marginLeft: 4 }}>Trade</span>}
                            {m.lucky && <span className="pill warn" style={{ marginLeft: 4 }}>Lucky</span>}
                            {m.dynamax && <span className="pill accent" style={{ marginLeft: 4 }}>{m.dynamax === 'gmax' ? 'G-Max' : 'D-Max'}</span>}
                          </div>
                          <div className="small muted">
                            {m.nickname ? `${sp.name} · ` : ''}Lv {m.level} <Types types={sp.types} small />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="right">{cp}</td>
                    <td className="nowrap">
                      {m.ivs.join('/')} <span className="small muted">{ivPct.toFixed(0)}%</span>
                    </td>
                    <td className="small">
                      {m.fast ? <MoveName id={m.fast} elite={sp.elite.includes(m.fast)} /> : <span className="muted">—</span>}
                      {m.charged.map((c) => (
                        <span key={c}>
                          {' '}
                          / <MoveName id={c} elite={sp.elite.includes(c)} />
                        </span>
                      ))}
                    </td>
                    <td className="small nowrap">{gl ? <RankCell r={gl} /> : <span className="muted">over cap</span>}</td>
                    <td className="small nowrap">{ul ? <RankCell r={ul} /> : <span className="muted">over cap</span>}</td>
                    <td>
                      <label className="check small">
                        <input type="checkbox" checked={!!m.raidReady} onChange={(e) => upsert({ ...m, raidReady: e.target.checked })} /> Raid
                      </label>
                      <label className="check small">
                        <input type="checkbox" checked={!!m.pvpReady} onChange={(e) => upsert({ ...m, pvpReady: e.target.checked })} /> PvP
                      </label>
                      <label className="check small">
                        <input type="checkbox" checked={!!m.forTrade} onChange={(e) => upsert({ ...m, forTrade: e.target.checked })} /> Trade
                      </label>
                    </td>
                    <td className="nowrap">
                      <button onClick={() => setEditing(m)}>Edit</button>{' '}
                      <button
                        className="danger"
                        onClick={() => {
                          if (confirm(`Remove ${m.nickname || sp.name}?`)) remove(m.uid);
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > limit && (
              <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
                <span className="muted small">
                  Showing {limit} of {rows.length}
                </span>
                <button onClick={() => setLimit(limit + 200)}>Show more</button>
                <button onClick={() => setLimit(rows.length)}>Show all</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RankCell({ r }: { r: NonNullable<ReturnType<typeof pvpIvRank>> }) {
  const cls = r.rank <= 100 ? 'good' : r.rank <= 500 ? 'warn' : '';
  return (
    <span title={`CP ${r.cp} at Lv ${r.level} · ${r.percent.toFixed(1)}% of rank 1`}>
      <span className={`pill ${cls}`}>#{r.rank}</span> <span className="muted">{r.percent.toFixed(1)}%</span>
    </span>
  );
}

function Editor({ initial, onSave, onCancel }: { initial: RosterMon; onSave: (m: RosterMon) => void; onCancel: () => void }) {
  const data = useGameData();
  const [m, setM] = useState<RosterMon>(initial);
  const [cpInput, setCpInput] = useState('');
  const sp: Species | undefined = m.speciesId ? data.byId.get(m.speciesId) : undefined;
  const set = (patch: Partial<RosterMon>) => setM((prev) => ({ ...prev, ...patch }));
  const setIv = (i: number, v: string) => {
    const ivs = [...m.ivs] as IVs;
    ivs[i] = Math.max(0, Math.min(15, Number(v) || 0));
    set({ ivs });
  };
  const cp = sp ? cpAtLevel(data, sp, m.ivs, m.level) : null;
  const cpMismatch = sp && cpInput && Number(cpInput) !== cp;

  return (
    <div className="card">
      <h2>{initial.speciesId ? 'Edit Pokémon' : 'Add Pokémon'}</h2>
      <div className="roster-form">
        <label className="field">
          Species
          <SpeciesPicker
            value={m.speciesId}
            onChange={(id) => {
              const s = data.byId.get(id);
              set({ speciesId: id, fast: s?.fast[0], charged: s?.charged.slice(0, 1) ?? [] });
            }}
          />
        </label>
        <label className="field">
          Nickname (optional)
          <input value={m.nickname ?? ''} onChange={(e) => set({ nickname: e.target.value || undefined })} />
        </label>
        <label className="field">
          IVs (Atk / Def / HP)
          <span className="iv-inputs">
            {[0, 1, 2].map((i) => (
              <input key={i} type="number" min={0} max={15} value={m.ivs[i]} onChange={(e) => setIv(i, e.target.value)} />
            ))}
          </span>
        </label>
        <label className="field">
          Level {cp !== null && <span>→ CP {cp}</span>}
          <select value={m.level} onChange={(e) => set({ level: Number(e.target.value) })}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          …or enter the CP to find the level
          <span className="row" style={{ flexWrap: 'nowrap' }}>
            <input type="number" style={{ width: 90 }} value={cpInput} onChange={(e) => setCpInput(e.target.value)} />
            <button
              disabled={!sp || !cpInput}
              onClick={() => {
                if (!sp) return;
                const lvl = levelFromCP(data, sp, m.ivs, Number(cpInput));
                if (lvl) set({ level: lvl });
                else alert('No level matches that CP with these IVs. Double-check the IVs.');
              }}
            >
              Find
            </button>
          </span>
          {cpMismatch && <span style={{ color: 'var(--accent-2)' }}>Doesn't match the current level</span>}
        </label>
        {sp && (
          <>
            <label className="field">
              Fast move
              <select value={m.fast ?? ''} onChange={(e) => set({ fast: e.target.value || undefined })}>
                <option value="">—</option>
                {sp.fast.map((f) => (
                  <option key={f} value={f}>
                    {data.moves[f]?.name ?? f} ({data.moves[f]?.type}){sp.elite.includes(f) ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </label>
            {[0, 1].map((i) => (
              <label className="field" key={i}>
                Charged move {i + 1}
                <select
                  value={m.charged[i] ?? ''}
                  onChange={(e) => {
                    const charged = [...m.charged];
                    charged[i] = e.target.value;
                    set({ charged: charged.filter(Boolean) });
                  }}
                >
                  <option value="">—</option>
                  {sp.charged.map((c) => (
                    <option key={c} value={c}>
                      {data.moves[c]?.name ?? c} ({data.moves[c]?.type}){sp.elite.includes(c) ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </>
        )}
        <label className="field">
          Dynamax
          <select value={m.dynamax ?? ''} onChange={(e) => set({ dynamax: (e.target.value || undefined) as RosterMon['dynamax'] })}>
            <option value="">No</option>
            <option value="dmax">Dynamax</option>
            <option value="gmax">Gigantamax</option>
          </select>
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <label className="check">
          <input type="checkbox" checked={!!m.shadow} onChange={(e) => set({ shadow: e.target.checked, purified: e.target.checked ? false : m.purified })} /> Shadow
        </label>
        <label className="check">
          <input type="checkbox" checked={!!m.purified} onChange={(e) => set({ purified: e.target.checked, shadow: e.target.checked ? false : m.shadow })} /> Purified
        </label>
        <label className="check">
          <input type="checkbox" checked={!!m.lucky} onChange={(e) => set({ lucky: e.target.checked })} /> Lucky
        </label>
        <label className="check">
          <input type="checkbox" checked={!!m.shiny} onChange={(e) => set({ shiny: e.target.checked })} /> Shiny
        </label>
        <label className="check">
          <input type="checkbox" checked={!!m.forTrade} onChange={(e) => set({ forTrade: e.target.checked })} /> For trade
        </label>
        <label className="check">
          <input type="checkbox" checked={!!m.bestBuddy} onChange={(e) => set({ bestBuddy: e.target.checked })} /> Best Buddy (Lv 51 cap)
        </label>
        <label className="check">
          <input type="checkbox" checked={!!m.raidReady} onChange={(e) => set({ raidReady: e.target.checked })} /> Raid-ready
        </label>
        <label className="check">
          <input type="checkbox" checked={!!m.pvpReady} onChange={(e) => set({ pvpReady: e.target.checked })} /> PvP-ready
        </label>
      </div>
      <label className="field" style={{ marginTop: 10 }}>
        Notes
        <input value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="e.g. needs Elite TM, save for Mega" />
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" disabled={!sp} onClick={() => onSave(m)}>
          Save
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
