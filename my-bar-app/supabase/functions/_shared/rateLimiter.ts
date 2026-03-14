/**
 * Rate Limiter for Supabase Edge Functions
 * Implements sliding window algorithm with in-memory storage
 * 
 * Features:
 * - IP-based rate limiting
 * - Configurable window and request limits
 * - Automatic cleanup of old entries
 * - Returns rate limit headers
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests in window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request should be rate limited
   * @param identifier - Unique identifier (IP address, user ID, etc.)
   * @returns Object with allowed status and rate limit info
   */
  check(identifier: string): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    // Clean up old entries periodically
    if (this.requests.size > 10000) {
      this.cleanup();
    }

    // No previous requests or window expired
    if (!entry || now > entry.resetTime) {
      const resetTime = now + this.config.windowMs;
      this.requests.set(identifier, { count: 1, resetTime });
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - 1,
        resetTime,
      };
    }

    // Within rate limit window
    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - entry.count,
        resetTime: entry.resetTime,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      limit: this.config.maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Get rate limit headers for response
   */
  getRateLimitHeaders(result: ReturnType<typeof this.check>): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    };
  }
}

/**
 * Extract client identifier from request
 * Uses IP address as primary identifier
 */
export function getClientIdentifier(req: Request): string {
  // Check for forwarded IP (common in proxy/CDN setups)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check for real IP header
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to request URL (not ideal but better than nothing)
  return 'unknown';
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  result: ReturnType<RateLimiter['check']>,
  rateLimiter: RateLimiter,
  corsHeaders: Record<string, string> = {}
): Response {
  const headers = {
    ...corsHeaders,
    ...rateLimiter.getRateLimitHeaders(result),
    'Content-Type': 'application/json',
  };

  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers,
    }
  );
}

// Export pre-configured rate limiters for different use cases

/**
 * Standard API rate limiter: 100 requests per minute
 */
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

/**
 * Webhook rate limiter: 1000 requests per minute (webhooks can be frequent)
 */
export const webhookRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000,
});

/**
 * Strict rate limiter for auth endpoints: 10 requests per minute
 */
export const authRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
});

export { RateLimiter };
