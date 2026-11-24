// Налаштування та історія чату в localStorage (живуть у браузері телефона).
import type { ChatMessage } from "../../src/ai/types.ts";

export interface Settings {
  token: string;
  temperature: number;
  maxTokens: number;
  topK: number;
}

export const defaultSettings: Settings = { token: "", temperature: 0.8, maxTokens: 300, topK: 20 };

const KEYS = { settings: "ai.settings", history: "ai.history" } as const;

export function loadSettings(): Settings {
  return { ...defaultSettings, ...read<Partial<Settings>>(KEYS.settings, {}) };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function loadHistory(): ChatMessage[] {
  const history = read<unknown>(KEYS.history, []);
  return Array.isArray(history) ? (history as ChatMessage[]) : [];
}

export function saveHistory(messages: ChatMessage[]): void {
  localStorage.setItem(KEYS.history, JSON.stringify(messages));
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
