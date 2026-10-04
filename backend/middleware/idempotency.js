/**
 * DevFlow Idempotency & Duplicate Operation Protection Middleware
 * 
 * Prevents double-clicking, network retry duplication, and replay of state-changing operations.
 * Caches responses by Idempotency-Key (or auto-generated hash for rapid identical clicks)
 * with a sliding 2-minute TTL window.
 */

const idempotencyCache = new Map();
const TTL_MS = 2 * 60 * 1000; // 2 minutes

// Periodic purge of expired cache entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (entry.expiresAt <= now) {
      idempotencyCache.delete(key);
    }
  }
}, 60 * 1000).unref();

/**
 * Idempotency middleware factory
 * @param {Object} options
 * @param {boolean} [options.requireHeader=false] - If true, requires Idempotency-Key header
 * @param {number} [options.debounceWindowMs=2500] - Rapid double-click window
 */
export function idempotency(options = {}) {
  const { requireHeader = false, debounceWindowMs = 2500 } = options;

  return (req, res, next) => {
    // Only apply to state-changing operations
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const explicitKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (requireHeader && !explicitKey) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required for this operation'
      });
    }

    const userId = req.user?.id || req.user?.user_id || req.ip || 'anonymous';
    
    // Key identifier: either explicit header or deterministic hash of route + body for debouncing
    let cacheKey = null;
    let isDebounceOnly = false;

    if (explicitKey) {
      cacheKey = `idemp:${userId}:${explicitKey.trim()}`;
    } else if (debounceWindowMs > 0 && req.method === 'POST') {
      // Auto-debounce duplicate clicks on POST
      try {
        const payloadHash = JSON.stringify(req.body || {});
        cacheKey = `debounce:${userId}:${req.originalUrl || req.url}:${payloadHash}`;
        isDebounceOnly = true;
      } catch (e) {
        return next();
      }
    } else {
      return next();
    }

    const existing = idempotencyCache.get(cacheKey);

    if (existing) {
      // If operation is still processing
      if (existing.status === 'in-progress') {
        return res.status(409).json({
          error: 'An identical request is currently processing. Please wait.'
        });
      }

      // If cached response exists within TTL
      if (existing.status === 'completed' && existing.expiresAt > Date.now()) {
        res.set('Idempotent-Replay', 'true');
        return res.status(existing.statusCode).json(existing.body);
      }
    }

    // Register in-progress state
    const ttl = isDebounceOnly ? debounceWindowMs : TTL_MS;
    idempotencyCache.set(cacheKey, {
      status: 'in-progress',
      expiresAt: Date.now() + ttl,
    });

    // Intercept response to cache result
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful or client error responses (don't cache 500 server crashes)
      if (res.statusCode < 500) {
        idempotencyCache.set(cacheKey, {
          status: 'completed',
          statusCode: res.statusCode,
          body,
          expiresAt: Date.now() + ttl,
        });
      } else {
        idempotencyCache.delete(cacheKey);
      }
      return originalJson(body);
    };

    next();
  };
}

export default idempotency;
