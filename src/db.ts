import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

export let supabase: SupabaseClient | null = null;
if (url && key) {
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('Supabase client initialized');
} else {
  console.log(
    'Supabase disabled (set SUPABASE_URL and SUPABASE_SECRET_KEY to enable)',
  );
}
