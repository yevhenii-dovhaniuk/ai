// Мінімальний логер: час, рівень, повідомлення, додаткові поля.
import type { LogLevel } from "./config.ts";

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Fields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
}

export function createLogger(level: LogLevel = "info"): Logger {
  const write = (lvl: LogLevel, msg: string, fields?: Fields) => {
    if (order[lvl] < order[level]) return;
    const extra = fields && Object.keys(fields).length ? " " + JSON.stringify(fields) : "";
    const line = `${new Date().toISOString()} ${lvl.toUpperCase().padEnd(5)} ${msg}${extra}`;
    (lvl === "error" || lvl === "warn" ? console.error : console.log)(line);
  };
  return {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
  };
}

/** Логер, що нічого не пише: для тестів. */
export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
