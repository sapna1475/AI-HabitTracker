import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.js";

dotenv.config();

/**
 * Seeds 100 fake users with a push subscription enabled,
 * so we can run a realistic load test on the cron job's
 * idempotency logic without affecting real user data.
 *
 * Each test user is clearly tagged with a "test-user-" prefix
 * in their email, so they're easy to find and delete later.
 */
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Clean up any old test users first, so re-running this script is safe
  await User.deleteMany({ email: { $regex: /^test-user-/ } });

  const users = [];
  for (let i = 0; i < 100; i++) {
    users.push({
      name: `Test User ${i}`,
      email: `test-user-${i}@loadtest.com`,
      password: "Password123", // will be hashed by the pre-save hook
      // Fake push subscription object — won't actually deliver a real
      // notification since the endpoint is fake, but it's enough for
      // our cron job's logic (which only checks "is this null or not")
      pushSubscription: {
        endpoint: `https://fake-push-endpoint.com/${i}`,
        keys: { p256dh: "fake-key", auth: "fake-auth" },
      },
      lastReminderSentDate: null,
    });
  }

  await User.insertMany(users);
  console.log("Seeded 100 test users with push subscriptions.");

  await mongoose.disconnect();
}

seed();