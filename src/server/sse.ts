// Server-Sent Events: простий односторонній стрім подій сервер → браузер поверх HTTP.
// Формат кожної події:  "event: <назва>\ndata: <json>\n\n"
import type { ServerResponse } from "node:http";

export function openSse(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // nginx: не буферизувати
  });
  res.flushHeaders();
}

export function sendEvent(res: ServerResponse, event: string, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
