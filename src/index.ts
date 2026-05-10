import 'dotenv/config';
import { Bot } from 'grammy';
import { searchCard, getImageUrl, formatCardCaption } from './cardvault.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN environment variable is required');

const bot = new Bot(token);

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
        const pitchMatch = raw.match(/\bp:([123])\b/i);
        const pitch = pitchMatch ? Number(pitchMatch[1]) : undefined;
        const name = raw
          .replace(/\bp:[123]\b/gi, '')
          .trim()
          .toLowerCase();
        return [name + (pitch ?? ''), { name, pitch }];
      }),
    ).values(),
  ].slice(0, 5);

  for (const { name, pitch } of queries) {
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
    "Hello.\n\nI'm a bot that can help fetch and display Flesh and Blood cards.\n\n" +
      '<b>Instructions</b>\n' +
      '1. Make me an Admin\n' +
      "2. Any member can type [[card name]] and I'll fetch it for you\n\n" +
      '<b>Syntax</b>\n' +
      'Pitch: <code>[[card name p:1]]</code>\n\n' +
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
