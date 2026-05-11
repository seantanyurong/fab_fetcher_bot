import {
  CARD_PATTERN,
  PITCH_PATTERN,
  PITCH_PATTERN_GLOBAL,
  RATE_MAX,
  RATE_WINDOW_MS,
} from './config.js';

export interface CardQuery {
  name: string;
  pitch?: number;
}

// Extract unique card queries from a message, parsing optional p:N pitch modifier
export function parseQueries(text: string): CardQuery[] {
  const matches = [...text.matchAll(CARD_PATTERN)];
  return [
    ...new Map(
      matches.map((m) => {
        const raw = m[1].trim();
        const pitchMatch = raw.match(PITCH_PATTERN);
        const pitch = pitchMatch ? Number(pitchMatch[1]) : undefined;
        const name = raw
          .replace(PITCH_PATTERN_GLOBAL, '')
          .trim()
          .toLowerCase();
        return [name + (pitch ?? ''), { name, pitch }];
      }),
    ).values(),
  ];
}

// Sliding-window per-user rate limiter
const userTimestamps = new Map<number, number[]>();

export function isRateLimited(userId: number): boolean {
  const now = Date.now();
  const timestamps = (userTimestamps.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (timestamps.length >= RATE_MAX) {
    userTimestamps.set(userId, timestamps);
    return true;
  }
  timestamps.push(now);
  userTimestamps.set(userId, timestamps);
  return false;
}
