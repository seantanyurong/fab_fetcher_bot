import { supabase } from './db.js';

export interface LookupEvent {
  chat_id: number;
  user_id: number;
  card_name: string;
  pitch?: number;
  found: boolean;
  fuzzy?: boolean;
  result_card_id?: string;
  result_card_name?: string;
  result_print_id?: string;
}

/**
 * Fire-and-forget log of a single card lookup. Never throws — DB failures
 * are logged but don't block the user reply.
 */
export function logLookup(event: LookupEvent): void {
  if (!supabase) return;

  const row = {
    chat_id: event.chat_id,
    user_id: event.user_id,
    card_name: event.card_name,
    pitch: event.pitch ?? null,
    found: event.found,
    fuzzy: event.fuzzy ?? false,
    result_card_id: event.result_card_id ?? null,
    result_card_name: event.result_card_name ?? null,
    result_print_id: event.result_print_id ?? null,
  };

  supabase
    .from('lookups')
    .insert(row)
    .then(({ error }) => {
      if (error) console.error('[analytics] insert failed:', error.message);
    });
}
