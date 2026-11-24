// Збирає HTTP-застосунок: /api/* → маршрути API, решта → файли веб-клієнта.
import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import type { Config } from "./config.ts";
import { HttpError, sendJson } from "./http.ts";
import type { Logger } from "./logger.ts";
import { Router, type Context } from "./router.ts";
import { health } from "./routes/health.ts";
import { serveStatic } from "./static.ts";

export interface AppDeps {
  config: Config;
  logger: Logger;
}

export function createApp(deps: AppDeps): RequestListener {
  const { config, logger } = deps;

  const api = new Router().get("/api/health", health);
  const web = serveStatic(config.webDir);

  return async (req: IncomingMessage, res: ServerResponse) => {
    const started = performance.now();
    const url = new URL(req.url ?? "/", "http://localhost");
    const ctx: Context = { req, res, url, ip: clientIp(req, config.trustProxy) };

    res.on("finish", () => {
      logger.debug("request", {
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        ms: Math.round(performance.now() - started),
        ip: ctx.ip,
      });
    });

    try {
      if (!url.pathname.startsWith("/api/")) return await web(ctx);

      const match = api.match(req.method ?? "GET", url.pathname);
      if (match && "handler" in match) return await match.handler(ctx);
      if (match) throw new HttpError(405, "Метод не підтримується", { Allow: match.notAllowed.join(", ") });
      throw new HttpError(404, "Не знайдено");
    } catch (err) {
      handleError(err, ctx, logger);
    }
  };
}

function handleError(err: unknown, { res, url }: Context, logger: Logger): void {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : "Внутрішня помилка сервера";
  if (status >= 500) logger.error("помилка обробки запиту", { path: url.pathname, error: String(err) });

  if (res.headersSent) {
    res.destroy(); // відповідь уже почали віддавати, лишається тільки обірвати з'єднання
    return;
  }
  sendJson(res, status, { error: message }, err instanceof HttpError ? err.headers : {});
}

/**
 * IP клієнта. За reverse proxy справжня адреса в X-Forwarded-For: беремо ОСТАННІЙ запис,
 * бо його дописав наш проксі. Перші записи клієнт може підробити.
 */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (trustProxy && typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",").at(-1)!.trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}
