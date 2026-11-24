// Дрібні помічники поверх node:http, щоб обійтись без фреймворків.
import type { IncomingMessage, ServerResponse } from "node:http";

/** Помилка, яку сервер перетворить на JSON-відповідь з потрібним статусом. */
export class HttpError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;
  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

/** Читає JSON-тіло запиту з обмеженням розміру. */
export async function readJson(req: IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  const type = req.headers["content-type"] ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Очікується Content-Type: application/json");
  }
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > maxBytes) throw new HttpError(413, `Тіло запиту більше за ${maxBytes} байт`);

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, `Тіло запиту більше за ${maxBytes} байт`);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Невалідний JSON");
  }
}
