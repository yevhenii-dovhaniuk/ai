// GET /api/info: що за модель працює. Веб-клієнт також використовує цей запит,
// щоб перевірити, що токен правильний.
import type { LanguageModel } from "../../ai/index.ts";
import { sendJson } from "../http.ts";
import type { Handler } from "../router.ts";
import { LIMITS } from "./chat.ts";

export function info(model: LanguageModel): Handler {
  return ({ res }) => sendJson(res, 200, { model: model.info, limits: LIMITS });
}
