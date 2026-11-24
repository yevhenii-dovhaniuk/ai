// Найпростіший роутер: точний збіг методу і шляху.
import type { IncomingMessage, ServerResponse } from "node:http";

export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  /** IP клієнта (з урахуванням TRUST_PROXY). */
  ip: string;
}

export type Handler = (ctx: Context) => void | Promise<void>;

/** Обгортка над обробником: авторизація, ліміти тощо. */
export type Middleware = (next: Handler) => Handler;

export type Match = { handler: Handler } | { notAllowed: string[] } | null;

export class Router {
  private readonly routes = new Map<string, Map<string, Handler>>(); // path → method → handler

  get(path: string, handler: Handler): this {
    return this.add("GET", path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.add("POST", path, handler);
  }

  add(method: string, path: string, handler: Handler): this {
    const byMethod = this.routes.get(path) ?? new Map<string, Handler>();
    byMethod.set(method, handler);
    this.routes.set(path, byMethod);
    return this;
  }

  match(method: string, path: string): Match {
    const byMethod = this.routes.get(path);
    if (!byMethod) return null;
    const handler = byMethod.get(method) ?? (method === "HEAD" ? byMethod.get("GET") : undefined);
    return handler ? { handler } : { notAllowed: [...byMethod.keys()] };
  }
}

/** compose(a, b)(h) === a(b(h)): перший middleware виконується першим. */
export function compose(...middlewares: Middleware[]): Middleware {
  return (handler) => middlewares.reduceRight((next, mw) => mw(next), handler);
}
