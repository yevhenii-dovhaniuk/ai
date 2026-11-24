// Ліміт запитів на IP за алгоритмом «відро з жетонами» (token bucket):
// у відрі до N жетонів, кожен запит забирає один, жетони поступово доливаються (N за хвилину).
import { HttpError } from "../http.ts";
import type { Middleware } from "../router.ts";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;

  constructor(perMinute: number, now: () => number = Date.now) {
    this.capacity = perMinute;
    this.refillPerMs = perMinute / 60_000;
    this.now = now;
  }

  /** Повертає 0, якщо запит дозволено, інакше скільки секунд чекати. */
  take(key: string): number {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs);
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 10_000) this.prune(now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }
    return Math.ceil((1 - bucket.tokens) / this.refillPerMs / 1000);
  }

  /** Прибирає повні відра, щоб мапа не росла безкінечно. */
  private prune(now: number): void {
    for (const [key, b] of this.buckets) {
      if (b.tokens + (now - b.updatedAt) * this.refillPerMs >= this.capacity) this.buckets.delete(key);
    }
  }
}

export function rateLimit(limiter: RateLimiter): Middleware {
  return (next) => (ctx) => {
    const waitSec = limiter.take(ctx.ip);
    if (waitSec > 0) {
      throw new HttpError(429, `Забагато запитів, спробуйте через ${waitSec} с`, {
        "Retry-After": String(waitSec),
      });
    }
    return next(ctx);
  };
}
