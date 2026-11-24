// Роздача зібраного веб-клієнта (dist/web) з захистом від виходу за межі папки.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./http.ts";
import type { Handler } from "./router.ts";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/** Заголовки безпеки для сторінок: заборона вбудовування в чужі сайти, сторонніх скриптів тощо. */
export const securityHeaders: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

export function serveStatic(rootDir: string): Handler {
  const root = path.resolve(rootDir);

  return async ({ req, res, url }) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      throw new HttpError(405, "Метод не підтримується", { Allow: "GET, HEAD" });
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      throw new HttpError(400, "Невалідний шлях");
    }
    if (pathname.includes("\0")) throw new HttpError(400, "Невалідний шлях");
    if (pathname.endsWith("/")) pathname += "index.html";

    const file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) throw new HttpError(404, "Не знайдено");

    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      const hint = pathname === "/index.html" ? " (зберіть веб-клієнт: npm run build:web)" : "";
      throw new HttpError(404, "Не знайдено" + hint);
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": info.size,
      // імена файлів без хешів, тому браузер щоразу перевіряє свіжість (дешево, 304 не реалізуємо для простоти)
      "Cache-Control": "no-cache",
      ...securityHeaders,
    });
    if (req.method === "HEAD") return void res.end();

    await new Promise<void>((resolve, reject) => {
      createReadStream(file).on("error", reject).on("end", resolve).pipe(res);
    });
  };
}
