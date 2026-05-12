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
const lastNotifiedAt = new Map<number, number>();

export interface RateLimitResult {
  limited: boolean;
  shouldNotify: boolean;
}

export function checkRateLimit(userId: number): RateLimitResult {
  const now = Date.now();
  const timestamps = (userTimestamps.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );

  if (timestamps.length >= RATE_MAX) {
    userTimestamps.set(userId, timestamps);
    // Only notify once per window — silently drop subsequent over-limit messages
    const lastNotify = lastNotifiedAt.get(userId) ?? 0;
    const shouldNotify = now - lastNotify >= RATE_WINDOW_MS;
    if (shouldNotify) lastNotifiedAt.set(userId, now);
    return { limited: true, shouldNotify };
  }

  timestamps.push(now);
  userTimestamps.set(userId, timestamps);
  return { limited: false, shouldNotify: false };
}
