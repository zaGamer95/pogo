import { createContext, useContext } from 'react';

export type PokeType = string;

export interface Species {
  id: string;
  name: string;
  dex: number;
  types: PokeType[];
  atk: number;
  def: number;
  hp: number;
  fast: string[];
  charged: string[];
  elite: string[];
  tags: string[];
  family?: string;
  released: boolean;
  dmax?: boolean;
  gmax?: boolean;
}

export interface Move {
  name: string;
  type: PokeType;
  fast: boolean;
  pvp: { power: number; energy: number; turns?: number; buffs?: number[]; buffTarget?: string; chance?: string };
  pve: { power: number; dur: number; energy: number } | null;
}

export interface LeekEvent {
  eventID: string;
  name: string;
  eventType: string;
  heading: string;
  link: string;
  image: string;
  start: string;
  end: string;
  extraData?: Record<string, unknown>;
}

export interface LeekRaid {
  name: string;
  tier: string;
  canBeShiny: boolean;
  types: { name: string }[];
  combatPower: { normal: { min: number; max: number }; boosted: { min: number; max: number } };
  boostedWeather: { name: string }[];
  image: string;
}

export interface PvpFormat {
  key: string;
  title: string;
  cup: string;
  cp: number;
  rules?: string[];
}

export interface RankEntry {
  id: string;
  score: number;
  moves: string[];
  rating?: number;
  scores?: number[];
  wins?: string[];
  losses?: string[];
  product?: number;
}

export type Rankings = Partial<Record<'overall' | 'leads' | 'closers' | 'switches' | 'attackers' | 'chargers', RankEntry[]>>;

export interface ShinyEntry {
  dex: number;
  form: string | null; // null = base form; e.g. "ALOLA", "MEGA", "GIGANTAMAX", costume ids
  released: string | null; // YYYY-MM-DD
}

export interface NewsItem {
  title: string;
  link: string;
  date: string;
}

export interface I18nData {
  pokemon: Record<string, [string, string]>; // id → [ko, ja]
  moves: Record<string, [string, string]>;
  types: Record<string, [string, string]>;
  weather: Record<string, [string, string]>;
  leagues: Record<string, [string, string]>; // English title → [ko, ja]
}

export interface JpParty {
  rank: number;
  count: number;
  members: { dex: number; ja: string; shadow: boolean; id: string | null }[];
}

export interface JpLeague {
  id: number;
  ja: string;
  en: string;
  cp: number;
  rule: string;
  all: JpParty[];
  high: JpParty[];
  usage: { id: string; n: number }[];
}

export interface JpParties {
  source: string;
  season: number;
  fetched: string;
  leagues: JpLeague[];
}

export interface GameData {
  pokemon: Species[];
  byId: Map<string, Species>;
  moves: Record<string, Move>;
  types: PokeType[];
  chart: Record<PokeType, Record<PokeType, number>>;
  cpm: number[];
  events: LeekEvent[];
  raids: LeekRaid[];
  formats: PvpFormat[];
  shinies: ShinyEntry[];
  names: Record<string, { en: string; ko: string }>;
  news: NewsItem[];
  i18n: I18nData;
  jpParties: JpParties | null;
  meta: { updated: string; pvpokeUpdated: string };
}

const base = import.meta.env.BASE_URL;

async function load<T>(file: string): Promise<T> {
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) throw new Error(`Failed to load ${file} (${res.status})`);
  return res.json();
}

export async function loadGameData(): Promise<GameData> {
  const [pokemon, moves, typeData, cpm, events, raids, formats, meta, shinies, names, news, i18n, jpParties] = await Promise.all([
    load<Species[]>('pokemon.json'),
    load<Record<string, Move>>('moves.json'),
    load<{ types: string[]; chart: Record<string, Record<string, number>> }>('types.json'),
    load<number[]>('cpm.json'),
    load<LeekEvent[]>('events.json'),
    load<LeekRaid[]>('raids.json'),
    load<PvpFormat[]>('pvp/formats.json'),
    load<GameData['meta']>('meta.json'),
    load<ShinyEntry[]>('shinies.json').catch(() => []),
    load<GameData['names']>('names.json').catch(() => ({})),
    load<NewsItem[]>('news.json').catch(() => []),
    load<I18nData>('i18n.json').catch(() => ({ pokemon: {}, moves: {}, types: {}, weather: {}, leagues: {} })),
    load<JpParties>('jp-parties.json').catch(() => null),
  ]);
  return {
    pokemon,
    byId: new Map(pokemon.map((p) => [p.id, p])),
    moves,
    types: typeData.types,
    chart: typeData.chart,
    cpm,
    events,
    raids,
    formats,
    shinies,
    names,
    news,
    i18n,
    jpParties,
    meta,
  };
}

const rankingCache = new Map<string, Promise<Rankings>>();
export function loadRankings(key: string): Promise<Rankings> {
  if (!rankingCache.has(key)) rankingCache.set(key, load<Rankings>(`pvp/${key}.json`));
  return rankingCache.get(key)!;
}

export const DataContext = createContext<GameData | null>(null);

export function useGameData(): GameData {
  const data = useContext(DataContext);
  if (!data) throw new Error('Game data not loaded');
  return data;
}

export function spriteUrl(dex: number, shiny = false): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? 'shiny/' : ''}${dex}.png`;
}
