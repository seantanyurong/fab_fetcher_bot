import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | null = null;
if (url && key) {
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('Supabase analytics enabled');
} else {
  console.log(
    'Supabase analytics disabled (set SUPABASE_URL and SUPABASE_SECRET_KEY to enable)',
  );
}

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
  if (!client) return;

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

  client
    .from('lookups')
    .insert(row)
    .then(({ error }) => {
      if (error) console.error('[analytics] insert failed:', error.message);
    });
}
