import { CARDVAULT_BASE_URL, CARDVAULT_CACHE_TTL_MS } from './config.js';

interface CacheEntry {
  result: SearchResult | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(name: string, pitch?: number): string {
  return `${name}|${pitch ?? ''}`;
}

export interface CardFace {
  image?: {
    normal?: string;
  };
  printed_rules_text?: string;
  face_language?: string;
  finish_type?: string;
}

export interface Card {
  card_id: string;
  print_id: string;
  printed_name: string;
  printed_pitch?: string;
  printed_cost?: string;
  printed_power?: string;
  printed_defense?: string;
  card_type_text?: string;
  faces?: CardFace[];
}

interface SearchResponse {
  results: Card[];
  count: number;
}

export interface SearchResult {
  card: Card;
  fuzzy: boolean;
}

export async function searchCard(
  name: string,
  pitch?: number,
): Promise<SearchResult | null> {
  const key = cacheKey(name, pitch);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const params = new URLSearchParams({
    q: name,
    page_size: '10',
    orderby: 'relevance',
  });
  // pitch=0 means "no pitch" (null) — not a valid API param, handled client-side
  if (pitch !== undefined && pitch !== 0) params.set('pitch', String(pitch));

  const url = `${CARDVAULT_BASE_URL}/advanced-search/?${params}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CardVault returned ${res.status}`);

  const data = (await res.json()) as SearchResponse;
  const result = data.results?.length
    ? matchCardFromResults(data.results, name, pitch)
    : null;

  cache.set(key, { result, expiresAt: Date.now() + CARDVAULT_CACHE_TTL_MS });
  return result;
}

function matchCardFromResults(
  results: Card[],
  query: string,
  pitch?: number,
): SearchResult {
  const q = query.toLowerCase();
  const pool =
    pitch === 0 ? results.filter((c) => c.printed_pitch === null) : results;

  const exact = pool.find((c) => c.printed_name.toLowerCase() === q);
  const startsWith = pool.find((c) =>
    c.printed_name.toLowerCase().startsWith(q),
  );
  const includes = pool.find((c) => c.printed_name.toLowerCase().includes(q));

  const card = exact ?? startsWith ?? includes;
  if (card) return { card, fuzzy: false };

  return { card: results[0], fuzzy: true };
}

export function getImageUrl(card: Card): string | null {
  return card.faces?.[0]?.image?.normal ?? null;
}

export function formatCardCaption(card: Card): string {
  const url = `https://cardvault.fabtcg.com/card/${card.card_id}/${card.print_id}`;
  return `<a href="${url}">${card.printed_name}</a>`;
}
