// GET /api/health: перевірка «сервер живий» для моніторингу, Docker і людей. Без токена.
import { sendJson } from "../http.ts";
import type { Handler } from "../router.ts";

const startedAt = Date.now();

export const health: Handler = ({ res }) => {
  sendJson(res, 200, { ok: true, uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
};
