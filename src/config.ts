// CardVault API
export const CARDVAULT_BASE_URL =
  'https://api.cardvault.fabtcg.com/carddb/api/v1';
export const CARDVAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const CARDVAULT_MAX_CONCURRENT = 10;
export const CARDVAULT_MIN_TIME_MS = 100; // min gap between CardVault requests (~10 req/sec)

// Regex patterns for parsing card queries
export const CARD_PATTERN = /\[\[([^\]]+)\]\]/g;
export const PITCH_PATTERN = /\bp:([0123])\b/i;
export const PITCH_PATTERN_GLOBAL = /\bp:[0123]\b/gi;

// Limits
export const MAX_CARDS = 5; // Telegram media group max is 10, kept lower for readability
export const MIN_NAME_LENGTH = 2;

// Per-user rate limiting
export const RATE_WINDOW_MS = 10_000;
export const RATE_MAX = 5;

// Disclaimer used in all longer-form replies
const DISCLAIMER =
  '<i>Not affiliated or endorsed by Legend Story Studios®. Flesh and Blood™ is a registered trademark of Legend Story Studios.</i>';

const SYNTAX_BLOCK =
  '<b>Syntax</b>\n' +
  '1. Basic: <code>[[Rhinar]]</code>\n' +
  '2. Pitch: <code>[[Zero to Sixty p:1]]</code>';

const SUPPORT_LINE =
  'If you encounter any bugs, feel free to message @seanyouwrong';

// Message templates
export const START_MESSAGE =
  'Yo. I can fetch Flesh and Blood cards in any group chat.\n\n' +
  '<b>How to use</b>\n' +
  'Add me to a group and make me an Admin, then type [[card name]] to look up a card.\n\n' +
  SYNTAX_BLOCK +
  '\n\n' +
  SUPPORT_LINE +
  '\n\n' +
  DISCLAIMER;

export const ADDED_TO_GROUP_MESSAGE =
  "Yo.\n\nI'm a bot that helps fetch and display Flesh and Blood cards.\n\n" +
  '<b>Instructions</b>\n' +
  'Make me an Admin, then type [[card name]] to look up a card.\n\n' +
  SYNTAX_BLOCK +
  '\n\n' +
  SUPPORT_LINE +
  '\n\n' +
  DISCLAIMER;

export const PROMOTED_TO_ADMIN_MESSAGE =
  "Nice. I'm an admin now. Ready to fetch cards — type [[card name]] to get started.";

export const RATE_LIMITED_MESSAGE =
  "Slow down — you're sending too many requests. Please wait a moment.";
