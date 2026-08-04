import { supabase } from './db.js';

export async function getLocation(
  chatId: number,
  date: string,
): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('calendar_locations')
    .select('location')
    .eq('chat_id', chatId)
    .eq('date', date)
    .maybeSingle();

  if (error) {
    console.error('[locations] getLocation failed:', error.message);
    return null;
  }
  return data?.location ?? null;
}

export async function setLocation(
  chatId: number,
  date: string,
  location: string,
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('calendar_locations').upsert(
    { chat_id: chatId, date, location, updated_at: new Date().toISOString() },
    { onConflict: 'chat_id,date' },
  );

  if (error) console.error('[locations] setLocation failed:', error.message);
}
