import { useMemo, useState } from 'react';
import { useGameData, type LeekRaid, type Species } from '../lib/data';
import { cpAtLevel, cpmAt, raidTier, resistances, statsAt, weaknesses, WEATHER_TYPES } from '../lib/calc';
import { resolveName } from '../lib/names';
import { bossMovesets, maxAttackers, maxTanks, rankCounters, rankRoster, rosterStats, type CounterOptions, type CounterRow } from '../lib/raid';
import { useRoster } from '../lib/roster';
import { withDates } from '../lib/events';
import { Empty, MoveName, PokeName, SpeciesPicker, Sprite, Tabs, Types, TypeBadge, fmtDateTime } from '../components/ui';
import { usePrefs, useT, weatherNames } from '../lib/i18n';

type Mode = 'raids' | 'max';

/** "Shadow " + LeekDuck tier ("5-Star Raids", "Mega Raids", …) in the UI language. */
function tierLabel(t: (s: string) => string, tier: string, shadow?: boolean) {
  return (shadow ? t('Shadow ') : '') + t(tier);
}

/** Weather name in the UI language, with the other two languages in parentheses. */
function weatherLabel(data: ReturnType<typeof useGameData>, w: string, lang: 'ko' | 'en') {
  const n = weatherNames(data, w);
  const others = (['ko', 'en', 'ja'] as const).filter((l) => l !== lang).map((l) => n[l]).filter((x) => x !== n[lang]);
  return others.length ? `${n[lang]} (${[...new Set(others)].join(' · ')})` : n[lang];
}

export default function Raids() {
  const t = useT();
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
          <h1>{t('Raids & Max Battles')}</h1>
          <p className="muted">{t('Current bosses, perfect-IV catch CP, and the best counters, with a separate list for each boss attack.')}</p>
        </div>
        <Tabs value={mode} onChange={change} options={[{ value: 'raids', label: t('Raid bosses') }, { value: 'max', label: t('Max Battles') }]} />
      </div>
      {mode === 'raids' ? <RaidSection /> : <MaxSection />}
    </div>
  );
}

// ======================= Raids =======================

function RaidSection() {
  const data = useGameData();
  const t = useT();
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
        {tiers.map((tr) => (
          <div key={tr} style={{ marginBottom: 10 }}>
            <h3>{tr.startsWith('Shadow ') ? tierLabel(t, tr.slice(7), true) : tierLabel(t, tr)}</h3>
            <div className="boss-list">
              {bosses.map((b, i) =>
                (b.shadow ? 'Shadow ' : '') + b.raw.tier === tr ? (
                  <button key={b.raw.name} className={`boss-btn${i === selected ? ' active' : ''}`} onClick={() => setSelected(i)}>
                    <Sprite src={b.raw.image} size={48} />
                    <PokeName species={b.species} />
                    {b.shadow && <span className="pill bad">{t('Shadow')}</span>}
                    <Types types={b.raw.types.map((x) => x.name)} small />
                  </button>
                ) : null,
              )}
            </div>
          </div>
        ))}
        {bosses.length === 0 && <Empty>{t('No raid bosses in the current data.')}</Empty>}
      </div>
      {boss && <RaidDetail key={boss.raw.name} raid={boss.raw} species={boss.species} shadow={boss.shadow} />}
    </>
  );
}

function RaidDetail({ raid, species, shadow }: { raid: LeekRaid; species: Species; shadow: boolean }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
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
          <h2 style={{ marginBottom: 4 }}>
            <PokeName species={species} />
            {shadow && (
              <span className="pill bad" style={{ marginLeft: 6 }}>
                {t('Shadow')}
              </span>
            )}
          </h2>
          <div className="row">
            <Types types={species.types} />
            <span className="pill">{tierLabel(t, raid.tier)}</span>
            {raid.canBeShiny && <span className="pill warn">✨ {t('Shiny available')}</span>}
            {shadow && <span className="pill bad">{t('Shadow – catch gets ×1.2 atk')}</span>}
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">{t('100% CP (Lv 20)')}</div>
              <div className="v">{cp20}</div>
            </div>
            <div className="stat">
              <div className="k">{t('100% CP boosted (Lv 25)')}</div>
              <div className="v">{cp25}</div>
            </div>
            <div className="stat">
              <div className="k">{t('CP range')}</div>
              <div className="v small">
                {raid.combatPower.normal.min}–{raid.combatPower.normal.max}
              </div>
            </div>
            <div className="stat">
              <div className="k">{t('Boosted by')}</div>
              <div className="v small">{raid.boostedWeather.map((w) => weatherLabel(data, w.name, lang)).join(', ') || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <div>
          <h3>{t('Weak to')}</h3>
          <div className="row">
            {weak.map((w) => (
              <span key={w.type} className="row" style={{ gap: 3 }}>
                <TypeBadge type={w.type} />
                <span className="small muted">×{w.mult.toFixed(2)}</span>
              </span>
            ))}
          </div>
          <h3 style={{ marginTop: 10 }}>{t('Resists')}</h3>
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
          <h3>{t('Boss moves')}</h3>
          <div className="row small" style={{ marginBottom: 4 }}>
            <span className="muted">{t('Fast:')}</span>
            {fastMoves.map((m) => (
              <MoveName key={m} id={m} />
            ))}
          </div>
          <div className="row small">
            <span className="muted">{t('Charged:')}</span>
            {chargedMoves.map((m) => (
              <MoveName key={m} id={m} />
            ))}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <label className="field">
          {t('Attacker level')}
          <select value={opts.level} onChange={(e) => setOpts({ ...opts, level: Number(e.target.value) })}>
            {[30, 35, 40, 45, 50].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('Weather')}
          <select value={opts.weather ?? ''} onChange={(e) => setOpts({ ...opts, weather: e.target.value || null })}>
            <option value="">{t('Extreme / none')}</option>
            {Object.keys(WEATHER_TYPES).map((w) => (
              <option key={w} value={w}>
                {weatherLabel(data, w, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.shadows} onChange={(e) => setOpts({ ...opts, shadows: e.target.checked })} /> {t('Shadows')}
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.megas} onChange={(e) => setOpts({ ...opts, megas: e.target.checked })} /> {t('Megas')}
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.legendaries} onChange={(e) => setOpts({ ...opts, legendaries: e.target.checked })} /> {t('Legendaries')}
        </label>
      </div>

      <p className="small muted" style={{ marginBottom: 6 }}>
        {t('Counters vs boss charged move:')}
      </p>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[{ value: 'all', label: t('All movesets') }, ...chargedMoves.map((m) => ({ value: m, label: <MoveName id={m} /> }))]}
      />

      <div className="grid cols-2">
        <div>
          <h3>{t('Top counters (Lv {level}, perfect IVs)', { level: opts.level })}</h3>
          <CounterTable rows={counters} owned={ownedIds} />
        </div>
        <div>
          <h3>{t('Your best 6')}</h3>
          {mine.length === 0 ? (
            <Empty>{t('Add Pokémon on the “My Pokémon” page to see your own best counters here.')}</Empty>
          ) : (
            <CounterTable rows={mine} showLevel />
          )}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        {t("Score = (DPS³ × TDO)^¼ using an estimate in the style of GamePress/Pokebattler. It doesn't account for dodging, party power, or friend bonuses, so use it to compare counters, not to predict exact results.")}
      </p>
    </div>
  );
}

function CounterTable({ rows, owned, showLevel }: { rows: CounterRow[]; owned?: Set<string>; showLevel?: boolean }) {
  const data = useGameData();
  const t = useT();
  const top = rows[0]?.er ?? 1;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('Pokémon')}</th>
            <th>{t('Moves')}</th>
            <th className="right">DPS</th>
            <th className="right">TDO</th>
            <th>{t('Score')}</th>
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
                      <PokeName species={r.species} nickname={r.roster?.nickname || undefined} />
                      {owned?.has(r.species.id) && (
                        <span className="pill good" style={{ marginLeft: 4 }}>
                          {t('owned')}
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
  const t = useT();
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
          {t(
            "LeekDuck doesn't publish a feed of the current Max Battle bosses, so this list is built from Max Monday and Max Battle Day events. Add any other bosses you see at Power Spots below. They're saved in this browser.",
          )}
        </p>
        <div className="boss-list" style={{ marginBottom: 12 }}>
          {bosses.map((b, i) => (
            <button key={b.name + i} className={`boss-btn${b === boss ? ' active' : ''}`} onClick={() => setSelected(i)}>
              <Sprite species={b.species} size={48} />
              <span className="pill accent">{t(b.gmax ? 'Gigantamax' : 'Dynamax')}</span>
              <PokeName species={b.species} />
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
                  ✕ {t('remove')}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="row">
          <SpeciesPicker value={adding} onChange={setAdding} placeholder={t('Add a Max Battle boss…')} />
          <label className="check">
            <input type="checkbox" checked={addGmax} onChange={(e) => setAddGmax(e.target.checked)} /> {t('Gigantamax')}
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
            {t('Add boss')}
          </button>
        </div>
      </div>
      {boss ? <MaxDetail key={boss.name} boss={boss} /> : <Empty>{t('No Max Battle bosses yet. Add one above.')}</Empty>}
    </>
  );
}

function MaxDetail({ boss }: { boss: MaxBoss }) {
  const data = useGameData();
  const t = useT();
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
          <h2 style={{ marginBottom: 4 }}>
            <span className="pill accent" style={{ marginRight: 6 }}>
              {t(boss.gmax ? 'Gigantamax' : 'Dynamax')}
            </span>
            <PokeName species={sp} />
          </h2>
          <div className="row">
            <Types types={sp.types} />
            {boss.link && (
              <a href={boss.link} target="_blank" rel="noreferrer" className="small">
                {t('Event details')} ↗
              </a>
            )}
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">{t('100% catch CP (Lv 20)')}</div>
              <div className="v">{cpAtLevel(data, sp, [15, 15, 15], 20)}</div>
            </div>
            <div className="stat">
              <div className="k">{t('Lv 40 max CP')}</div>
              <div className="v">{cpAtLevel(data, sp, [15, 15, 15], 40)}</div>
            </div>
            <div className="stat">
              <div className="k">{t('Weak to')}</div>
              <div className="v">
                <span className="row">
                  {weak.map((w) => (
                    <TypeBadge key={w.type} type={w.type} small />
                  ))}
                </span>
              </div>
            </div>
            <div className="stat">
              <div className="k">{t('Attacks with')}</div>
              <div className="v">
                <span className="row">
                  {bossChargedTypes.map((ty) => (
                    <TypeBadge key={ty} type={ty} small />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <label className="check" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={allSpecies} onChange={(e) => setAllSpecies(e.target.checked)} />{' '}
        {t('Include all species (the game data only flags {n} Dynamax-capable species)', { n: data.pokemon.filter((p) => p.dmax).length })}
      </label>
      <div className="grid cols-2">
        <MaxTable title={t('Best Max attackers')} rows={attackers} attack />
        <MaxTable title={t('Best tanks (Max Guard / Spirit)')} rows={tanks} />
      </div>
      <h3 style={{ marginTop: 16 }}>{t('Your Dynamax Pokémon')}</h3>
      {mine.attackers.length === 0 ? (
        <Empty>{t('Mark Pokémon as Dynamax or Gigantamax on the “My Pokémon” page to rank them here.')}</Empty>
      ) : (
        <div className="grid cols-2">
          <MaxTable title={t('Your attackers')} rows={mine.attackers} attack />
          <MaxTable title={t('Your tanks')} rows={mine.tanks} />
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>
        {t(
          "Max Move damage uses the fast move's type (G-Max moves use the Pokémon's own type), so attackers are ranked by Attack × STAB × type effectiveness. Tanks are ranked by Defense × HP against the boss's attack types.",
        )}
      </p>
    </div>
  );
}

function MaxTable({ title, rows, attack }: { title: string; rows: ReturnType<typeof maxAttackers>; attack?: boolean }) {
  const t = useT();
  const top = rows[0]?.score ?? 1;
  const detail = (d: string) => {
    const m = d.match(/^takes (\S+) worst-case$/);
    return m ? t('takes {m} worst-case', { m: m[1] }) : d;
  };
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
                  <PokeName species={r.species} nickname={r.roster?.nickname || undefined} />
                  {r.species.gmax && <span className="pill accent">{t('G-Max')}</span>}
                </div>
              </td>
              <td className="small">
                {attack ? (
                  <>
                    <MoveName id={r.fast} /> <span className="muted">{detail(r.detail)}</span>
                  </>
                ) : (
                  <span className="muted">{detail(r.detail)}</span>
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
