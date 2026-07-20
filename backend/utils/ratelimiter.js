// simple in-memory fixed-window rate limiter — per user
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const buckets = new Map();

export const checkRateLimit = (userId) => {
    const now = Date.now();
    const currentWindow = Math.floor(now / WINDOW_MS) * WINDOW_MS;

    let bucket = buckets.get(userId);
    if (!bucket || bucket.windowStart !== currentWindow) {
        bucket = { count: 0, windowStart: currentWindow };
        buckets.set(userId, bucket);
    }

    if (bucket.count >= MAX_REQUESTS) {
        return { allowed: false, retryAfterMs: currentWindow + WINDOW_MS - now, remaining: 0 };
    }

    bucket.count++;
    return { allowed: true, retryAfterMs: 0, remaining: MAX_REQUESTS - bucket.count };
};

setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [userId, bucket] of buckets) {
        if (bucket.windowStart < cutoff) buckets.delete(userId);
    }
}, WINDOW_MS);