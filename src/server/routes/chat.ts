// POST /api/chat: діалог → відповідь моделі стрімом (SSE).
//
// Запит:  { "messages": [{ "role": "user", "content": "Привіт" }], "temperature": 0.8, "maxTokens": 300, "topK": 20 }
// Відповідь (text/event-stream):
//   event: token   data: {"text":"При"}
//   event: token   data: {"text":"віт"}
//   event: done    data: {"finishReason":"stop","tokens":42,"ms":380}
//   event: error   data: {"message":"..."}            ← якщо модель впала посеред відповіді
import { formatPrompt, type ChatMessage, type GenerateResult, type LanguageModel, type Role } from "../../ai/index.ts";
import { HttpError, readJson } from "../http.ts";
import type { Logger } from "../logger.ts";
import type { Handler } from "../router.ts";
import { openSse, sendEvent } from "../sse.ts";

export const LIMITS = {
  messages: 50,
  messageChars: 4000,
  totalChars: 20_000,
  maxTokens: 1000,
} as const;

export interface ChatRequest {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  topK: number;
}

export function chat(model: LanguageModel, logger: Logger): Handler {
  return async ({ req, res, ip }) => {
    const body = parseChatRequest(await readJson(req));
    const { prompt, stop } = formatPrompt(body.messages, model.info.promptFormat);

    // Клієнт закрив вкладку / перервав запит → зупиняємо генерацію, щоб не палити CPU
    const abort = new AbortController();
    res.on("close", () => abort.abort());

    openSse(res);
    const started = performance.now();
    const stream = model.generate(prompt, { ...body, stop, signal: abort.signal });
    let result: GenerateResult;
    try {
      for (;;) {
        const step = await stream.next();
        if (step.done) {
          result = step.value;
          break;
        }
        sendEvent(res, "token", { text: step.value });
      }
    } catch (err) {
      logger.error("помилка генерації", { error: String(err) });
      sendEvent(res, "error", { message: "Модель не змогла згенерувати відповідь" });
      return void res.end();
    }

    const ms = Math.round(performance.now() - started);
    sendEvent(res, "done", { ...result, ms });
    res.end();
    logger.info("chat", { ip, finishReason: result.finishReason, tokens: result.tokens, ms });
  };
}

const ROLES: readonly Role[] = ["system", "user", "assistant"];

export function parseChatRequest(body: unknown): ChatRequest {
  if (!isObject(body)) throw new HttpError(400, "Очікується JSON-об'єкт");
  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > LIMITS.messages) {
    throw new HttpError(400, `messages: масив з 1–${LIMITS.messages} повідомлень`);
  }
  let total = 0;
  const parsed = messages.map((m, i): ChatMessage => {
    if (!isObject(m) || !ROLES.includes(m.role as Role) || typeof m.content !== "string") {
      throw new HttpError(400, `messages[${i}]: потрібні role (${ROLES.join("|")}) і content (рядок)`);
    }
    if (m.content.length > LIMITS.messageChars) {
      throw new HttpError(400, `messages[${i}]: не довше ${LIMITS.messageChars} символів`);
    }
    total += m.content.length;
    return { role: m.role as Role, content: m.content };
  });
  if (total > LIMITS.totalChars) throw new HttpError(400, `Діалог довший за ${LIMITS.totalChars} символів`);
  if (!parsed.some((m) => m.role === "user")) throw new HttpError(400, "Потрібне хоча б одне повідомлення user");

  return {
    messages: parsed,
    temperature: num(body.temperature, "temperature", 0.8, 0, 2),
    maxTokens: Math.round(num(body.maxTokens, "maxTokens", 300, 1, LIMITS.maxTokens)),
    topK: Math.round(num(body.topK, "topK", 20, 0, 1000)),
  };
}

function num(value: unknown, name: string, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new HttpError(400, `${name}: число від ${min} до ${max}`);
  }
  return value;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
