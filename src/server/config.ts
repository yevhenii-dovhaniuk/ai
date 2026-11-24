// Налаштування сервера зі змінних оточення (.env). Невалідні значення зупиняють старт одразу.
import { randomBytes } from "node:crypto";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  host: string;
  port: number;
  /** Токен доступу до API. */
  accessToken: string;
  /** true, якщо ACCESS_TOKEN не задано і токен згенеровано при старті. */
  accessTokenGenerated: boolean;
  rateLimitPerMinute: number;
  trustProxy: boolean;
  logLevel: LogLevel;
  /** Папка зі зібраним веб-клієнтом. */
  webDir: string;
  corpusPath: string;
  ngramOrder: number;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  const token = (env.ACCESS_TOKEN ?? "").trim();
  if (token && token.length < 16) {
    throw new Error("ACCESS_TOKEN закороткий: потрібно щонайменше 16 символів");
  }

  return {
    host: env.HOST || "0.0.0.0",
    port: int(env, "PORT", 3000, 0, 65535),
    accessToken: token || randomBytes(24).toString("base64url"),
    accessTokenGenerated: !token,
    rateLimitPerMinute: int(env, "RATE_LIMIT_PER_MINUTE", 30, 1, 10_000),
    trustProxy: bool(env, "TRUST_PROXY", false),
    logLevel: oneOf(env, "LOG_LEVEL", ["debug", "info", "warn", "error"], "info"),
    webDir: path.resolve(env.WEB_DIR || "dist/web"),
    corpusPath: path.resolve(env.CORPUS_PATH || "data/corpus.txt"),
    ngramOrder: int(env, "NGRAM_ORDER", 5, 1, 12),
  };
}

function int(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} має бути цілим числом від ${min} до ${max}, отримано "${raw}"`);
  }
  return value;
}

function bool(env: Env, name: string, fallback: boolean): boolean {
  const raw = env[name]?.toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  if (["1", "true", "yes"].includes(raw)) return true;
  if (["0", "false", "no"].includes(raw)) return false;
  throw new Error(`${name} має бути true або false, отримано "${raw}"`);
}

function oneOf<T extends string>(env: Env, name: string, allowed: readonly T[], fallback: T): T {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new Error(`${name} має бути одним з: ${allowed.join(", ")}; отримано "${raw}"`);
  }
  return raw as T;
}
