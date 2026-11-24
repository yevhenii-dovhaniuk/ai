// Авторизація за токеном: заголовок `Authorization: Bearer <ACCESS_TOKEN>`.
import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "../http.ts";
import type { Middleware } from "../router.ts";

export function requireToken(expected: string): Middleware {
  const expectedHash = sha256(expected);
  return (next) => (ctx) => {
    const header = ctx.req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ", 2);
    if (scheme?.toLowerCase() !== "bearer" || !token || !safeEqual(sha256(token), expectedHash)) {
      throw new HttpError(401, "Потрібен правильний токен доступу", { "WWW-Authenticate": "Bearer" });
    }
    return next(ctx);
  };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();

// Порівняння за сталий час: час відповіді не підкаже, скільки символів токена вгадано.
const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
