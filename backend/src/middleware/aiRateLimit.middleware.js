import rateLimit from "express-rate-limit";

const inFlightRequests = new Map();
const MAX_CONCURRENT_REQUEST = 2;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const aiConcurrencyLimiter = (req, res, next) => {
    const userId = req.user?._id?.toString();
    if(!userId) return next();

    const currentCount = inFlightRequests.get(userId) || 0;
    if(currentCount >= MAX_CONCURRENT_REQUEST) {
        return res.status(429).json({
            success: false,
            code: "AI_CONCURRENCY_LIMIT_EXCEEDED",
            message: "An AI generation is already in progress. Please wait for it to complete.",
        })
    }

    inFlightRequests.set(userId, currentCount + 1);
    
    let cleanedUp = false;
    const cleanup = () => {
        if(cleanedUp) return;
        cleanedUp = true;

         // Clear any pending timeout
        if (timeoutId) clearTimeout(timeoutId);

        const count = inFlightRequests.get(userId) || 1;
        if(count <= 1) {
            inFlightRequests.delete(userId);
        }else {
            inFlightRequests.set(userId, count - 1);
        }
    };

    // Timeout fallback — prevents leaks if stream hangs
    const timeoutId = setTimeout(cleanup, REQUEST_TIMEOUT_MS);

    // Clean up on request close (covers client disconnects)
    req.on("close", cleanup);
    
    // Also clean up on response finish as a safety net
    res.on("finish", cleanup);

    next();
}

export const aiBurstLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            code: "AI_BURST_LIMIT_EXCEEDED",
            message: "You're sending requests too fast. Please wait a minute before trying again."
        });
    }
});