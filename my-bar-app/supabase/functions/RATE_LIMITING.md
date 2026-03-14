# Rate Limiting Implementation

## Overview

Rate limiting has been implemented across all Supabase Edge Functions to prevent abuse, ensure fair usage, and protect against DoS attacks.

## Implementation Details

### Rate Limiter Module

Location: `supabase/functions/_shared/rateLimiter.ts`

The rate limiter uses a **sliding window algorithm** with in-memory storage for efficient rate limiting.

### Features

- ✅ **IP-based rate limiting** - Tracks requests per client IP address
- ✅ **Configurable limits** - Different limits for different endpoint types
- ✅ **Standard headers** - Returns `X-RateLimit-*` headers in responses
- ✅ **Automatic cleanup** - Removes expired entries to prevent memory leaks
- ✅ **Proper error responses** - Returns 429 status with retry information

### Rate Limit Configurations

| Endpoint Type | Limit | Window | Use Case |
|--------------|-------|--------|----------|
| Standard API | 100 requests | 1 minute | General API endpoints like create-checkout-session |
| Webhooks | 1000 requests | 1 minute | Stripe webhook endpoint (high volume expected) |
| Auth Endpoints | 10 requests | 1 minute | Authentication/login endpoints (strict) |

## Applied Endpoints

### 1. Create Checkout Session
**File**: `supabase/functions/create-checkout-session/index.ts`  
**Limit**: 100 requests per minute per IP  
**Rationale**: Prevents payment fraud and ensures fair usage during checkout

```typescript
import { apiRateLimiter, getClientIdentifier, createRateLimitResponse } from '../_shared/rateLimiter.ts'

const clientId = getClientIdentifier(req)
const rateLimitResult = apiRateLimiter.check(clientId)

if (!rateLimitResult.allowed) {
  return createRateLimitResponse(rateLimitResult, apiRateLimiter, corsHeaders)
}
```

### 2. Stripe Webhook
**File**: `supabase/functions/stripe-webhook/index.ts`  
**Limit**: 1000 requests per minute per IP  
**Rationale**: Allows high volume webhook processing while preventing spam

```typescript
import { webhookRateLimiter, getClientIdentifier, createRateLimitResponse } from '../_shared/rateLimiter.ts'

const clientId = getClientIdentifier(req)
const rateLimitResult = webhookRateLimiter.check(clientId)

if (!rateLimitResult.allowed) {
  return createRateLimitResponse(rateLimitResult, webhookRateLimiter, {})
}
```

## Response Headers

When a request is processed, the following headers are included in the response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-03-11T15:30:00.000Z
```

### Header Descriptions

- `X-RateLimit-Limit`: Maximum requests allowed in the current window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: ISO 8601 timestamp when the rate limit resets

## Rate Limit Exceeded Response

When rate limit is exceeded, clients receive:

**Status Code**: `429 Too Many Requests`

**Response Body**:
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-03-11T15:30:00.000Z
```

## Client Identification

Client identification uses the following priority:

1. `x-forwarded-for` header (first IP in chain)
2. `x-real-ip` header
3. Fallback to 'unknown' (not ideal but prevents crashes)

This ensures proper identification even when requests pass through proxies or CDNs.

## Testing Rate Limits

### Manual Testing

Use curl or similar tools to test rate limits:

```bash
# Test create-checkout-session rate limit (100 req/min)
for i in {1..105}; do
  curl -X POST https://your-project.supabase.co/functions/v1/create-checkout-session \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  echo "Request $i"
done
```

After 100 requests, you should receive 429 responses.

### Load Testing

Use k6 for comprehensive rate limit testing:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const response = http.post(
    'https://your-project.supabase.co/functions/v1/create-checkout-session',
    JSON.stringify({ test: true }),
    {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json',
      },
    }
  );

  check(response, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
  });
}
```

## Monitoring

### Logs

Rate limit events are logged in Supabase Edge Function logs:

- ✅ **Allowed**: `✅ Rate limit check passed: <clientId> remaining: <count>`
- ⚠️ **Blocked**: `⚠️ Rate limit exceeded for client: <clientId>`

### Recommended Alerts

Set up monitoring for:

1. **High rate limit rejections** - May indicate attack or misconfiguration
2. **Unusual traffic patterns** - Sudden spikes in specific IPs
3. **Legitimate users hitting limits** - May need limit adjustment

## Customization

### Adjusting Limits

Edit `supabase/functions/_shared/rateLimiter.ts`:

```typescript
// Increase API limit to 200 requests per minute
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200,    // Changed from 100
});
```

### Creating Custom Rate Limiters

```typescript
// Create a strict rate limiter for sensitive endpoints
export const strictRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,  // 1 minute window
  maxRequests: 5,        // Only 5 requests allowed
});
```

Then import and use in your Edge Function:

```typescript
import { strictRateLimiter, getClientIdentifier, createRateLimitResponse } from '../_shared/rateLimiter.ts'

const result = strictRateLimiter.check(getClientIdentifier(req))
if (!result.allowed) {
  return createRateLimitResponse(result, strictRateLimiter, corsHeaders)
}
```

## Limitations & Considerations

### In-Memory Storage

The current implementation uses in-memory storage, which means:

- ✅ **Fast**: No database queries required
- ✅ **Simple**: No external dependencies
- ⚠️ **Single Instance**: Each Edge Function instance tracks limits independently
- ⚠️ **Resets on Restart**: Limits reset when function restarts

### For Distributed Rate Limiting

If you need distributed rate limiting across multiple Edge Function instances, consider:

1. **Upstash Redis**: Use `@upstash/ratelimit` with Redis backend
2. **Supabase Database**: Store rate limit counters in a table
3. **Cloudflare Workers**: Use Durable Objects for distributed state

### Migration to Distributed

Example using Supabase database for distributed rate limiting:

```typescript
// Store in database instead of memory
const { data } = await supabase
  .from('rate_limits')
  .select('count, reset_time')
  .eq('client_id', clientId)
  .single()

// Update count
if (data.count < maxRequests) {
  await supabase
    .from('rate_limits')
    .update({ count: data.count + 1 })
    .eq('client_id', clientId)
}
```

## Security Headers

Security headers have also been added to `netlify.toml`:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Referrer control
- `Permissions-Policy` - Restricts browser features
- `Content-Security-Policy` - Restricts resource loading

## Best Practices

1. **Monitor your limits** - Track rejection rates and adjust as needed
2. **Document for clients** - Inform API consumers about rate limits
3. **Use exponential backoff** - Implement retry logic with backoff in clients
4. **Test thoroughly** - Verify limits work in production
5. **Plan for scale** - Consider distributed solutions as you grow

## Support

For issues or questions about rate limiting:

1. Check Edge Function logs in Supabase Dashboard
2. Review the rate limiter code in `_shared/rateLimiter.ts`
3. Test with the examples provided above
4. Consider adjusting limits based on your usage patterns
