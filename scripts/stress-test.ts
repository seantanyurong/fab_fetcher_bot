import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHAT_ID = process.env.STRESS_TEST_CHAT_ID!;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("BOT_TOKEN and STRESS_TEST_CHAT_ID must be set in .env");
  process.exit(1);
}

const cards = [
  "[[Rhinar]]",
  "[[Dorinthea]]",
  "[[Katsu]]",
  "[[Zero to Sixty]]",
  "[[Sink Below]]",
  "[[Pummel]]",
  "[[Enlightened Strike]]",
  "[[Bloodrush Bellow]]",
  "[[Razor Reflex]]",
  "[[Command and Conquer]]",
];

async function sendMessage(text: string) {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    },
  );
  const data = await res.json();
  console.log(`Sent "${text}" →`, res.status, data.ok ? "ok" : data.description);
}

async function run() {
  console.log(`Sending ${cards.length} messages to chat ${CHAT_ID}...\n`);
  await Promise.all(cards.map(sendMessage));
  console.log("\nDone.");
}

run();
