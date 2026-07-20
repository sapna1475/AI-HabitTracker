import { GoogleGenAI } from "@google/genai";

// ai features gracefully degrade instead of crashing
let client = null;
const getClient = () => {
    if (client) return client;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    client = new GoogleGenAI({ apiKey: key });
    return client;
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const isAIEnabled = () => !!process.env.GEMINI_API_KEY;

const FALLBACK_MESSAGE =
    "AI features are temporarily unavailable — the app is using built-in logic to keep things running.";

// ---------- error classification ----------
// decides if an error is worth retrying (timeout/rate-limit/5xx) or not (4xx = our fault)
const classifyError = (err) => {
    const status = err?.status ?? err?.response?.status;
    if (err.name === "AbortError") return { type: "timeout", retryable: true };
    if (status === 429) return { type: "rate_limit", retryable: true };
    if (status >= 500) return { type: "server_error", retryable: true };
    if (status === 400 || status === 401 || status === 403) return { type: "client_error", retryable: false };
    return { type: "unknown", retryable: false };
};

// ---------- timeout ----------
// aborts a single call if it hangs longer than `ms`
const withTimeout = (fn, ms = 15000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fn(controller.signal).finally(() => clearTimeout(timer));
};

// ---------- retry with exponential backoff ----------
// only retries errors marked retryable; jitter avoids thundering-herd retries
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withRetry = async (fn, { retries = 2, baseDelay = 500 } = {}) => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const info = classifyError(err);
            lastErr = Object.assign(err, info);
            if (!info.retryable || attempt === retries) throw lastErr;
            await sleep(baseDelay * 2 ** attempt + Math.random() * 100);
        }
    }
    throw lastErr;
};

// ---------- circuit breaker ----------
// after N consecutive failures, stop calling the API for COOLDOWN_MS and fail fast instead
const breaker = { failures: 0, state: "closed", openedAt: 0 };
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000;

const breakerAllows = () => {
    if (breaker.state !== "open") return true;
    if (Date.now() - breaker.openedAt > COOLDOWN_MS) {
        breaker.state = "half-open"; // let one call through to test recovery
        return true;
    }
    return false;
};

const recordSuccess = () => { breaker.failures = 0; breaker.state = "closed"; };
const recordFailure = () => {
    breaker.failures++;
    if (breaker.failures >= FAILURE_THRESHOLD) {
        breaker.state = "open";
        breaker.openedAt = Date.now();
    }
};

// ---------- metrics ----------
// in-memory counters — expose via /metrics route to get real numbers for reporting
const metrics = { total: 0, success: 0, failed: 0, byType: {}, latencies: [] };

const recordMetric = ({ ok, type, latencyMs }) => {
    metrics.total++;
    ok ? metrics.success++ : metrics.failed++;
    if (type) metrics.byType[type] = (metrics.byType[type] || 0) + 1;
    metrics.latencies.push(latencyMs);
    if (metrics.latencies.length > 500) metrics.latencies.shift(); // cap memory
};

export const getMetricsSnapshot = () => {
    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : null;
    return {
        total: metrics.total,
        successRate: metrics.total ? +(metrics.success / metrics.total).toFixed(4) : null,
        breakerState: breaker.state,
        failuresByType: metrics.byType,
        p95LatencyMs: p95,
    };
};

// ---------- JSON parsing helper ----------
export const parseJSON = (text) => {
    let cleaned = (text || "").trim();
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```\n?/g, "");
    }
    return JSON.parse(cleaned.trim());
};

// ---------- main wrapper ----------
export const chatCompletion = async ({ system, user, temperature = 0.7 }) => {
    const c = getClient();
    if (!c) return { ok: false, content: FALLBACK_MESSAGE, degraded: true, reason: "no_api_key" };

    if (!breakerAllows()) {
        recordMetric({ ok: false, type: "circuit_open", latencyMs: 0 });
        return { ok: false, content: FALLBACK_MESSAGE, degraded: true, reason: "circuit_open" };
    }

    const start = Date.now();
    try {
        const res = await withRetry(() =>
            withTimeout((signal) =>
                c.models.generateContent({
                    model: MODEL,
                    contents: user,
                    config: { systemInstruction: system, temperature },
                    signal,
                })
            )
        );
        recordSuccess();
        recordMetric({ ok: true, type: null, latencyMs: Date.now() - start });
        return { ok: true, content: (res.text || "").trim() };
    } catch (err) {
        recordFailure();
        recordMetric({ ok: false, type: err.type ?? "unknown", latencyMs: Date.now() - start });
        console.error("AI error:", { type: err.type, message: err.message });
        return { ok: false, content: FALLBACK_MESSAGE, degraded: true, reason: err.type ?? "unknown" };
    }
};

// ---------- prompts ----------
export const SYSTEM_PROMPTS = {
    weekly:
        "You are a warm, encouraging habit coach. Analyse the user's last 7 days of habit data and write a short personalized report (120-180 words). Mention what went well, what they struggled with, patterns you notice, and one specific piece of encouragement. Use the user's actual habit names. Be human, not generic. No markdown headers - use plain prose with line breaks. Do not use any emojis.",
    suggestion:
        "You are a helpful habit coach. Based on the user's goals, productive time, and past struggles, suggest exactly 3 personalized habits. Return valid JSON only with this shape: {\"suggestions\" : [{\"name\":\"...\",\"frequency\":\"Daily|Weekly\", \"category\":\"Health|Fitness|Learning|Mindfulness|Productivity|Social|Finance|Creative|Others\", \"reason\":\"...\"}]}. NO prose outside JSON. Do not use any emojis anywhere in the response.",
    recovery:
        "You are a compassionate habit recovery coach. The user broke a streak. Write a 3-day recovery plan tailored to this specific habit. Be warm but actionable. Use this structure: short empathetic opening (1-2 sentences), then Day 1 / Day 2 / Day 3 sections with one concrete action each, then a closing line of encouragement. 150-220 words total. Do not use any emojis.",
    chat:
        "You are a helpful habit analysis assistant. Answer the user's question using ONLY the provided habit data as context. Be specific - cite actual habit names, days, percentages. Keep replies under 120 words. If the data is insufficient, say so briefly. Do not use any emojis.",
    morning:
        "You are a warm, motivating friend. Write a single short morning message (30-60 words) using the user's actual habit names and current streaks. Mention 1-2 specific habits. Energetic but not cheesy. Do not use any emojis.",
};
 