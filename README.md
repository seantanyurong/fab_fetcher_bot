# FAB Telegram Bot

A Telegram bot that fetches Flesh and Blood card images and links in any group chat. Type `[[card name]]` and the bot replies with the card image and a link to its CardVault page.

## Usage

In any chat where the bot is present:

```
[[Rhinar]]
[[Zero to Sixty p:1]]     <- specific pitch variant (0, 1, 2, or 3)
[[Briar]] [[Lexi]] [[Iyslander]]   <- multiple cards in one message
```

- `p:0` matches cards with no pitch value (heroes, equipment, etc.)
- Up to 5 cards per message; extras are dropped with a notice
- Card lookups use fuzzy matching, with a "closest match" note shown when the typed name doesn't exactly match

## Tech stack

- **[grammY](https://grammy.dev/)** — Telegram bot framework
- **[CardVault API](https://api.cardvault.fabtcg.com/carddb/api/v1/)** — unofficial FAB card data + images
- **TypeScript / Node.js 22** — runtime
- **Railway** — deployment

## Setup

```bash
npm install
cp .env.example .env   # add your BOT_TOKEN from @BotFather
npm run dev            # hot-reload dev mode
```

Then in Telegram, message your bot or add it to a group.

## Project layout

```
src/
├── index.ts       Bot setup, message handler, command handlers
├── config.ts      All constants and message templates
├── helpers.ts     Query parsing + per-user rate limiter
└── cardvault.ts   CardVault API client, cache, request coalescing
scripts/
├── stress-test-cardvault.ts   Hits CardVault directly with concurrent requests
└── stress-test-bot.ts         Full end-to-end test sending real messages to a test chat
```

## Stress testing

Two scripts test different layers of the system. Both write logs to console; `stress-test-bot.ts` also writes to `stress-test.log` for easier review.

### CardVault layer only

Fires a batch of concurrent `searchCard()` calls to verify the cache, request coalescing, concurrency cap (10 in-flight max), and minTime spacing (100ms between starts) all work under load. No Telegram involvement.

```bash
npx tsx scripts/stress-test-cardvault.ts
```

What to look for:
- All requests resolve successfully
- `running` value in the limiter logs never exceeds 10
- `minTime wait` values grow progressively (100, 200, 300...) when many callers arrive at once

### Full bot pipeline (real Telegram sends)

Injects fake user updates into `bot.handleUpdate()`, which runs them through the full middleware stack — sequentialize, rate limiter, CardVault, throttler, autoRetry — and lets the outgoing sends hit Telegram for real. The bot replies appear in a designated test chat.

**Setup:**

1. Stop your production bot (Railway instance) first to avoid two pollers fighting over updates.
2. Add a test chat ID to `.env`:
   ```
   STRESS_TEST_CHAT_ID=-100xxxxxxxxxx
   ```
   Use a private test group, **not** a user-facing production chat. The bot will send dozens of real messages there.
3. Run:
   ```bash
   npx tsx scripts/stress-test-bot.ts
   ```

Each fake update uses a different `user_id` (so the per-user rate limiter doesn't fire), all targeting the same chat. The script sends 100 single-card messages and logs every fetch, send, and throttle event with timestamps.

**Expected runtime: ~5-7 minutes** for 100 sends. The bottleneck is Telegram's 20-sends-per-minute group reservoir — the throttler queues sends and waits for refresh cycles. This is intentional and protects against 429s.

After completion, review `stress-test.log` for:
- `[fetch]` lines — CardVault timing per card
- `[tg]` lines — actual Telegram API call duration (includes throttler queue wait)
- `[send]` lines — total handler time per user
- Final summary: `Sent: N  Failed: 0  429s: 0` confirms zero failures

A healthy run completes with zero failures and zero 429s, proving the throttler successfully stays under Telegram's actual limits.

## Architecture notes

**Concurrency** — uses `@grammyjs/runner` to process updates from different users in parallel. `sequentialize` keyed by user ID ensures one user's messages stay ordered while different users run concurrently.

**Telegram-facing protections (outgoing)**
- `apiThrottler` paces sends to stay under Telegram's per-chat limits (~1/sec, 20/min in groups).
- `autoRetry` catches any 429s that slip through and retries transparently.

**User-facing rate limit (incoming)**
- Sliding-window per-user limit of 5 messages per 10 seconds. The 6th gets a "slow down" reply and is dropped before any work happens.

**CardVault protections (outgoing)**
- **Cache** — 1 hour TTL on resolved lookups; most repeated requests skip the API entirely.
- **Request coalescing** — if 20 users request the same uncached card simultaneously, only one fetch fires and all 20 await it.
- **Concurrency cap** — never more than 10 in-flight CardVault requests at once. Protects this process from runaway resource use if the API gets slow.
- **Minimum gap** — 100ms between request starts (~10 req/sec ceiling). Protects CardVault from sustained spam bursts.

**Multi-card replies** — multiple cards return as a single Telegram media group (one message, up to 5 photos) with a combined caption containing all card links, notices, and errors.

## Deployment (Railway)

1. Push to GitHub
2. Connect repo on Railway
3. Set `BOT_TOKEN` as an environment variable
4. Railway picks up `nixpacks.toml` for build/start

`SIGTERM` handling lets in-flight lookups finish during redeploys instead of being killed mid-reply.

## Disclaimer

Not affiliated with or endorsed by Legend Story Studios. Flesh and Blood is a registered trademark of Legend Story Studios.
