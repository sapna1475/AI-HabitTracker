import webpush from "web-push";
import User from "../models/user.js";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Save subscription from browser
export const saveSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    await User.findByIdAndUpdate(req.user.id, { pushSubscription: subscription });
    res.json({ message: "Subscription saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save subscription" });
  }
};

// Send a push notification (used internally by cron job)
export const sendNotification = async (userId, title, body) => {
  try {
    const user = await User.findById(userId);
    if (!user?.pushSubscription) return;

    await webpush.sendNotification(
      user.pushSubscription,
      JSON.stringify({ title, body })
    );
  } catch (err) {
    console.error("Push notification failed:", err.message);
  }
};