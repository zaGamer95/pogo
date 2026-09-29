import { useEffect, useState } from 'react';
import type { GameData, Species } from './data';

// ---------------- UI language (ko | en) ----------------

export type Lang = 'ko' | 'en';

const LANG_KEY = 'pogo-lang';
const MOVE_KEY = 'pogo-move-langs';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('ko') ? 'ko' : 'en';
}

interface Prefs {
  lang: Lang;
  /** show all three languages under move names (Pokémon names always show all three) */
  moveAll: boolean;
}

let prefs: Prefs = {
  lang: initialLang(),
  moveAll: (() => {
    try {
      return localStorage.getItem(MOVE_KEY) !== 'compact';
    } catch {
      return true;
    }
  })(),
};
const listeners = new Set<(p: Prefs) => void>();

export function setLang(lang: Lang) {
  prefs = { ...prefs, lang };
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l(prefs));
}

export function setMoveAll(moveAll: boolean) {
  prefs = { ...prefs, moveAll };
  try {
    localStorage.setItem(MOVE_KEY, moveAll ? 'all' : 'compact');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(prefs));
}

export function usePrefs(): Prefs {
  const [p, setP] = useState(prefs);
  useEffect(() => {
    listeners.add(setP);
    return () => void listeners.delete(setP);
  }, []);
  return p;
}

// Korean UI strings live in src/i18n/ko/*.ts, each exporting `default: Record<English, Korean>`.
// Keys are the English text itself, so untranslated strings simply show in English.
const modules = import.meta.glob<{ default: Record<string, string> }>('../i18n/ko/*.ts', { eager: true });
const KO: Record<string, string> = Object.assign({}, ...Object.values(modules).map((m) => m.default));

/** Translate a UI string. `{name}` placeholders are filled from vars. */
export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  let out = lang === 'ko' ? KO[text] ?? text : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export function useT() {
  const { lang } = usePrefs();
  return (text: string, vars?: Record<string, string | number>) => translate(lang, text, vars);
}

// ---------------- Names (always ko / en / ja) ----------------

export interface Tri {
  ko: string;
  en: string;
  ja: string;
}

export function pokeNames(data: GameData, sp: Species | string): Tri {
  const s = typeof sp === 'string' ? data.byId.get(sp) : sp;
  const id = typeof sp === 'string' ? sp : sp.id;
  const en = s?.name ?? id;
  const [ko, ja] = data.i18n.pokemon[id] ?? [en, en];
  return { ko, en, ja };
}

export function moveNames(data: GameData, id: string): Tri {
  const en = data.moves[id]?.name ?? id;
  const [ko, ja] = data.i18n.moves[id] ?? [en, en];
  return { ko, en, ja };
}

export function typeNames(data: GameData, type: string): Tri {
  const en = type[0].toUpperCase() + type.slice(1);
  const [ko, ja] = data.i18n.types[type] ?? [en, en];
  return { ko, en, ja };
}

export function weatherNames(data: GameData, w: string): Tri {
  const en = w.replace(/\b\w/g, (c) => c.toUpperCase());
  const [ko, ja] = data.i18n.weather[w] ?? [en, en];
  return { ko, en, ja };
}

/** League / cup title (English, as used by GBL events & PvPoke) → ko / ja when the game has it. */
export function leagueNames(data: GameData, en: string): Tri {
  const exact = data.i18n.leagues[en] ?? data.i18n.leagues[en.split(':')[0].trim()];
  const jp = data.jpParties?.leagues.find((l) => l.en.toLowerCase() === en.toLowerCase());
  return { en, ko: exact?.[0] ?? en, ja: jp?.ja ?? exact?.[1] ?? en };
}

/** Primary name in the UI language + the other two, in a fixed ko → en → ja order. */
export function ordered(t: Tri, lang: Lang): { primary: string; others: string[] } {
  const primary = t[lang];
  const others = (['ko', 'en', 'ja'] as const).filter((l) => l !== lang).map((l) => t[l]).filter((x) => x && x !== primary);
  return { primary, others };
}

/** Lowercased text containing all three names, for search boxes. */
export function searchText(data: GameData, sp: Species): string {
  const n = pokeNames(data, sp);
  return `${n.ko} ${n.en} ${n.ja} ${sp.dex}`.toLowerCase().normalize('NFKC');
}
