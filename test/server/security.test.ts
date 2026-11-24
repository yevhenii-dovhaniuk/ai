import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../../src/server/http.ts";
import type { Context } from "../../src/server/router.ts";
import { requireToken } from "../../src/server/security/auth.ts";
import { RateLimiter, rateLimit } from "../../src/server/security/rate-limit.ts";

const ctxWith = (authorization?: string, ip = "1.2.3.4") =>
  ({ req: { headers: authorization ? { authorization } : {} }, ip }) as unknown as Context;

test("requireToken: пропускає правильний токен і блокує решту", () => {
  const handler = requireToken("secret-token-123456")(() => {});
  assert.doesNotThrow(() => handler(ctxWith("Bearer secret-token-123456")));
  for (const bad of [undefined, "Bearer wrong", "Basic secret-token-123456", "Bearer "]) {
    assert.throws(
      () => handler(ctxWith(bad)),
      (e: unknown) => e instanceof HttpError && e.status === 401,
    );
  }
});

test("RateLimiter: N запитів дозволено, далі чекати, потім жетони доливаються", () => {
  let now = 0;
  const limiter = new RateLimiter(3, () => now);
  assert.equal(limiter.take("a"), 0);
  assert.equal(limiter.take("a"), 0);
  assert.equal(limiter.take("a"), 0);
  assert.ok(limiter.take("a") > 0, "4-й запит блокується");
  assert.equal(limiter.take("b"), 0, "інша IP має своє відро");
  now += 20_000; // 3 жетони/хв → за 20 с доливається 1
  assert.equal(limiter.take("a"), 0);
});

test("rateLimit middleware повертає 429 з Retry-After", () => {
  const handler = rateLimit(new RateLimiter(1))(() => {});
  handler(ctxWith());
  assert.throws(
    () => handler(ctxWith()),
    (e: unknown) => e instanceof HttpError && e.status === 429 && Number(e.headers["Retry-After"]) > 0,
  );
});
