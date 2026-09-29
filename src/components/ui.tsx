import { useMemo, useState, type ReactNode } from 'react';
import { spriteUrl, useGameData, type Species } from '../lib/data';
import { moveNames, ordered, pokeNames, searchText, typeNames, usePrefs, useT } from '../lib/i18n';

export function TypeBadge({ type, small }: { type: string; small?: boolean }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const n = typeNames(data, type);
  return (
    <span className={`type t-${type}${small ? ' small' : ''}`} title={`${n.ko} · ${n.en} · ${n.ja}`}>
      {n[lang]}
    </span>
  );
}

/**
 * Pokémon name in all three languages: the UI language first (bold), then the other two small.
 * `inline` puts everything on one line (for tight spots like chips).
 */
export function PokeName({ species, id, nickname, inline, className }: { species?: Species; id?: string; nickname?: string; inline?: boolean; className?: string }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const sp = species ?? (id ? data.byId.get(id) : undefined);
  const tri = pokeNames(data, sp ?? id ?? '?');
  const { primary, others } = ordered(tri, lang);
  return (
    <span className={`pname${inline ? ' inline' : ''}${className ? ' ' + className : ''}`} title={`${tri.ko} / ${tri.en} / ${tri.ja}`}>
      <span className="mon-name">{nickname ? `${nickname} ` : ''}{nickname ? <span className="muted">({primary})</span> : primary}</span>
      {others.length > 0 && <span className="pname-alt">{others.join(' · ')}</span>}
    </span>
  );
}

export function Types({ types, small }: { types: string[]; small?: boolean }) {
  return (
    <span className="types">
      {types.map((t) => (
        <TypeBadge key={t} type={t} small={small} />
      ))}
    </span>
  );
}

export function Sprite({ species, src, size = 40 }: { species?: Species; src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = src ?? (species ? spriteUrl(species.dex) : undefined);
  if (!url || failed) return <span className="sprite placeholder" style={{ width: size, height: size }} />;
  return <img className="sprite" src={url} width={size} height={size} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

export function MoveName({ id, elite }: { id: string; elite?: boolean }) {
  const data = useGameData();
  const { lang, moveAll } = usePrefs();
  const t = useT();
  const m = data.moves[id];
  if (!m) return <span className="move">{id}</span>;
  const tri = moveNames(data, id);
  const { primary, others } = ordered(tri, lang);
  const type = typeNames(data, m.type)[lang];
  return (
    <span className={`move m-${m.type}${moveAll ? ' tri' : ''}`} title={`${tri.ko} / ${tri.en} / ${tri.ja}\n${type} · ${t(m.fast ? 'fast move' : 'charged move')}`}>
      <span>
        {primary}
        {elite && <sup title={t('Elite / legacy move')}>★</sup>}
      </span>
      {moveAll && others.length > 0 && <span className="move-alt">{others.join(' · ')}</span>}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Searchable species picker (type to filter, click to choose). */
export function SpeciesPicker({ value, onChange, filter, placeholder }: { value?: string; onChange: (id: string) => void; filter?: (s: Species) => boolean; placeholder?: string }) {
  const data = useGameData();
  const { lang } = usePrefs();
  const t = useT();
  placeholder ??= t('Search Pokémon (한국어 / English / 日本語)…');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = value ? data.byId.get(value) : undefined;
  const results = useMemo(() => {
    const n = q.trim().toLowerCase().normalize('NFKC');
    if (!n) return [];
    const starts = (p: Species) => Object.values(pokeNames(data, p)).some((x) => x.toLowerCase().normalize('NFKC').startsWith(n));
    return data.pokemon
      .filter((p) => !p.id.endsWith('_shadow') && (!filter || filter(p)))
      .filter((p) => searchText(data, p).includes(n) || String(p.dex) === n)
      .sort((a, b) => Number(!starts(a)) - Number(!starts(b)) || a.dex - b.dex)
      .slice(0, 12);
  }, [q, data, filter]);

  return (
    <div className="picker">
      <input
        value={open ? q : selected ? pokeNames(data, selected)[lang] : q}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQ('');
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
      />
      {open && results.length > 0 && (
        <ul className="picker-list">
          {results.map((p) => (
            <li
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p.id);
                setOpen(false);
                setQ('');
              }}
            >
              <Sprite species={p} size={28} />
              <PokeName species={p} />
              <Types types={p.types} small />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return d.toLocaleDateString(undefined, opts);
}

export function fmtDateTime(d: Date) {
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
