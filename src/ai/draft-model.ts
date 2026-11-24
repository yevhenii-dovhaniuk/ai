// Чернетка LanguageModel: символьний токенізатор + n-gram + семплінг.
// Повний цикл генерації (docs/ai/06-generation.md) в мініатюрі.
import { setImmediate as nextTick } from "node:timers/promises";
import { setTimeout as sleep } from "node:timers/promises";
import type { NGramModel } from "./ngram.ts";
import { sample, type Rng } from "./sampling.ts";
import { StopMatcher } from "./stop.ts";
import type { GenerateOptions, GenerateResult, LanguageModel, ModelInfo, Tokenizer } from "./types.ts";

export interface DraftModelOptions {
  /** Пауза між токенами, мс. Лише щоб стрімінг було видно у веб-інтерфейсі. */
  tokenDelayMs?: number;
  rng?: Rng;
}

export class DraftLanguageModel implements LanguageModel {
  readonly info: ModelInfo;
  private readonly tokenizer: Tokenizer;
  private readonly ngram: NGramModel;
  private readonly tokenDelayMs: number;
  private readonly rng: Rng;

  constructor(tokenizer: Tokenizer, ngram: NGramModel, info: ModelInfo, options: DraftModelOptions = {}) {
    this.tokenizer = tokenizer;
    this.ngram = ngram;
    this.info = info;
    this.tokenDelayMs = options.tokenDelayMs ?? 0;
    this.rng = options.rng ?? Math.random;
  }

  async *generate(prompt: string, options: GenerateOptions): AsyncGenerator<string, GenerateResult> {
    const ids = this.tokenizer.encode(prompt);
    const stopper = new StopMatcher(options.stop);
    let tokens = 0;

    while (tokens < options.maxTokens) {
      if (options.signal?.aborted) return { finishReason: "aborted", tokens };

      // 1. logits наступного токена за останніми n-1 токенами → 2. вибір токена → 3. дописати
      const logits = this.ngram.logits(ids.slice(Math.max(0, ids.length - this.ngram.contextSize)));
      const next = sample(logits, options, this.rng);
      ids.push(next);
      tokens++;

      const { text, stopped } = stopper.push(this.tokenizer.decode([next]));
      if (text) yield text;
      if (stopped) return { finishReason: "stop", tokens };

      // віддати керування event loop, щоб сервер обслуговував інші запити під час генерації
      await (this.tokenDelayMs > 0 ? sleep(this.tokenDelayMs) : nextTick());
    }

    const rest = stopper.flush();
    if (rest) yield rest;
    return { finishReason: "length", tokens };
  }
}
