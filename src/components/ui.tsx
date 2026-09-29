import { useMemo, useState, type ReactNode } from 'react';
import { spriteUrl, useGameData, type Species } from '../lib/data';

export function TypeBadge({ type, small }: { type: string; small?: boolean }) {
  return <span className={`type t-${type}${small ? ' small' : ''}`}>{type}</span>;
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
  const m = data.moves[id];
  if (!m) return <span className="move">{id}</span>;
  return (
    <span className={`move m-${m.type}`} title={`${m.type} · ${m.fast ? 'fast' : 'charged'}`}>
      {m.name}
      {elite && <sup title="Elite / legacy move">★</sup>}
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
export function SpeciesPicker({ value, onChange, filter, placeholder = 'Search Pokémon…' }: { value?: string; onChange: (id: string) => void; filter?: (s: Species) => boolean; placeholder?: string }) {
  const data = useGameData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = value ? data.byId.get(value) : undefined;
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return data.pokemon
      .filter((p) => !p.id.endsWith('_shadow') && (!filter || filter(p)))
      .filter((p) => p.name.toLowerCase().includes(n) || String(p.dex) === n)
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(n)) - Number(!b.name.toLowerCase().startsWith(n)) || a.dex - b.dex)
      .slice(0, 12);
  }, [q, data, filter]);

  return (
    <div className="picker">
      <input
        value={open ? q : selected?.name ?? q}
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
              <span>{p.name}</span>
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
