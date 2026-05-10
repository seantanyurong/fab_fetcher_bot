const BASE_URL = "https://api.cardvault.fabtcg.com/carddb/api/v1";

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

export async function searchCard(name: string): Promise<SearchResult | null> {
  const url = `${BASE_URL}/advanced-search/?q=${encodeURIComponent(name)}&page_size=10`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CardVault returned ${res.status}`);

  const data = (await res.json()) as SearchResponse;
  if (!data.results || data.results.length === 0) return null;

  const q = name.toLowerCase();
  const exact = data.results.find((c) => c.printed_name.toLowerCase() === q);
  const startsWith = data.results.find((c) =>
    c.printed_name.toLowerCase().startsWith(q)
  );
  const includes = data.results.find((c) =>
    c.printed_name.toLowerCase().includes(q)
  );

  const card = exact ?? startsWith ?? includes;
  if (card) return { card, fuzzy: false };

  // No name match — trust API's top result as a fuzzy match
  return { card: data.results[0], fuzzy: true };
}

export function getImageUrl(card: Card): string | null {
  return card.faces?.[0]?.image?.normal ?? null;
}

export function formatCardCaption(card: Card): string {
  const lines: string[] = [`<b>${card.printed_name}</b>`];

  if (card.card_type_text) lines.push(`<i>${card.card_type_text}</i>`);

  const stats: string[] = [];
  if (card.printed_pitch) stats.push(`Pitch: ${card.printed_pitch}`);
  if (card.printed_cost) stats.push(`Cost: ${card.printed_cost}`);
  if (card.printed_power) stats.push(`Power: ${card.printed_power}`);
  if (card.printed_defense) stats.push(`Defense: ${card.printed_defense}`);
  if (stats.length) lines.push(stats.join("  ·  "));

  const rulesText = card.faces?.[0]?.printed_rules_text;
  if (rulesText) lines.push(`\n${rulesText}`);

  return lines.join("\n");
}
