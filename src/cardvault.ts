const BASE_URL = 'https://api.cardvault.fabtcg.com/carddb/api/v1';

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
  const params = new URLSearchParams({
    q: name,
    page_size: "10",
    orderby: "relevance",
  });
  if (pitch !== undefined) params.set("pitch", String(pitch));

  const url = `${BASE_URL}/advanced-search/?${params}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CardVault returned ${res.status}`);

  const data = (await res.json()) as SearchResponse;
  if (!data.results || data.results.length === 0) return null;

  return matchCardFromResults(data.results, name);
}

function matchCardFromResults(results: Card[], query: string): SearchResult {
  const q = query.toLowerCase();
  const exact = results.find((c) => c.printed_name.toLowerCase() === q);
  const startsWith = results.find((c) =>
    c.printed_name.toLowerCase().startsWith(q),
  );
  const includes = results.find((c) =>
    c.printed_name.toLowerCase().includes(q),
  );

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
