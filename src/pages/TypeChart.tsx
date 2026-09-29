import { useState } from 'react';
import { useGameData } from '../lib/data';
import { effectiveness, WEATHER_TYPES } from '../lib/calc';
import { typeNames, usePrefs, useT, weatherNames } from '../lib/i18n';
import { TypeBadge } from '../components/ui';

// Pokémon GO multipliers (NOT the main-series 2× / ½× / 0×):
//   super effective ×1.6, not very effective ×0.625, "immune" in the main series = ×0.390625 in GO.
const fmt = (m: number) => (m === 1 ? '' : m >= 1 ? `×${+m.toFixed(2)}` : `×${+m.toFixed(3)}`);
const cls = (m: number) => (m > 2 ? 'x256' : m > 1.01 ? 'x16' : m < 0.3 ? 'x024' : m < 0.5 ? 'x039' : m < 0.99 ? 'x0625' : '');

export default function TypeChart() {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  const [def, setDef] = useState<string[]>([]);
  const [atk, setAtk] = useState<string | null>(null);
  const [hl, setHl] = useState<{ r: number; c: number } | null>(null);
  const T = data.types;

  const toggleDef = (type: string) => setDef((d) => (d.includes(type) ? d.filter((x) => x !== type) : [...d.slice(-1), type]));
  const defRows = def.length ? T.map((a) => ({ type: a, m: effectiveness(data, a, def) })).sort((x, y) => y.m - x.m) : [];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{t('Type chart')} · タイプ相性 · Type Chart</h1>
          <p className="muted">{t('Pokémon GO values. They differ from the main-series games (Scarlet/Violet etc.).')}</p>
        </div>
      </div>

      <div className="card">
        <h2>{t('How GO differs from the main series')}</h2>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th>{t('Effect')}</th>
                <th>{t('Main series')} (본가 · 本編)</th>
                <th>Pokémon GO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Super effective')} · 효과가 굉장했다 · 効果はばつぐん</td>
                <td>×2</td>
                <td>
                  <span className="mult x16">×1.6</span>
                </td>
              </tr>
              <tr>
                <td>{t('Double weakness')} · 4배 약점 · 4倍弱点</td>
                <td>×4</td>
                <td>
                  <span className="mult x256">×2.56</span>
                </td>
              </tr>
              <tr>
                <td>{t('Not very effective')} · 효과가 별로인 듯하다 · 効果はいまひとつ</td>
                <td>×0.5</td>
                <td>
                  <span className="mult x0625">×0.625</span>
                </td>
              </tr>
              <tr>
                <td>{t('No effect (immune)')} · 효과가 없다 · 効果はないようだ</td>
                <td>×0</td>
                <td>
                  <span className="mult x039">×0.390625</span> <span className="small muted">{t('— GO has no immunities; it counts as a double resist')}</span>
                </td>
              </tr>
              <tr>
                <td>{t('Double resist')} · 이중 반감 · 二重半減</td>
                <td>×0.25</td>
                <td>
                  <span className="mult x039">×0.390625</span>
                </td>
              </tr>
              <tr>
                <td>{t('Immune + resist')}</td>
                <td>×0</td>
                <td>
                  <span className="mult x024">×0.244</span>
                </td>
              </tr>
              <tr>
                <td>STAB · 자속 보정 · タイプ一致</td>
                <td>×1.5</td>
                <td>×1.2</td>
              </tr>
              <tr>
                <td>{t('Weather boost')} · 날씨 부스트 · 天候ブースト</td>
                <td>—</td>
                <td>×1.2</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">{t('The same chart is used for raids, Max Battles, gyms and PvP (GO Battle League).')}</p>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>{t('Defending: pick 1–2 types')}</h2>
          <div className="row">
            {T.map((type) => (
              <button key={type} className={`type-pick${def.includes(type) ? ' on' : ''}`} onClick={() => toggleDef(type)}>
                <TypeBadge type={type} />
              </button>
            ))}
          </div>
          {def.length > 0 && (
            <div className="stack" style={{ marginTop: 12 }}>
              <MultGroup title={t('Weak to')} rows={defRows.filter((r) => r.m > 1.01)} />
              <MultGroup title={t('Resists')} rows={defRows.filter((r) => r.m < 0.99)} />
            </div>
          )}
        </div>
        <div className="card">
          <h2>{t('Attacking: pick a move type')}</h2>
          <div className="row">
            {T.map((type) => (
              <button key={type} className={`type-pick${atk === type ? ' on' : ''}`} onClick={() => setAtk(atk === type ? null : type)}>
                <TypeBadge type={type} />
              </button>
            ))}
          </div>
          {atk && (
            <div className="stack" style={{ marginTop: 12 }}>
              <MultGroup title={t('Super effective against')} rows={T.map((d) => ({ type: d, m: data.chart[atk][d] })).filter((r) => r.m > 1.01)} />
              <MultGroup title={t('Resisted by')} rows={T.map((d) => ({ type: d, m: data.chart[atk][d] })).filter((r) => r.m < 0.99).sort((a, b) => a.m - b.m)} />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>{t('Full chart')}</h2>
        <p className="small muted">{t('Rows = attacking move type, columns = defending Pokémon type. Blank = ×1.')}</p>
        <div className="table-wrap">
          <table className="type-matrix" onMouseLeave={() => setHl(null)}>
            <thead>
              <tr>
                <th className="corner">
                  {t('ATK')} ↓ / {t('DEF')} →
                </th>
                {T.map((d, c) => (
                  <th key={d} className={hl?.c === c ? 'hl' : ''}>
                    <span className={`vtype t-${d}`} title={`${typeNames(data, d).ko} · ${typeNames(data, d).en} · ${typeNames(data, d).ja}`}>
                      {typeNames(data, d)[lang]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {T.map((a, r) => (
                <tr key={a} className={hl?.r === r ? 'hl' : ''}>
                  <th>
                    <TypeBadge type={a} small />
                  </th>
                  {T.map((d, c) => {
                    const m = data.chart[a][d];
                    return (
                      <td key={d} className={`mult ${cls(m)}${hl?.c === c ? ' hl' : ''}`} onMouseEnter={() => setHl({ r, c })}>
                        {m > 1 ? '1.6' : m < 0.5 ? '0.39' : m < 1 ? '0.625' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row small" style={{ marginTop: 8 }}>
          <span className="mult x16">1.6</span> {t('super effective')}
          <span className="mult x0625">0.625</span> {t('not very effective')}
          <span className="mult x039">0.39</span> {t('double resist (main-series immunity)')}
        </div>
      </div>

      <div className="card">
        <h2>{t('Weather boost')} · 날씨 부스트 · 天候ブースト</h2>
        <p className="small muted">{t('Boosted types deal ×1.2 damage, and wild or raid catches are boosted to a higher level (raid catches: Lv 25 instead of 20).')}</p>
        <table>
          <tbody>
            {Object.entries(WEATHER_TYPES).map(([w, types]) => {
              const n = weatherNames(data, w);
              return (
                <tr key={w}>
                  <td>
                    <strong>{n[lang]}</strong> <span className="small muted">{[n.ko, n.en, n.ja].filter((x) => x !== n[lang]).join(' · ')}</span>
                  </td>
                  <td>
                    <span className="row">
                      {types.map((ty) => (
                        <TypeBadge key={ty} type={ty} />
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MultGroup({ title, rows }: { title: string; rows: { type: string; m: number }[] }) {
  const t = useT();
  if (!rows.length) return null;
  return (
    <div>
      <h3>{title}</h3>
      <div className="row">
        {rows.map((r) => (
          <span key={r.type} className="row" style={{ gap: 3 }}>
            <TypeBadge type={r.type} />
            <span className={`mult ${cls(r.m)}`}>{fmt(r.m) || t('×1')}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
