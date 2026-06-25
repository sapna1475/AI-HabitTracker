import cron from "node-cron";
import User from "../models/user.js";
import HabitLog from "../models/HabitLog.js";
import { sendNotification } from "../controllers/notificationController.js";
import { todayKey } from "../utils/dateHelpers.js"; 


/**
 * Helper function to check if two dates fall on the same calendar day.
 * We compare year, month, and date — ignoring the time portion completely.
 * This is important because "today" for a cron job means the whole day,
 * not an exact timestamp match.
 */
function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Cron job — runs every day at 8:00 PM server time.
 *
 * IMPORTANT: Cron jobs are NOT guaranteed to run exactly once.
 * They can fire twice if:
 *  - The server restarts mid-run and the scheduler re-triggers it
 *  - A deploy happens right around the scheduled time
 *  - Two server instances are running (in a scaled setup) and both
 *    have their own cron scheduler active
 *
 * Without protection, a user could receive the same streak reminder
 * notification multiple times in a row — which is a bad user experience
 * and a sign of a poorly designed background job.
 *
 * To make this job IDEMPOTENT — meaning running it twice on the same day
 * has the same effect as running it once — we track a `lastReminderSentDate`
 * field on each user. Before sending a notification, we check if that date
 * is already today. If yes, we skip that user. If no, we send and update
 * the field immediately.
 */

cron.schedule("0 20 * * *", async () => {
  console.log("Running streak reminder cron job...");

  try {
    const users = await User.find({ pushSubscription: { $ne: null } });

    // Get today's date as the exact same string format used when
    // a habit log is created — e.g. "2026-06-25"
    const today = todayKey(); // REPLACED startOfToday with this

    const now = new Date();

    for (const user of users) {
      if (
        user.lastReminderSentDate &&
        isSameDay(user.lastReminderSentDate, now)
      ) {
        console.log(`Skipping ${user.email} — already reminded today.`);
        continue;
      }

      // Step 4: Check if this user has logged ANY habit today.
      // Since completedDate is stored as a string like "2026-06-25",
      // we do an exact string match instead of a date range query.
      const log = await HabitLog.findOne({
        userId: user._id,
        completedDate: today, // CHANGED from date range to exact string match
      });

      if (!log) {
        await sendNotification(
          user._id,
          "Don't break your streak! 🔥",
          "You haven't logged your habits today. Keep your streak alive!"
        );

        user.lastReminderSentDate = now;
        await user.save();

        console.log(`Reminder sent to ${user.email}`);
      } else {
        console.log(`${user.email} already logged a habit today — no reminder needed.`);
      }
    }
  } catch (err) {
    console.error("Streak reminder cron error:", err.message);
  }
});
