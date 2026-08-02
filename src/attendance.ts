import { supabase } from './db.js';
import { formatDateKey, parseMonthKey } from './calendar.js';

export type Status = 'yes' | 'no' | 'maybe';

export type MonthCounts = Map<string, { yes: number; no: number; maybe: number }>;

export interface DayResponses {
  yes: string[];
  no: string[];
  maybe: string[];
  myStatus: Status | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function setStatus(
  chatId: number,
  date: string,
  userId: number,
  userName: string,
  status: Status,
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('calendar_responses').upsert(
    {
      chat_id: chatId,
      date,
      user_id: userId,
      user_name: userName,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id,date,user_id' },
  );

  if (error) console.error('[attendance] setStatus failed:', error.message);
}

export async function getMonthCounts(
  chatId: number,
  monthKey: string,
): Promise<MonthCounts> {
  const counts: MonthCounts = new Map();
  if (!supabase) return counts;

  const { year, month } = parseMonthKey(monthKey);
  const start = formatDateKey(year, month, 1);
  const end = formatDateKey(year, month, daysInMonth(year, month));

  const { data, error } = await supabase
    .from('calendar_responses')
    .select('date, status')
    .eq('chat_id', chatId)
    .gte('date', start)
    .lte('date', end);

  if (error) {
    console.error('[attendance] getMonthCounts failed:', error.message);
    return counts;
  }

  for (const row of data ?? []) {
    const c = counts.get(row.date) ?? { yes: 0, no: 0, maybe: 0 };
    c[row.status as Status]++;
    counts.set(row.date, c);
  }
  return counts;
}

export async function getDayResponses(
  chatId: number,
  date: string,
  userId: number,
): Promise<DayResponses> {
  const result: DayResponses = { yes: [], no: [], maybe: [], myStatus: null };
  if (!supabase) return result;

  const { data, error } = await supabase
    .from('calendar_responses')
    .select('user_id, user_name, status')
    .eq('chat_id', chatId)
    .eq('date', date);

  if (error) {
    console.error('[attendance] getDayResponses failed:', error.message);
    return result;
  }

  for (const row of data ?? []) {
    result[row.status as Status].push(row.user_name);
    if (row.user_id === userId) result.myStatus = row.status as Status;
  }
  return result;
}
