import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGameData, type Species } from '../lib/data';
import { raidTier } from '../lib/calc';
import { resolveName } from '../lib/names';
import { assignRoles, bestTeams, myCandidates, type MyPvpCandidate } from '../lib/pvp';
import { bossMovesets, rankRoster } from '../lib/raid';
import { useRoster } from '../lib/roster';
import { useRankings } from '../components/useRankings';
import { LeaguePicker, defaultLeague } from '../components/LeaguePicker';
import { Empty, MoveName, PokeName, Sprite, Tabs, TypeBadge, Types } from '../components/ui';
import { pokeNames, usePrefs, useT } from '../lib/i18n';

/** "Shadow " + LeekDuck tier ("5-Star Raids", "Mega Raids", …) in the UI language. */
function tierLabel(t: (s: string) => string, tier: string, shadow?: boolean) {
  return (shadow ? t('Shadow ') : '') + t(tier);
}

export default function Teams() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') as 'pvp' | 'raid') ?? 'pvp';
  const t = useT();
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{t('My Teams')}</h1>
          <p className="muted">{t('Your strongest teams, built only from the Pokémon saved on the “My Pokémon” page.')}</p>
        </div>
        <Tabs
          value={mode}
          onChange={(m) => setParams((p) => ({ ...Object.fromEntries(p), mode: m }))}
          options={[
            { value: 'pvp', label: t('PvP team') },
            { value: 'raid', label: t('Raid party') },
          ]}
        />
      </div>
      {mode === 'pvp' ? <PvpTeams /> : <RaidParty />}
    </div>
  );
}

function PvpTeams() {
  const data = useGameData();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const key = params.get('league') ?? defaultLeague(data);
  const format = data.formats.find((f) => f.key === key);
  const { rankings } = useRankings(key);
  const { roster } = useRoster();
  const [onlyReady, setOnlyReady] = useState(false);

  const pool = onlyReady ? roster.filter((m) => m.pvpReady) : roster;
  const cands = useMemo(() => (rankings && format ? myCandidates(data, pool, format, rankings) : []), [data, pool, format, rankings]);
  const teams = useMemo(() => bestTeams(data, cands), [data, cands]);

  return (
    <>
      <div className="card row">
        <label className="field">
          {t('League')}
          <LeaguePicker value={key} onChange={(k) => setParams((p) => ({ ...Object.fromEntries(p), league: k }))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> {t('Only Pokémon marked PvP-ready')}
        </label>
        <span className="spacer" />
        <Link to={`/meta/${key}`}>{t('See the meta for this league')} →</Link>
      </div>
      {!rankings && <div className="loading">{t('Loading rankings…')}</div>}
      {rankings && roster.length === 0 && <Empty>{t('Add your Pokémon on the “My Pokémon” page first.')}</Empty>}
      {rankings && roster.length > 0 && cands.length < 3 && (
        <Empty>{t('Fewer than 3 of your Pokémon are ranked in this league. Try another league or add more Pokémon.')}</Empty>
      )}
      {teams.map((tm, i) => (
        <div className="card" key={i}>
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{i === 0 ? t('Best team') : t('Alternative {n}', { n: i })}</h2>
            <span className="spacer" />
            <span className="small muted">{t('Shared weaknesses:')}</span>
            {tm.weak.length ? tm.weak.map((w) => <TypeBadge key={w} type={w} small />) : <span className="pill good">{t('none')}</span>}
          </div>
          <div className="team">
            {assignRoles(tm.members).map(({ role, m }) => (
              <CandidateSlot key={m.mon.uid} role={role} c={m} cap={format?.cp ?? 1500} />
            ))}
          </div>
        </div>
      ))}
      {cands.length > 0 && (
        <div className="card">
          <h2>{t('All your eligible Pokémon')}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Pokémon')}</th>
                  <th className="right">{t('Meta #')}</th>
                  <th>{t('IV rank')}</th>
                  <th>{t('Level / CP at cap')}</th>
                  <th>{t('Recommended moves')}</th>
                  <th className="right">{t('Value')}</th>
                </tr>
              </thead>
              <tbody>
                {cands.slice(0, 40).map((c) => (
                  <tr key={c.mon.uid}>
                    <td>
                      <div className="mon">
                        <Sprite species={c.species} size={30} />
                        <PokeName species={c.species} nickname={c.mon.nickname || undefined} />
                      </div>
                    </td>
                    <td className="right">{c.metaRank}</td>
                    <td className="small">
                      #{c.iv.rank} <span className="muted">({c.iv.percent.toFixed(1)}%)</span>
                    </td>
                    <td className="small">
                      Lv {c.iv.level} / {c.iv.cp}
                      {c.mon.level < c.iv.level && <span className="pill warn" style={{ marginLeft: 4 }}>{t('needs power-up (now Lv {level})', { level: c.mon.level })}</span>}
                    </td>
                    <td className="small">
                      {c.rank.moves.map((m, j) => (
                        <span key={m}>
                          {j > 0 && ' / '}
                          <MoveName id={m} elite={c.species.elite.includes(m)} />
                        </span>
                      ))}
                      {!c.movesMatch && c.mon.fast && <span className="pill warn" style={{ marginLeft: 4 }}>{t('yours differ')}</span>}
                    </td>
                    <td className="right">{c.value.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            {t(
              "Value = PvPoke score × (IV stat product vs. rank 1)³, with a small penalty when your fast move isn't the recommended one. In Master League it also scales with current level.",
            )}
          </p>
        </div>
      )}
    </>
  );
}

function CandidateSlot({ role, c, cap }: { role: string; c: MyPvpCandidate; cap: number }) {
  const t = useT();
  return (
    <div className="team-slot">
      <span className="role">{t(role)}</span>
      <Sprite species={c.species} size={56} />
      <PokeName species={c.species} nickname={c.mon.nickname || undefined} />
      <Types types={c.species.types} small />
      <span className="small muted">
        {t('Meta #{meta} · IV #{iv}', { meta: c.metaRank, iv: c.iv.rank })}
      </span>
      <span className="small">
        {cap < 10000 ? `Lv ${c.iv.level} → CP ${c.iv.cp}` : `Lv ${c.mon.level}`}
        {c.mon.level < c.iv.level && cap < 10000 && <span className="pill warn">{t('power up')}</span>}
      </span>
      <span className="small">
        {c.rank.moves.map((m, j) => (
          <span key={m}>
            {j > 0 && ' · '}
            <MoveName id={m} elite={c.species.elite.includes(m)} />
          </span>
        ))}
      </span>
    </div>
  );
}

function RaidParty() {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const { roster } = useRoster();
  const [onlyReady, setOnlyReady] = useState(false);
  const bosses = useMemo(
    () => data.raids.map((r) => ({ raw: r, ...resolveName(data, r.name) })).filter((b): b is typeof b & { species: Species } => !!b.species),
    [data],
  );
  const [idx, setIdx] = useState(() => Math.max(0, bosses.findIndex((b) => /5-star|mega/i.test(b.raw.tier))));
  const boss = bosses[idx];
  const pool = onlyReady ? roster.filter((m) => m.raidReady) : roster;
  const party = useMemo(() => {
    if (!boss) return [];
    const specs = bossMovesets(data, boss.species, raidTier(boss.raw.tier));
    return rankRoster(data, pool, specs, null).slice(0, 6);
  }, [data, boss, pool]);

  return (
    <>
      <div className="card row">
        <label className="field">
          {t('Raid boss')}
          <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
            {bosses.map((b, i) => (
              <option key={b.raw.name} value={i}>
                {(b.shadow ? t('Shadow ') : '') + pokeNames(data, b.species)[lang]} ({tierLabel(t, b.raw.tier)})
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> {t('Only Pokémon marked raid-ready')}
        </label>
        <span className="spacer" />
        <Link to="/raids">{t('Full counter list')} →</Link>
      </div>
      {party.length === 0 ? (
        <Empty>{t('No usable Pokémon yet. Add some on the “My Pokémon” page.')}</Empty>
      ) : (
        <div className="card">
          <h2>
            {t('Best party vs')} {boss && <PokeName species={boss.species} inline />}
            {boss?.shadow && (
              <span className="pill bad" style={{ marginLeft: 6 }}>
                {t('Shadow')}
              </span>
            )}
          </h2>
          <div className="team six">
            {party.map((r, i) => (
              <div className="team-slot" key={r.roster!.uid}>
                <span className="role">#{i + 1}</span>
                <Sprite species={r.species} size={56} />
                <PokeName species={r.species} nickname={r.roster!.nickname || undefined} />
                <span className="small muted">
                  Lv {r.roster!.level} · {r.roster!.ivs.join('/')}
                </span>
                <span className="small">
                  <MoveName id={r.fast} /> · <MoveName id={r.charged} />
                </span>
                <span className="small muted">
                  {r.dps.toFixed(1)} DPS · {r.tdo.toFixed(0)} TDO
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
