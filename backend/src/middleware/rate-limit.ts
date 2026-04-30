import type { NextFunction, Request, Response } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

function readIp(request: Request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return request.ip || 'unknown';
}

function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${readIp(request)}:${request.baseUrl}:${request.path}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      response.setHeader('Retry-After', retryAfterSeconds.toString());
      response.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
}

export const apiRateLimit = createRateLimiter(120, 60_000);
export const authRateLimit = createRateLimiter(20, 60_000);
