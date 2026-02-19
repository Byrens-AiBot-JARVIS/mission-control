import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const CONVEX_URL = "https://loyal-chickadee-487.eu-west-1.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);
const api = anyApi;

function nextOccurrence(cronExpr) {
  // Parse simple cron: "MIN HOUR * * *" or "MIN HOUR * * DOW"
  const parts = cronExpr.split(" ");
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  const dow = parts[4] === "*" ? null : parseInt(parts[4]);

  const now = new Date();
  const candidate = new Date(now);
  candidate.setSeconds(0);
  candidate.setMilliseconds(0);
  candidate.setMinutes(minute);
  candidate.setHours(hour);

  // If candidate is in the past, advance by 1 day
  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  // If day-of-week constraint, advance until matching
  if (dow !== null) {
    while (candidate.getDay() !== dow) {
      candidate.setDate(candidate.getDate() + 1);
    }
  }

  return candidate.getTime();
}

const entries = [
  {
    title: "Visma Receipt Queue",
    description: "Nightly job that processes queued receipts from Visma — matches transactions and files them.",
    schedule: "Daily at 01:00",
    cronExpr: "0 1 * * *",
    enabled: true,
    type: "cron",
    agentId: "Jarvis",
    nextRunAt: nextOccurrence("0 1 * * *"),
  },
  {
    title: "Visma Queue Retry",
    description: "Nightly retry pass for receipts that didn't match on first run.",
    schedule: "Daily at 01:00",
    cronExpr: "0 1 * * *",
    enabled: true,
    type: "cron",
    agentId: "Jarvis",
  },
  {
    title: "Friday Time Report Reminder",
    description: "Reminds Johan every Friday at 14:00 Stockholm time to submit his time report in Visma.",
    schedule: "Fridays at 14:00",
    cronExpr: "0 14 * * 5",
    enabled: true,
    type: "cron",
    agentId: "Jarvis",
    nextRunAt: nextOccurrence("0 14 * * 5"),
  },
  {
    title: "Daily X/Twitter Digest",
    description: "Morning AI/tech digest curated from X/Twitter — sent to Johan's WhatsApp. Currently paused.",
    schedule: "Daily at 08:00",
    cronExpr: "0 8 * * *",
    enabled: false,
    type: "cron",
    agentId: "Grizman",
  },
];

async function seed() {
  for (const entry of entries) {
    try {
      const id = await client.mutation(api.calendar.upsertByTitle, entry);
      console.log(`✔ Upserted: ${entry.title} (${id})`);
    } catch (err) {
      console.error(`✗ Failed: ${entry.title}`, err.message);
    }
  }
  console.log("Seeding complete.");
}

seed();
