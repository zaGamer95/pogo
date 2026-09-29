import { useMemo, useState } from 'react';
import { useGameData, type LeekRaid, type Species } from '../lib/data';
import { cpAtLevel, cpmAt, raidTier, resistances, statsAt, weaknesses, WEATHER_TYPES } from '../lib/calc';
import { resolveName } from '../lib/names';
import { bossMovesets, maxAttackers, maxTanks, rankCounters, rankRoster, rosterStats, type CounterOptions, type CounterRow } from '../lib/raid';
import { useRoster } from '../lib/roster';
import { withDates } from '../lib/events';
import { Empty, MoveName, SpeciesPicker, Sprite, Tabs, Types, TypeBadge, fmtDateTime } from '../components/ui';

type Mode = 'raids' | 'max';

export default function Raids() {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('pogo-raid-mode') as Mode) ?? 'raids');
  const change = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem('pogo-raid-mode', m);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Raids &amp; Max Battles</h1>
          <p className="muted">Current bosses, perfect-IV catch CP, and the best counters, with a separate list for each boss attack.</p>
        </div>
        <Tabs value={mode} onChange={change} options={[{ value: 'raids', label: 'Raid bosses' }, { value: 'max', label: 'Max Battles' }]} />
      </div>
      {mode === 'raids' ? <RaidSection /> : <MaxSection />}
    </div>
  );
}

// ======================= Raids =======================

function RaidSection() {
  const data = useGameData();
  const bosses = useMemo(
    () =>
      data.raids.map((r) => ({ raw: r, ...resolveName(data, r.name) })).filter((b): b is typeof b & { species: Species } => !!b.species),
    [data],
  );
  const [selected, setSelected] = useState(0);
  const tiers = [...new Set(bosses.map((b) => (b.shadow ? 'Shadow ' : '') + b.raw.tier))];
  const boss = bosses[selected];

  return (
    <>
      <div className="card">
        {tiers.map((t) => (
          <div key={t} style={{ marginBottom: 10 }}>
            <h3>{t}</h3>
            <div className="boss-list">
              {bosses.map((b, i) =>
                (b.shadow ? 'Shadow ' : '') + b.raw.tier === t ? (
                  <button key={b.raw.name} className={`boss-btn${i === selected ? ' active' : ''}`} onClick={() => setSelected(i)}>
                    <Sprite src={b.raw.image} size={48} />
                    <span className="mon-name">{b.raw.name}</span>
                    <Types types={b.raw.types.map((x) => x.name)} small />
                  </button>
                ) : null,
              )}
            </div>
          </div>
        ))}
        {bosses.length === 0 && <Empty>No raid bosses in the current data.</Empty>}
      </div>
      {boss && <RaidDetail key={boss.raw.name} raid={boss.raw} species={boss.species} shadow={boss.shadow} />}
    </>
  );
}

function RaidDetail({ raid, species, shadow }: { raid: LeekRaid; species: Species; shadow: boolean }) {
  const data = useGameData();
  const { roster } = useRoster();
  const tier = useMemo(() => raidTier(raid.tier), [raid.tier]);
  const [opts, setOpts] = useState<CounterOptions>({ level: 40, shadows: true, megas: true, legendaries: true, weather: null });
  const [tab, setTab] = useState('all');
  const specs = useMemo(() => bossMovesets(data, species, tier), [data, species, tier]);
  const chargedMoves = [...new Set(specs.map((s) => s.charged))];
  const fastMoves = [...new Set(specs.map((s) => s.fast))];
  const subset = useMemo(() => (tab === 'all' ? specs : specs.filter((s) => s.charged === tab)), [specs, tab]);

  const counters = useMemo(() => rankCounters(data, subset, opts, 15), [data, subset, opts]);
  const mine = useMemo(() => rankRoster(data, roster, subset, opts.weather).slice(0, 6), [data, roster, subset, opts.weather]);
  const ownedIds = new Set(roster.map((m) => (m.shadow ? `${m.speciesId}_shadow` : m.speciesId)));

  const cp20 = cpAtLevel(data, species, [15, 15, 15], 20);
  const cp25 = cpAtLevel(data, species, [15, 15, 15], 25);
  const weak = weaknesses(data, species.types);
  const res = resistances(data, species.types);

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <Sprite src={raid.image} size={88} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ marginBottom: 4 }}>{raid.name}</h2>
          <div className="row">
            <Types types={species.types} />
            <span className="pill">{raid.tier}</span>
            {raid.canBeShiny && <span className="pill warn">✨ Shiny available</span>}
            {shadow && <span className="pill bad">Shadow – catch gets ×1.2 atk</span>}
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">100% CP (Lv 20)</div>
              <div className="v">{cp20}</div>
            </div>
            <div className="stat">
              <div className="k">100% CP boosted (Lv 25)</div>
              <div className="v">{cp25}</div>
            </div>
            <div className="stat">
              <div className="k">CP range</div>
              <div className="v small">
                {raid.combatPower.normal.min}–{raid.combatPower.normal.max}
              </div>
            </div>
            <div className="stat">
              <div className="k">Boosted by</div>
              <div className="v small">{raid.boostedWeather.map((w) => w.name).join(', ') || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div>
          <h3>Weak to</h3>
          <div className="row">
            {weak.map((w) => (
              <span key={w.type} className="row" style={{ gap: 3 }}>
                <TypeBadge type={w.type} />
                <span className="small muted">×{w.mult.toFixed(2)}</span>
              </span>
            ))}
          </div>
          <h3 style={{ marginTop: 10 }}>Resists</h3>
          <div className="row">
            {res.map((w) => (
              <span key={w.type} className="row" style={{ gap: 3 }}>
                <TypeBadge type={w.type} small />
                <span className="small muted">×{w.mult.toFixed(2)}</span>
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3>Boss moves</h3>
          <div className="row small" style={{ marginBottom: 4 }}>
            <span className="muted">Fast:</span>
            {fastMoves.map((m) => (
              <MoveName key={m} id={m} />
            ))}
          </div>
          <div className="row small">
            <span className="muted">Charged:</span>
            {chargedMoves.map((m) => (
              <MoveName key={m} id={m} />
            ))}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <label className="field">
          Attacker level
          <select value={opts.level} onChange={(e) => setOpts({ ...opts, level: Number(e.target.value) })}>
            {[30, 35, 40, 45, 50].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Weather
          <select value={opts.weather ?? ''} onChange={(e) => setOpts({ ...opts, weather: e.target.value || null })}>
            <option value="">Extreme / none</option>
            {Object.keys(WEATHER_TYPES).map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.shadows} onChange={(e) => setOpts({ ...opts, shadows: e.target.checked })} /> Shadows
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.megas} onChange={(e) => setOpts({ ...opts, megas: e.target.checked })} /> Megas
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.legendaries} onChange={(e) => setOpts({ ...opts, legendaries: e.target.checked })} /> Legendaries
        </label>
      </div>

      <p className="small muted" style={{ marginBottom: 6 }}>
        Counters vs boss charged move:
      </p>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[{ value: 'all', label: 'All movesets' }, ...chargedMoves.map((m) => ({ value: m, label: <MoveName id={m} /> }))]}
      />

      <div className="grid cols-2">
        <div>
          <h3>Top counters (Lv {opts.level}, perfect IVs)</h3>
          <CounterTable rows={counters} owned={ownedIds} />
        </div>
        <div>
          <h3>Your best 6</h3>
          {mine.length === 0 ? (
            <Empty>Add Pokémon on the “My Pokémon” page to see your own best counters here.</Empty>
          ) : (
            <CounterTable rows={mine} showLevel />
          )}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Score = (DPS³ × TDO)^¼ using an estimate in the style of GamePress/Pokebattler. It doesn't account for dodging, party power, or friend bonuses, so use it to compare counters, not to predict exact results.
      </p>
    </div>
  );
}

function CounterTable({ rows, owned, showLevel }: { rows: CounterRow[]; owned?: Set<string>; showLevel?: boolean }) {
  const data = useGameData();
  const top = rows[0]?.er ?? 1;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pokémon</th>
            <th>Moves</th>
            <th className="right">DPS</th>
            <th className="right">TDO</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.roster?.uid ?? r.species.id) + i} className={owned?.has(r.species.id) ? 'mine' : ''}>
              <td>
                <div className="mon">
                  <Sprite species={r.species} size={32} />
                  <div>
                    <div className="mon-name">
                      {r.roster?.nickname || r.species.name}
                      {owned?.has(r.species.id) && (
                        <span className="pill good" style={{ marginLeft: 4 }}>
                          owned
                        </span>
                      )}
                    </div>
                    {showLevel && r.roster && (
                      <div className="small muted">
                        Lv {r.roster.level} · {r.roster.ivs.join('/')}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="small">
                <MoveName id={r.fast} elite={r.species.elite.includes(r.fast)} /> /{' '}
                <MoveName id={r.charged} elite={r.species.elite.includes(r.charged)} />
                {!data.moves[r.charged]?.pve && <span className="muted"> ?</span>}
              </td>
              <td className="right">{r.dps.toFixed(1)}</td>
              <td className="right">{r.tdo.toFixed(0)}</td>
              <td style={{ minWidth: 70 }}>
                <div className="bar">
                  <span style={{ width: `${(r.er / top) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ======================= Max Battles =======================

interface MaxBoss {
  name: string;
  species: Species;
  gmax: boolean;
  when?: string;
  link?: string;
  custom?: boolean;
}

const CUSTOM_KEY = 'pogo-max-custom';

function loadCustom(): { id: string; gmax: boolean }[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function MaxSection() {
  const data = useGameData();
  const [custom, setCustom] = useState(loadCustom);
  const [adding, setAdding] = useState<string | undefined>();
  const [addGmax, setAddGmax] = useState(false);

  const saveCustom = (next: { id: string; gmax: boolean }[]) => {
    setCustom(next);
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const bosses = useMemo(() => {
    const now = new Date();
    const out: MaxBoss[] = [];
    for (const e of withDates(data.events)) {
      if (!['max-battles', 'max-mondays'].includes(e.eventType) || e.endDate < now) continue;
      const m = e.name.match(/(Dynamax|Gigantamax)\s+(.+?)(?:\s+(?:during|Max Battle|in Max|Max Monday)\b.*)?$/i);
      if (!m) continue;
      const species = resolveName(data, m[2]).species;
      if (!species) continue;
      out.push({ name: `${m[1]} ${species.name}`, species, gmax: /giga/i.test(m[1]), when: `${fmtDateTime(e.startDate)} → ${fmtDateTime(e.endDate)}`, link: e.link });
    }
    for (const c of custom) {
      const species = data.byId.get(c.id);
      if (species) out.push({ name: `${c.gmax ? 'Gigantamax' : 'Dynamax'} ${species.name}`, species, gmax: c.gmax, custom: true });
    }
    return out;
  }, [data, custom]);

  const [selected, setSelected] = useState(0);
  const boss = bosses[Math.min(selected, bosses.length - 1)];

  return (
    <>
      <div className="card">
        <p className="small muted">
          LeekDuck doesn't publish a feed of the current Max Battle bosses, so this list is built from Max Monday and Max Battle Day events. Add any other bosses you see at Power Spots below. They're saved in this browser.
        </p>
        <div className="boss-list" style={{ marginBottom: 12 }}>
          {bosses.map((b, i) => (
            <button key={b.name + i} className={`boss-btn${b === boss ? ' active' : ''}`} onClick={() => setSelected(i)}>
              <Sprite species={b.species} size={48} />
              <span className="mon-name">{b.name}</span>
              <Types types={b.species.types} small />
              {b.when && <span className="tier">{b.when}</span>}
              {b.custom && (
                <span
                  className="tier"
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveCustom(custom.filter((c) => !(c.id === b.species.id && c.gmax === b.gmax)));
                  }}
                >
                  ✕ remove
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="row">
          <SpeciesPicker value={adding} onChange={setAdding} placeholder="Add a Max Battle boss…" />
          <label className="check">
            <input type="checkbox" checked={addGmax} onChange={(e) => setAddGmax(e.target.checked)} /> Gigantamax
          </label>
          <button
            className="primary"
            disabled={!adding}
            onClick={() => {
              if (!adding) return;
              saveCustom([...custom, { id: adding, gmax: addGmax }]);
              setAdding(undefined);
              setSelected(bosses.length);
            }}
          >
            Add boss
          </button>
        </div>
      </div>
      {boss ? <MaxDetail key={boss.name} boss={boss} /> : <Empty>No Max Battle bosses yet. Add one above.</Empty>}
    </>
  );
}

function MaxDetail({ boss }: { boss: MaxBoss }) {
  const data = useGameData();
  const { roster } = useRoster();
  const [allSpecies, setAllSpecies] = useState(false);
  const sp = boss.species;
  const weak = weaknesses(data, sp.types);

  const pool = useMemo(() => {
    const cpm = cpmAt(data, 40);
    return data.pokemon
      .filter((s) => s.released && !s.tags.includes('shadow') && !s.tags.includes('mega') && (allSpecies || s.dmax || s.gmax))
      .map((s) => ({ species: s, stats: statsAt(s, [15, 15, 15], cpm), gmax: false }));
  }, [data, allSpecies]);

  const attackers = useMemo(() => maxAttackers(data, sp, pool).slice(0, 12), [data, sp, pool]);
  const tanks = useMemo(() => maxTanks(data, sp, pool).slice(0, 12), [data, sp, pool]);

  const mine = useMemo(() => {
    const c = roster
      .filter((m) => m.dynamax)
      .map((m) => {
        const rs = rosterStats(data, m);
        return rs && { ...rs, fixedFast: m.fast, roster: m, gmax: m.dynamax === 'gmax' };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { attackers: maxAttackers(data, sp, c).slice(0, 6), tanks: maxTanks(data, sp, c).slice(0, 6) };
  }, [data, roster, sp]);

  const bossChargedTypes = [...new Set(sp.charged.map((m) => data.moves[m]?.type).filter(Boolean))] as string[];

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <Sprite species={sp} size={88} />
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: 4 }}>{boss.name}</h2>
          <div className="row">
            <Types types={sp.types} />
            {boss.link && (
              <a href={boss.link} target="_blank" rel="noreferrer" className="small">
                Event details ↗
              </a>
            )}
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">100% catch CP (Lv 20)</div>
              <div className="v">{cpAtLevel(data, sp, [15, 15, 15], 20)}</div>
            </div>
            <div className="stat">
              <div className="k">Lv 40 max CP</div>
              <div className="v">{cpAtLevel(data, sp, [15, 15, 15], 40)}</div>
            </div>
            <div className="stat">
              <div className="k">Weak to</div>
              <div className="v">
                <span className="row">
                  {weak.map((w) => (
                    <TypeBadge key={w.type} type={w.type} small />
                  ))}
                </span>
              </div>
            </div>
            <div className="stat">
              <div className="k">Attacks with</div>
              <div className="v">
                <span className="row">
                  {bossChargedTypes.map((t) => (
                    <TypeBadge key={t} type={t} small />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <label className="check" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={allSpecies} onChange={(e) => setAllSpecies(e.target.checked)} /> Include all species (the game data only flags {data.pokemon.filter((p) => p.dmax).length} Dynamax-capable
        species)
      </label>
      <div className="grid cols-2">
        <MaxTable title="Best Max attackers" rows={attackers} attack />
        <MaxTable title="Best tanks (Max Guard / Spirit)" rows={tanks} />
      </div>
      <h3 style={{ marginTop: 16 }}>Your Dynamax Pokémon</h3>
      {mine.attackers.length === 0 ? (
        <Empty>Mark Pokémon as Dynamax or Gigantamax on the “My Pokémon” page to rank them here.</Empty>
      ) : (
        <div className="grid cols-2">
          <MaxTable title="Your attackers" rows={mine.attackers} attack />
          <MaxTable title="Your tanks" rows={mine.tanks} />
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>
        Max Move damage uses the fast move's type (G-Max moves use the Pokémon's own type), so attackers are ranked by Attack × STAB × type effectiveness. Tanks are ranked by Defense × HP against the boss's attack types.
      </p>
    </div>
  );
}

function MaxTable({ title, rows, attack }: { title: string; rows: ReturnType<typeof maxAttackers>; attack?: boolean }) {
  const top = rows[0]?.score ?? 1;
  return (
    <div>
      <h3>{title}</h3>
      <table>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.roster?.uid ?? r.species.id) + i}>
              <td>
                <div className="mon">
                  <Sprite species={r.species} size={30} />
                  <span className="mon-name">{r.roster?.nickname || r.species.name}</span>
                  {r.species.gmax && <span className="pill accent">G-Max</span>}
                </div>
              </td>
              <td className="small">
                {attack ? (
                  <>
                    <MoveName id={r.fast} /> <span className="muted">{r.detail}</span>
                  </>
                ) : (
                  <span className="muted">{r.detail}</span>
                )}
              </td>
              <td style={{ width: 80 }}>
                <div className="bar">
                  <span style={{ width: `${(r.score / top) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
