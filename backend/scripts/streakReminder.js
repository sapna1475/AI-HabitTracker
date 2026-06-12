import cron from "node-cron";
import User from "../models/user.js";
import HabitLog from "../models/HabitLog.js";
import { sendNotification } from "../controllers/notificationController.js";

// Runs every day at 8:00 PM
cron.schedule("0 20 * * *", async () => {
  console.log("Running streak reminder cron job...");
  
  try {
    const users = await User.find({ pushSubscription: { $ne: null } });

    for (const user of users) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const log = await HabitLog.findOne({
        userId: user._id,
        date: { $gte: today },
      });

      if (!log) {
        await sendNotification(
          user._id,
          "Don't break your streak! 🔥",
          "You haven't logged your habits today. Keep your streak alive!"
        );
      }
    }
  } catch (err) {
    console.error("Streak reminder cron error:", err.message);
  }
});