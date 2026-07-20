import { checkRateLimit } from "../utils/rateLimiter.js";

export const aiRateLimit = (req, res, next) => {
    const { allowed, retryAfterMs } = checkRateLimit(req.user.id); // assumes auth.js already set req.user
    if (!allowed) {
        return res.status(429).json({
            error: "Too many AI requests. Please slow down.",
            retryAfterMs,
        });
    }
    next();
};