// Клієнт API сервера: /api/info і стрім /api/chat.
import type { ChatMessage, GenerateResult, ModelInfo } from "../../src/ai/types.ts";
import { SseParser } from "./sse.ts";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface InfoResponse {
  model: ModelInfo;
  limits: { messages: number; messageChars: number; totalChars: number; maxTokens: number };
}

export interface ChatParams {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  topK: number;
}

export type ChatEvent = { type: "token"; text: string } | ({ type: "done"; ms: number } & GenerateResult);

export async function fetchInfo(token: string): Promise<InfoResponse> {
  const res = await fetch("/api/info", { headers: authHeaders(token) });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as InfoResponse;
}

/** Надсилає діалог і віддає події відповіді в міру надходження. */
export async function* streamChat(token: string, params: ChatParams, signal: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
  });
  if (!res.ok || !res.body) throw await toError(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parser = new SseParser();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      for (const e of parser.push(value)) {
        const data = JSON.parse(e.data);
        if (e.event === "token") yield { type: "token", text: data.text };
        else if (e.event === "done") yield { type: "done", ...data };
        else if (e.event === "error") throw new ApiError(500, data.message);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

async function toError(res: Response): Promise<ApiError> {
  let message = `Помилка сервера (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    /* тіло не JSON */
  }
  return new ApiError(res.status, message);
}
