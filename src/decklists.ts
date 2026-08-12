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
  DECKLIST_TIMEOUT_MS,
  DECKLIST_DEFAULT_NUM,
} from './config.js';

const execFileAsync = promisify(execFile);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: DECKLIST_URL,
};

// Result-detail links look like /decklists/<slug>/ — a single, non-empty
// path segment. Nav/filter/pagination links on the same page are either the
// bare decklists root, /<lang>/decklists/, or /decklists/feed/.
const RESULT_LINK_PATTERN = /^\/decklists\/([^/]+)\/?$/;

interface CacheEntry {
  result: Decklist[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export interface Decklist {
  text: string;
  url: string;
}

function cacheKey(heroName: string, num: number): string {
  return `${heroName.toLowerCase()}|${num}`;
}

export async function getDecklists(
  heroName: string,
  num: number = DECKLIST_DEFAULT_NUM,
): Promise<Decklist[]> {
  const key = cacheKey(heroName, num);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const html = await fetchDecklistsHtml(heroName);
  const result = extractDecklists(html).slice(0, num);

  cache.set(key, { result, expiresAt: Date.now() + DECKLIST_CACHE_TTL_MS });
  return result;
}

// fabtcg.com sits behind a WAF that blocks Node's native fetch (undici) at
// the TLS-fingerprint level — same headers/cookies, but fetch gets a bare
// 403 where curl gets a normal 200. Shelling out to curl (via execFile, so
// heroName is passed as a literal argv value — never shell-interpreted)
// routes around that.
async function curlRequest(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('curl', args, {
    timeout: DECKLIST_TIMEOUT_MS,
    maxBuffer: 5 * 1024 * 1024,
  });
  return stdout;
}

async function fetchDecklistsHtml(heroName: string): Promise<string> {
  const jar = join(tmpdir(), `decklist-cookies-${randomUUID()}.txt`);
  const commonArgs = [
    '-sS',
    '--fail',
    '--max-time',
    String(DECKLIST_TIMEOUT_MS / 1000),
    '-A',
    USER_AGENT,
    '-H',
    `Accept: ${REQUEST_HEADERS.Accept}`,
    '-H',
    `Accept-Language: ${REQUEST_HEADERS['Accept-Language']}`,
    '-H',
    `Referer: ${REQUEST_HEADERS.Referer}`,
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

    return await curlRequest([
      ...commonArgs,
      '--cookie',
      jar,
      '-G',
      DECKLIST_URL,
      '--data-urlencode',
      'decklist_format=Classic Constructed',
      '--data-urlencode',
      `decklist_hero=${heroName}`,
      '--data-urlencode',
      'decklist_event=',
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
