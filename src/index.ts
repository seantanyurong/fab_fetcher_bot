import "dotenv/config";
import { Bot } from "grammy";
import { searchCard, getImageUrl, formatCardCaption } from "./cardvault.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN environment variable is required");

const bot = new Bot(token);

// Match all [[card name]] patterns in a message, including multiple per message
const CARD_PATTERN = /\[\[([^\]]+)\]\]/g;

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const matches = [...text.matchAll(CARD_PATTERN)];
  if (matches.length === 0) return;

  // Deduplicate card names (case-insensitive)
  const names = [
    ...new Set(matches.map((m) => m[1].trim().toLowerCase())),
  ].slice(0, 5); // cap at 5 cards per message

  for (const name of names) {
    try {
      const card = await searchCard(name);

      if (!card) {
        await ctx.reply(`No card found for "${name}"`, {
          reply_parameters: { message_id: ctx.message.message_id },
        });
        continue;
      }

      const caption = formatCardCaption(card);
      const imageUrl = getImageUrl(card);

      if (imageUrl) {
        await ctx.replyWithPhoto(imageUrl, {
          caption,
          parse_mode: "HTML",
          reply_parameters: { message_id: ctx.message.message_id },
        });
      } else {
        await ctx.reply(caption, {
          parse_mode: "HTML",
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

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log("Starting bot...");
bot.start();
