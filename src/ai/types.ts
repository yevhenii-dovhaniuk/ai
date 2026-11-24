// Спільні типи ШІ. Сервер знає лише ці інтерфейси, тож модель можна замінити
// (n-gram → свій трансформер → зовнішня модель), не чіпаючи сервер і веб.

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/** Токенізатор: текст ↔ масив номерів токенів (див. docs/ai/01-tokenization.md). */
export interface Tokenizer {
  readonly vocabSize: number;
  encode(text: string): number[];
  decode(ids: readonly number[]): string;
}

export interface GenerateOptions {
  /** Максимум токенів у відповіді. */
  maxTokens: number;
  /** 0 = завжди найімовірніший токен, 1 = як навчилась, >1 = хаотичніше. */
  temperature: number;
  /** Брати лише k найімовірніших токенів (0 = без обмеження). */
  topK: number;
  /** Зупинити генерацію, щойно з'явиться один із цих рядків (сам рядок не віддається). */
  stop?: string[];
  /** Скасування: клієнт закрив з'єднання тощо. */
  signal?: AbortSignal;
}

export interface ModelInfo {
  name: string;
  description: string;
  /** Як сервер має перетворити діалог на текст (див. src/ai/chat.ts). */
  promptFormat: PromptFormat;
  vocabSize: number;
  contextSize: number;
  parameters: number;
  /** Довільні метрики: val loss, perplexity, час навчання… */
  metrics: Record<string, number>;
}

export type PromptFormat = "plain" | "chat-template";

/** Мовна модель: продовжує текст, віддаючи його шматочками (стрімом). */
export interface LanguageModel {
  readonly info: ModelInfo;
  generate(prompt: string, options: GenerateOptions): AsyncGenerator<string>;
}
