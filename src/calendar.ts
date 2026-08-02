import { InlineKeyboard } from 'grammy';
import type { DayResponses, MonthCounts } from './attendance.js';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayMonthKey(): string {
  return todayKey().slice(0, 7);
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
}

export function shiftMonth(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 0 = Monday .. 6 = Sunday
function firstWeekdayOfMonth(year: number, month: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (jsDay + 6) % 7;
}

export function formatMonthLabel(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateLong(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildMonthKeyboard(
  monthKey: string,
  counts: MonthCounts,
): InlineKeyboard {
  const { year, month } = parseMonthKey(monthKey);
  const kb = new InlineKeyboard()
    .text('◀', `cal:m:${shiftMonth(monthKey, -1)}`)
    .text(formatMonthLabel(monthKey), 'cal:x')
    .text('▶', `cal:m:${shiftMonth(monthKey, 1)}`)
    .row();

  for (const label of WEEKDAY_LABELS) kb.text(label, 'cal:x');
  kb.row();

  const totalDays = daysInMonth(year, month);
  let col = 0;

  const pad = () => {
    kb.text(' ', 'cal:x');
    col++;
  };
  const advance = () => {
    col++;
    if (col === 7) {
      kb.row();
      col = 0;
    }
  };

  for (let i = 0; i < firstWeekdayOfMonth(year, month); i++) {
    pad();
    if (col === 7) {
      kb.row();
      col = 0;
    }
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateKey = formatDateKey(year, month, day);
    const yes = counts.get(dateKey)?.yes ?? 0;
    const label = yes > 0 ? `${day} ✅${yes}` : `${day}`;
    kb.text(label, `cal:d:${dateKey}`);
    advance();
  }

  if (col > 0) {
    while (col < 7) pad();
    kb.row();
  }

  return kb;
}

export function buildDayView(
  dateKey: string,
  responses: DayResponses,
): { text: string; keyboard: InlineKeyboard } {
  const isPast = dateKey < todayKey();

  const lines = [`📅 <b>${formatDateLong(dateKey)}</b>`, ''];
  lines.push(`✅ Attending (${responses.yes.length})`);
  lines.push(responses.yes.length ? responses.yes.join(', ') : '—');
  lines.push('');
  lines.push(`🤔 Maybe (${responses.maybe.length})`);
  lines.push(responses.maybe.length ? responses.maybe.join(', ') : '—');
  lines.push('');
  lines.push(`❌ Not attending (${responses.no.length})`);
  lines.push(responses.no.length ? responses.no.join(', ') : '—');
  if (isPast) {
    lines.push('');
    lines.push('<i>This date has passed — responses are locked.</i>');
  }

  const kb = new InlineKeyboard();
  if (!isPast) {
    kb.text(
      responses.myStatus === 'yes' ? "✅ I'm in ✓" : "✅ I'm in",
      `cal:s:${dateKey}:y`,
    )
      .text(
        responses.myStatus === 'maybe' ? '🤔 Maybe ✓' : '🤔 Maybe',
        `cal:s:${dateKey}:m`,
      )
      .text(
        responses.myStatus === 'no' ? "❌ Can't make it ✓" : "❌ Can't make it",
        `cal:s:${dateKey}:n`,
      )
      .row();
  }
  kb.text('◀ Back', `cal:m:${dateKey.slice(0, 7)}`);

  return { text: lines.join('\n'), keyboard: kb };
}
