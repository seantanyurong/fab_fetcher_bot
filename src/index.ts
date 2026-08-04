import 'dotenv/config';
import { Bot } from 'grammy';
import { run, sequentialize } from '@grammyjs/runner';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { searchCard, getImageUrl, formatCardCaption } from './cardvault.js';
import {
  MAX_CARDS,
  MAX_CAPTION_LENGTH,
  MIN_NAME_LENGTH,
  START_MESSAGE,
  ADDED_TO_GROUP_MESSAGE,
  PROMOTED_TO_ADMIN_MESSAGE,
  RATE_LIMITED_MESSAGE,
  CALENDAR_MESSAGE,
  LOCATION_PROMPT_TTL_MS,
} from './config.js';
import { parseQueries, checkRateLimit } from './helpers.js';
import { logLookup } from './analytics.js';
import {
  todayKey,
  todayMonthKey,
  formatDateLong,
  buildMonthKeyboard,
  buildDayView,
} from './calendar.js';
import { getMonthCounts, getDayResponses, setStatus } from './attendance.js';
import type { Status } from './attendance.js';
import { getLocation, setLocation } from './locations.js';

interface PendingLocationPrompt {
  chatId: number;
  dateKey: string;
  promptMessageId: number;
  expiresAt: number;
}

// Keyed by user ID — tracks the one "set location" reply prompt a user has open
const pendingLocationPrompts = new Map<number, PendingLocationPrompt>();

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN environment variable is required');

const bot = new Bot(token);
bot.api.config.use(apiThrottler());
bot.api.config.use(autoRetry());

bot.use(sequentialize((ctx) => ctx.from?.id.toString()));

bot.command('start', async (ctx) => {
  await ctx.reply(START_MESSAGE, { parse_mode: 'HTML' });
});

bot.command('calendar', async (ctx) => {
  const monthKey = todayMonthKey();
  const counts = await getMonthCounts(ctx.chat.id, monthKey);
  await ctx.reply(CALENDAR_MESSAGE, {
    reply_markup: buildMonthKeyboard(monthKey, counts),
  });
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('cal:')) return;

  if (data === 'cal:x') {
    await ctx.answerCallbackQuery();
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const [, kind, arg, statusChar] = data.split(':');

  if (kind === 'm') {
    const monthKey = arg;
    const counts = await getMonthCounts(chatId, monthKey);
    await ctx.editMessageText(CALENDAR_MESSAGE, {
      reply_markup: buildMonthKeyboard(monthKey, counts),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (kind === 'd') {
    const dateKey = arg;
    const [responses, location] = await Promise.all([
      getDayResponses(chatId, dateKey, ctx.from.id),
      getLocation(chatId, dateKey),
    ]);
    const { text, keyboard } = buildDayView(dateKey, responses, location);
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (kind === 's') {
    const dateKey = arg;
    if (dateKey < todayKey()) {
      await ctx.answerCallbackQuery({ text: 'That date has passed.' });
      return;
    }

    const status: Status =
      statusChar === 'y' ? 'yes' : statusChar === 'n' ? 'no' : 'maybe';
    const userName = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;

    await setStatus(chatId, dateKey, ctx.from.id, userName, status);
    const [responses, location] = await Promise.all([
      getDayResponses(chatId, dateKey, ctx.from.id),
      getLocation(chatId, dateKey),
    ]);
    const { text, keyboard } = buildDayView(dateKey, responses, location);
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery({ text: `Marked as ${status}` });
    return;
  }

  if (kind === 'l') {
    const dateKey = arg;
    if (dateKey < todayKey()) {
      await ctx.answerCallbackQuery({ text: 'That date has passed.' });
      return;
    }

    const prompt = await ctx.reply(
      `📍 Reply to this message with the location for ${formatDateLong(dateKey)}`,
      {
        reply_markup: { force_reply: true, selective: true },
        reply_parameters: {
          message_id: ctx.callbackQuery.message!.message_id,
        },
      },
    );
    pendingLocationPrompts.set(ctx.from.id, {
      chatId,
      dateKey,
      promptMessageId: prompt.message_id,
      expiresAt: Date.now() + LOCATION_PROMPT_TTL_MS,
    });
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();
});

bot.on('message:text', async (ctx) => {
  const pending = pendingLocationPrompts.get(ctx.from.id);
  if (
    pending &&
    pending.chatId === ctx.chat.id &&
    ctx.message.reply_to_message?.message_id === pending.promptMessageId
  ) {
    pendingLocationPrompts.delete(ctx.from.id);
    if (Date.now() < pending.expiresAt) {
      const location = ctx.message.text.trim().slice(0, 200);
      await setLocation(pending.chatId, pending.dateKey, location);
      await ctx.reply(
        `📍 Location for ${formatDateLong(pending.dateKey)} set to: ${location}`,
        { reply_parameters: { message_id: ctx.message.message_id } },
      );
    } else {
      await ctx.reply('That location prompt expired — tap "Set location" again.', {
        reply_parameters: { message_id: ctx.message.message_id },
      });
    }
    return;
  }

  const uniqueQueries = parseQueries(ctx.message.text);
  if (uniqueQueries.length === 0) return;

  const userId = ctx.from?.id;
  if (userId) {
    const { limited, shouldNotify } = checkRateLimit(userId);
    if (limited) {
      console.log(
        `Rate limited user ${userId} (${ctx.from?.username}) — notify=${shouldNotify}`,
      );
      if (shouldNotify) {
        await ctx.reply(RATE_LIMITED_MESSAGE, {
          reply_parameters: { message_id: ctx.message.message_id },
        });
      }
      return;
    }
  }

  console.log(
    `[handler] START msg=${ctx.message.message_id} user=${ctx.from?.id} cards=${uniqueQueries.length}`,
  );

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
      if (!name || name.length < MIN_NAME_LENGTH) {
        errors.push(
          `"${name}" — please provide at least ${MIN_NAME_LENGTH} characters`,
        );
        return;
      }

      try {
        const result = await searchCard(name, pitch);

        logLookup({
          chat_id: ctx.chat.id,
          user_id: ctx.from.id,
          card_name: name,
          pitch,
          found: !!result,
          fuzzy: result?.fuzzy ?? false,
          result_card_id: result?.card.card_id,
          result_card_name: result?.card.printed_name,
          result_print_id: result?.card.print_id,
        });

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

  const rawCaption = [
    ...notices,
    ...photos.map((p) => p.caption),
    ...errors,
  ].join('\n');
  const combinedCaption =
    rawCaption.length > MAX_CAPTION_LENGTH
      ? rawCaption.slice(0, MAX_CAPTION_LENGTH) + '…'
      : rawCaption;

  if (photos.length >= 2) {
    await ctx.replyWithMediaGroup(
      photos.map((p, i) => ({
        type: 'photo',
        media: p.media,
        ...(i === 0
          ? { caption: combinedCaption, parse_mode: 'HTML' as const }
          : {}),
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
    await ctx.reply(PROMOTED_TO_ADMIN_MESSAGE);
    return;
  }

  if (!addedToGroup) return;

  await ctx.reply(ADDED_TO_GROUP_MESSAGE, { parse_mode: 'HTML' });
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

console.log('Starting bot...');
const handle = run(bot);

process.once('SIGINT', () => handle.stop());
process.once('SIGTERM', () => handle.stop());
