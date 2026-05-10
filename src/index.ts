import 'dotenv/config';
import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { limit } from '@grammyjs/ratelimiter';
import { searchCard, getImageUrl, formatCardCaption } from './cardvault.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN environment variable is required');

const bot = new Bot(token);
const throttler = apiThrottler();
bot.api.config.use(throttler);
bot.api.config.use(autoRetry());
bot.use(
  limit({
    timeFrame: 5000,
    limit: 2,
    onLimitExceeded: async (ctx) => {
      await ctx.reply(
        "Slow down — you're sending too many requests. Please wait a moment.",
      );
    },
  }),
);

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

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const matches = [...text.matchAll(CARD_PATTERN)];
  if (matches.length === 0) return;

  const queries = [
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
  ].slice(0, 5);

  for (const { name, pitch } of queries) {
    if (!name) {
      await ctx.reply(
        'Please provide a card name, e.g. <code>[[Rhinar]]</code>',
        {
          parse_mode: 'HTML',
          reply_parameters: { message_id: ctx.message.message_id },
        },
      );
      continue;
    }

    try {
      const result = await searchCard(name, pitch);

      if (!result) {
        await ctx.reply(`No card found for "${name}"`, {
          reply_parameters: { message_id: ctx.message.message_id },
        });
        continue;
      }

      const { card, fuzzy } = result;
      const queryLabel = pitch !== undefined ? `${name} p:${pitch}` : name;
      const caption =
        (fuzzy ? `<i>Closest match for "${queryLabel}":</i>\n` : '') +
        formatCardCaption(card);
      const imageUrl = getImageUrl(card);

      if (imageUrl) {
        await ctx.replyWithPhoto(imageUrl, {
          caption,
          parse_mode: 'HTML',
          reply_parameters: { message_id: ctx.message.message_id },
        });
      } else {
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          reply_parameters: { message_id: ctx.message.message_id },
        });
      }
    } catch (err) {
      console.error(`Failed to fetch card "${name}":`, err);
      await ctx.reply(`Error fetching "${name}" — CardVault may be down.`, {
        reply_parameters: { message_id: ctx.message.message_id },
      });
    }
  }
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
bot.start();
