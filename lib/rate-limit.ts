/**
 * Rate-limit en mémoire (par instance serverless). Suffisant pour protéger
 * l'opt-in contre les abus basiques. Pour une protection forte multi-instance,
 * brancher un store partagé (Upstash, etc.).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number }
): { allowed: boolean } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
    return { allowed: true };
  }

  if (bucket.count >= opts.limit) {
    return { allowed: false };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
