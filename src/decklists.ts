import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import {
  DECKLIST_BASE_URL,
  DECKLIST_URL,
  DECKLIST_CACHE_TTL_MS,
  DECKLIST_HERO_LIST_CACHE_TTL_MS,
  DECKLIST_TIMEOUT_MS,
  DECKLIST_DEFAULT_NUM,
  DECKLIST_FORMAT,
} from './config.js';

const execFileAsync = promisify(execFile);

// The only header the WAF actually checks — curl's default UA (curl/x.x)
// gets a bare 403; a browser-style one is all it takes to pass. Verified
// live that Accept/Accept-Language/Referer make no difference either way.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

// Result-detail links look like /decklists/<slug>/ — a single, non-empty
// path segment. Nav/filter/pagination links on the same page are either the
// bare decklists root, /<lang>/decklists/, or /decklists/feed/.
const RESULT_LINK_PATTERN = /^\/decklists\/([^/]+)\/?$/;

export class HeroNotFoundError extends Error {
  constructor(public readonly query: string) {
    super(`No hero found matching "${query}"`);
    this.name = 'HeroNotFoundError';
  }
}

export interface Decklist {
  text: string;
  url: string;
}

export interface DecklistSearch {
  hero: string;
  fuzzy: boolean;
  decklists: Decklist[];
}

interface CacheEntry {
  result: Decklist[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

let heroListCache: { heroes: string[]; expiresAt: number } | null = null;

export async function getDecklists(
  heroQuery: string,
  num: number = DECKLIST_DEFAULT_NUM,
): Promise<DecklistSearch> {
  const resolved = await resolveHero(heroQuery);
  if (!resolved) throw new HeroNotFoundError(heroQuery);

  const key = `${resolved.hero.toLowerCase()}|${num}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { hero: resolved.hero, fuzzy: resolved.fuzzy, decklists: cached.result };
  }

  const html = await fetchDecklistsHtml(resolved.hero);
  const decklists = extractDecklists(html).slice(0, num);

  cache.set(key, {
    result: decklists,
    expiresAt: Date.now() + DECKLIST_CACHE_TTL_MS,
  });
  return { hero: resolved.hero, fuzzy: resolved.fuzzy, decklists };
}

// decklist_hero is a fixed <select> on the site, not a search box — an exact
// string match is required. Fuzzy-resolve the user's query against the real
// option list the same way CardVault lookups fuzzy-match card names.
async function resolveHero(
  query: string,
): Promise<{ hero: string; fuzzy: boolean } | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const heroes = await getHeroList();

  const exact = heroes.find((h) => h.toLowerCase() === q);
  if (exact) return { hero: exact, fuzzy: false };

  const startsWith = heroes.find((h) => h.toLowerCase().startsWith(q));
  if (startsWith) return { hero: startsWith, fuzzy: true };

  const includes = heroes.find((h) => h.toLowerCase().includes(q));
  if (includes) return { hero: includes, fuzzy: true };

  return null;
}

async function getHeroList(): Promise<string[]> {
  if (heroListCache && heroListCache.expiresAt > Date.now()) {
    return heroListCache.heroes;
  }

  const html = await curlGetWithSession(DECKLIST_URL);
  const $ = cheerio.load(html);
  const heroes: string[] = [];
  $('#hero-filter option').each((_, el) => {
    const value = $(el).attr('value')?.trim();
    if (value) heroes.push(value);
  });

  heroListCache = {
    heroes,
    expiresAt: Date.now() + DECKLIST_HERO_LIST_CACHE_TTL_MS,
  };
  return heroes;
}

async function fetchDecklistsHtml(hero: string): Promise<string> {
  const params = new URLSearchParams({
    decklist_format: DECKLIST_FORMAT,
    decklist_hero: hero,
    decklist_event: '',
  });
  return curlGetWithSession(DECKLIST_URL, params);
}

// fabtcg.com sits behind a WAF that blocks Node's native fetch (undici) at
// the TLS-fingerprint level — same headers/cookies, but fetch gets a bare
// 403 where curl gets a normal 200. Shelling out to curl (via execFile, so
// query values are passed as literal argv values — never shell-interpreted)
// routes around that.
async function curlRequest(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('curl', args, {
    timeout: DECKLIST_TIMEOUT_MS,
    maxBuffer: 5 * 1024 * 1024,
  });
  return stdout;
}

async function curlGetWithSession(
  url: string,
  params?: URLSearchParams,
): Promise<string> {
  const jar = join(tmpdir(), `decklist-cookies-${randomUUID()}.txt`);
  const commonArgs = [
    '-sS',
    '--fail',
    '--max-time',
    String(DECKLIST_TIMEOUT_MS / 1000),
    '-A',
    USER_AGENT,
  ];

  try {
    // Warm up first — the site sets a session cookie on first visit that's
    // needed for the decklist search to return real results.
    await curlRequest([
      ...commonArgs,
      '--cookie-jar',
      jar,
      '-o',
      '/dev/null',
      DECKLIST_BASE_URL,
    ]);

    const paramArgs: string[] = [];
    for (const [k, v] of params ?? []) {
      paramArgs.push('--data-urlencode', `${k}=${v}`);
    }

    return await curlRequest([
      ...commonArgs,
      '--cookie',
      jar,
      '-G',
      url,
      ...paramArgs,
    ]);
  } finally {
    await unlink(jar).catch(() => {});
  }
}

function extractDecklists(html: string): Decklist[] {
  const $ = cheerio.load(html);
  const results: Decklist[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    let path: string;
    try {
      path = new URL(href, DECKLIST_BASE_URL).pathname;
    } catch {
      return;
    }

    const match = path.match(RESULT_LINK_PATTERN);
    if (!match || match[1] === 'feed') return;

    results.push({
      text: $(el).text().replace(/\s+/g, ' ').trim(),
      url: new URL(href, DECKLIST_BASE_URL).toString(),
    });
  });

  return results;
}
