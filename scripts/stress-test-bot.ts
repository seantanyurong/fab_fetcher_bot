import 'dotenv/config';
import { writeFileSync, appendFileSync } from 'fs';
import { Bot } from 'grammy';
import { sequentialize } from '@grammyjs/runner';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import {
  searchCard,
  getImageUrl,
  formatCardCaption,
} from '../src/cardvault.js';
import { MAX_CARDS, MAX_CAPTION_LENGTH, MIN_NAME_LENGTH } from '../src/config.js';
import { parseQueries } from '../src/helpers.js';

const token = process.env.BOT_TOKEN;
const chatId = process.env.STRESS_TEST_CHAT_ID;
if (!token) throw new Error('BOT_TOKEN required');
if (!chatId)
  throw new Error('STRESS_TEST_CHAT_ID required (your test group chat ID)');

// ---- File logging ----
const LOG_FILE = 'stress-test.log';
const testStart = Date.now();
writeFileSync(LOG_FILE, ''); // clear

function log(msg: string) {
  const elapsed = (Date.now() - testStart).toString().padStart(7, ' ');
  const line = `[+${elapsed}ms] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

// ---- Bot setup mirroring src/index.ts (no per-user rate limiter) ----
const bot = new Bot(token);
bot.api.config.use(apiThrottler());
bot.api.config.use(autoRetry());

// Counters
let sent = 0;
let failed = 0;
let errors429 = 0;

// Time every outgoing API call
bot.api.config.use(async (prev, method, payload, signal) => {
  const start = Date.now();
  const result = await prev(method, payload, signal);
  const elapsed = Date.now() - start;
  if (method === 'sendPhoto' || method === 'sendMediaGroup' || method === 'sendMessage') {
    if (result.ok) {
      sent++;
      log(`[tg] ${method} OK in ${elapsed}ms`);
    } else {
      const r = result as { ok: false; error_code?: number; description?: string };
      failed++;
      if (r.error_code === 429) errors429++;
      log(
        `[tg] ${method} FAIL ${r.error_code} ${r.description} in ${elapsed}ms`,
      );
    }
  }
  return result;
});

bot.use(sequentialize((ctx) => ctx.from?.id.toString()));

bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;
  const handlerStart = Date.now();
  log(`[handler] START user=${userId}`);

  const uniqueQueries = parseQueries(ctx.message.text);
  if (uniqueQueries.length === 0) return;

  const queries = uniqueQueries.slice(0, MAX_CARDS);
  const photos: { media: string; caption: string }[] = [];
  const errors: string[] = [];

  const fetchStart = Date.now();
  await Promise.all(
    queries.map(async ({ name, pitch }) => {
      if (!name || name.length < MIN_NAME_LENGTH) return;
      const t = Date.now();
      try {
        const result = await searchCard(name, pitch);
        log(`[fetch] user=${userId} "${name}" ${Date.now() - t}ms`);
        if (!result) {
          errors.push(`No card found for "${name}"`);
          return;
        }
        const caption = formatCardCaption(result.card);
        const imageUrl = getImageUrl(result.card);
        if (imageUrl) photos.push({ media: imageUrl, caption });
      } catch {
        errors.push(`Error fetching "${name}"`);
      }
    }),
  );
  log(
    `[fetch] user=${userId} ALL DONE in ${Date.now() - fetchStart}ms (${photos.length} photos)`,
  );

  const rawCaption = [...photos.map((p) => p.caption), ...errors].join('\n');
  const combinedCaption =
    rawCaption.length > MAX_CAPTION_LENGTH
      ? rawCaption.slice(0, MAX_CAPTION_LENGTH) + '…'
      : rawCaption;

  const sendStart = Date.now();
  if (photos.length >= 2) {
    await ctx.replyWithMediaGroup(
      photos.map((p, i) => ({
        type: 'photo',
        media: p.media,
        ...(i === 0 ? { caption: combinedCaption, parse_mode: 'HTML' as const } : {}),
      })),
    );
  } else if (photos.length === 1) {
    await ctx.replyWithPhoto(photos[0].media, {
      caption: combinedCaption,
      parse_mode: 'HTML',
    });
  } else {
    // No photos — send text fallback so every query produces a Telegram call
    await ctx.reply(combinedCaption || `No card found for "${ctx.message.text}"`, {
      parse_mode: 'HTML',
    });
  }
  log(
    `[send] user=${userId} returned in ${Date.now() - sendStart}ms (total handler ${Date.now() - handlerStart}ms)`,
  );
});

// ---- Fake update factory ----
let updateId = 1;
function fakeUpdate(userId: number, text: string) {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      from: {
        id: userId,
        is_bot: false,
        first_name: `User${userId}`,
        language_code: 'en',
      },
      chat: {
        id: Number(chatId),
        type: 'supergroup' as const,
        title: 'Test',
      },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

// 100 fresh queries that haven't been tested before
const cardNames = [
  'Earnest', 'Earthen', 'Echoing', 'Edged', 'Eerie', 'Elated', 'Elder',
  'Electric', 'Elegant', 'Elemental', 'Elevated', 'Eloquent', 'Elusive',
  'Emanating', 'Embattled', 'Emboldened', 'Embracing', 'Emerald',
  'Emerging', 'Empathic', 'Emptied', 'Enchanted', 'Encroaching', 'Endemic',
  'Endless', 'Endowed', 'Enduring', 'Energetic', 'Enfolded', 'Engulfing',
  'Enkindled', 'Enlivened', 'Enraged', 'Enraptured', 'Enriched', 'Entangled',
  'Enthralled', 'Entrenched', 'Entwined', 'Envenomed', 'Envious', 'Equipped',
  'Erratic', 'Eruptive', 'Esoteric', 'Established', 'Eternal', 'Ethereal',
  'Evergreen', 'Evicted', 'Evident', 'Evil', 'Evolved', 'Exacting',
  'Exalted', 'Excellent', 'Exiled', 'Expansive', 'Expectant', 'Experienced',
  'Explosive', 'Exposed', 'Extant', 'Extinguished', 'Extraordinary', 'Extreme',
  'Fabled', 'Faceted', 'Fading', 'Faint', 'Faithful', 'Fallen', 'Famished',
  'Fancied', 'Fanciful', 'Far-Reaching', 'Fated', 'Fathomless', 'Favored',
  'Fearsome', 'Featured', 'Feathered', 'Federal', 'Feeble', 'Felled',
  'Ferocious', 'Fervent', 'Festal', 'Fettered', 'Fevered', 'Fibrous',
  'Fickle', 'Fierce', 'Fiendish', 'Filthy', 'Final', 'Finite', 'Firm',
  'First', 'Fitful', 'Fitting', 'Fixated',
];
log(`Using ${cardNames.length} unique queries`);

async function runTest() {
  log('=== Real stress test ===');
  log(`Chat: ${chatId}`);

  await bot.init();

  // 300 single-card messages, each from a different fake user
  const messages = cardNames.map((c) => `[[${c}]]`);
  log(`Firing ${messages.length} fake user messages (1 card each)`);

  await Promise.all(
    messages.map((text, i) => bot.handleUpdate(fakeUpdate(20000 + i, text))),
  );

  log(`=== DONE ===`);
  log(`Sent: ${sent}  Failed: ${failed}  429s: ${errors429}`);
  log(`Total elapsed: ${Date.now() - testStart}ms`);

  process.exit(0);
}

runTest();
