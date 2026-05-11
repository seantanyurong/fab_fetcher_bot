import 'dotenv/config';
import { Bot } from 'grammy';
import { run, sequentialize } from '@grammyjs/runner';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { searchCard, getImageUrl, formatCardCaption } from './cardvault.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN environment variable is required');

const bot = new Bot(token);
const throttler = apiThrottler();
bot.api.config.use(throttler);
bot.api.config.use(autoRetry());

bot.use(sequentialize((ctx) => ctx.from?.id.toString()));

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Yo. I can fetch Flesh and Blood cards in any group chat.\n\n' +
      '<b>How to use</b>\n' +
      'Add me to a group and make me an Admin, then type [[card name]] to look up a card.\n\n' +
      '<b>Syntax</b>\n' +
      '1. Basic: <code>[[Rhinar]]</code>\n' +
      '2. Pitch: <code>[[Zero to Sixty p:1]]</code>\n\n' +
      'If you encounter any bugs, feel free to message @seanyouwrong\n\n' +
      '<i>Not affiliated or endorsed by Legend Story Studios®. Flesh and Blood™ is a registered trademark of Legend Story Studios.</i>',
    { parse_mode: 'HTML' },
  );
});

// Match all [[card name]] patterns in a message, including multiple per message
const CARD_PATTERN = /\[\[([^\]]+)\]\]/g;

// Per-user rate limiting
const userTimestamps = new Map<number, number[]>();
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 5;

function isRateLimited(userId: number): boolean {
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

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const matches = [...text.matchAll(CARD_PATTERN)];
  if (matches.length === 0) return;

  const userId = ctx.from?.id;
  if (userId && isRateLimited(userId)) {
    console.log(`Rate limited user ${userId} (${ctx.from?.username})`);
    await ctx.reply(
      "Slow down — you're sending too many requests. Please wait a moment.",
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
    return;
  }

  console.log(
    `[handler] START msg=${ctx.message.message_id} user=${ctx.from?.id} cards=${matches.length}`,
  );

  const uniqueQueries = [
    ...new Map(
      matches.map((m) => {
        const raw = m[1].trim();
        const pitchMatch = raw.match(/\bp:([0123])\b/i);
        const pitch = pitchMatch ? Number(pitchMatch[1]) : undefined;
        const name = raw
          .replace(/\bp:[0123]\b/gi, '')
          .trim()
          .toLowerCase();
        return [name + (pitch ?? ''), { name, pitch }];
      }),
    ).values(),
  ];

  const MAX_CARDS = 5; // Telegram media group max
  const queries = uniqueQueries.slice(0, MAX_CARDS);

  const notices: string[] = [];
  if (uniqueQueries.length > MAX_CARDS) {
    notices.push(
      `<i>You requested ${uniqueQueries.length} cards — only the first ${MAX_CARDS} will be fetched.</i>`,
    );
  }

  const photos: { media: string; caption: string }[] = [];
  const errors: string[] = [];

  await Promise.all(
    queries.map(async ({ name, pitch }) => {
      if (!name || name.length < 2) {
        errors.push(`"${name}" — please provide at least 2 characters`);
        return;
      }

      try {
        const result = await searchCard(name, pitch);

        if (!result) {
          errors.push(`No card found for "${name}"`);
          return;
        }

        const { card, fuzzy } = result;
        const queryLabel = pitch !== undefined ? `${name} p:${pitch}` : name;
        const caption =
          (fuzzy ? `<i>Closest match for "${queryLabel}":</i>\n` : '') +
          formatCardCaption(card);
        const imageUrl = getImageUrl(card);

        if (imageUrl) {
          photos.push({ media: imageUrl, caption });
        } else {
          errors.push(caption);
        }
      } catch (err) {
        console.error(`Failed to fetch card "${name}":`, err);
        errors.push(`Error fetching "${name}"`);
      }
    }),
  );

  const combinedCaption = [
    ...notices,
    ...photos.map((p) => p.caption),
    ...errors,
  ].join('\n');

  if (photos.length >= 2) {
    await ctx.replyWithMediaGroup(
      photos.map((p, i) => ({
        type: 'photo',
        media: p.media,
        ...(i === 0 ? { caption: combinedCaption, parse_mode: 'HTML' as const } : {}),
      })),
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
  } else if (photos.length === 1) {
    await ctx.replyWithPhoto(photos[0].media, {
      caption: combinedCaption,
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message.message_id },
    });
  } else if (combinedCaption) {
    await ctx.reply(combinedCaption, {
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message.message_id },
    });
  }

  console.log(`[handler] END msg=${ctx.message.message_id}`);
});

bot.on('my_chat_member', async (ctx) => {
  const { new_chat_member, old_chat_member } = ctx.myChatMember;
  const addedToGroup =
    old_chat_member.status === 'left' &&
    (new_chat_member.status === 'member' ||
      new_chat_member.status === 'administrator');

  const promotedToAdmin =
    old_chat_member.status === 'member' &&
    new_chat_member.status === 'administrator';

  if (promotedToAdmin) {
    await ctx.reply(
      "Nice. I'm an admin now. Ready to fetch cards — type [[card name]] to get started.",
    );
    return;
  }

  if (!addedToGroup) return;

  await ctx.reply(
    "Yo.\n\nI'm a bot that helps fetch and display Flesh and Blood cards.\n\n" +
      '<b>Instructions</b>\n' +
      'Make me an Admin, then type [[card name]] to look up a card.\n\n' +
      '<b>Syntax</b>\n' +
      '1. Basic: <code>[[Rhinar]]</code>\n' +
      '2. Pitch: <code>[[Zero to Sixty p:1]]</code>\n\n' +
      'If you encounter any bugs, feel free to message @seanyouwrong\n\n' +
      '<i>Not affiliated or endorsed by Legend Story Studios®. Flesh and Blood™ is a registered trademark of Legend Story Studios.</i>',
    { parse_mode: 'HTML' },
  );
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

console.log('Starting bot...');
const handle = run(bot);

process.once('SIGINT', () => handle.stop());
process.once('SIGTERM', () => handle.stop());
