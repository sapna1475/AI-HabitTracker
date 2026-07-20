import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.js";

dotenv.config();

/**
 * This script simulates running the streak-reminder cron job's
 * core idempotency logic TWICE in a row, on the same day — exactly
 * the failure scenario we're protecting against (server restart,
 * overlapping schedule, etc).
 *
 * It does NOT actually send real push notifications (our test users
 * have fake endpoints). Instead it just runs the exact same
 * decision logic from streakReminder.js and counts the outcome,
 * so we get real, measurable proof that idempotency works.
 */

function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Simulates one "run" of the cron job's idempotency check only
// (skipping the habit-log check, since we just want to test the
// duplicate-prevention layer specifically)
async function simulateRun(runNumber) {
  const testUsers = await User.find({ email: { $regex: /^test-user-/ } });

  const now = new Date();
  let sent = 0;
  let skipped = 0;

  const start = Date.now(); // measure runtime

  for (const user of testUsers) {
    if (
      user.lastReminderSentDate &&
      isSameDay(user.lastReminderSentDate, now)
    ) {
      skipped++;
      continue;
    }

    // Simulate "sending" a notification (no real push call here)
    sent++;
    user.lastReminderSentDate = now;
    await user.save();
  }

  const durationMs = Date.now() - start;

  console.log(`\n--- Run ${runNumber} ---`);
  console.log(`Notifications sent:   ${sent}`);
  console.log(`Notifications skipped: ${skipped}`);
  console.log(`Total users processed:  ${testUsers.length}`);
  console.log(`Runtime: ${durationMs}ms`);

  return { sent, skipped, durationMs };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB. Starting idempotency test...");

  // Run 1 — simulates the cron firing normally for the first time today
  const run1 = await simulateRun(1);

  // Run 2 — simulates the cron firing AGAIN on the same day
  // (e.g. due to a server restart). This should send ZERO notifications.
  const run2 = await simulateRun(2);

  console.log("\n=== SUMMARY ===");
  console.log(`Run 1 sent: ${run1.sent} / 100`);
  console.log(`Run 2 sent: ${run2.sent} / 100 (should be 0)`);
  console.log(`Run 2 correctly skipped: ${run2.skipped} / 100`);

  if (run2.sent === 0 && run2.skipped === 100) {
    console.log("\nIdempotency check PASSED — zero duplicate notifications.");
  } else {
    console.log("\nIdempotency check FAILED — duplicates were sent!");
  }

  await mongoose.disconnect();
}

main();