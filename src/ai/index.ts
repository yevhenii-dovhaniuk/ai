// Створення моделі для сервера. Зараз: «навчання» n-gram чернетки на корпусі при старті.
// Далі тут з'явиться завантаження ваг трансформера з checkpoints/ (див. docs/ai/11-roadmap.md).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DraftLanguageModel } from "./draft-model.ts";
import { evaluate } from "./metrics.ts";
import { NGramModel } from "./ngram.ts";
import { CharTokenizer } from "./tokenizer.ts";
import type { LanguageModel } from "./types.ts";

export type * from "./types.ts";
export { formatPrompt } from "./chat.ts";

export interface DraftModelConfig {
  corpusPath: string;
  /** n у n-gram: контекст = n-1 символів. */
  order: number;
  tokenDelayMs?: number;
}

export async function createDraftModel(config: DraftModelConfig): Promise<LanguageModel> {
  const started = performance.now();
  const text = (await readFile(config.corpusPath, "utf8")).replace(/\r\n/g, "\n");

  // 1. токенізатор: словник із символів корпусу
  const tokenizer = CharTokenizer.fromText(text);
  const ids = tokenizer.encode(text);

  // 2. train/val: останні 10% тексту модель не бачить, на них міряємо якість
  const split = Math.floor(ids.length * 0.9);
  const ngram = new NGramModel(config.order, tokenizer.vocabSize);
  ngram.train(ids.slice(0, split));
  const val = evaluate(ngram, ids.slice(split));
  // для подальшої роботи довчаємо і на val-частині: модель знатиме весь корпус
  ngram.train(ids.slice(split));

  return new DraftLanguageModel(
    tokenizer,
    ngram,
    {
      name: `char-${config.order}gram`,
      description: `Чернетка: символьна ${config.order}-gram модель на ${path.basename(config.corpusPath)}. Не розуміє діалогу, лише продовжує текст.`,
      promptFormat: "plain",
      vocabSize: tokenizer.vocabSize,
      contextSize: ngram.contextSize,
      parameters: ngram.parameters,
      metrics: {
        corpusChars: ids.length,
        valLoss: round(val.loss),
        valPerplexity: round(val.perplexity),
        trainMs: Math.round(performance.now() - started),
      },
    },
    { tokenDelayMs: config.tokenDelayMs },
  );
}

const round = (x: number) => Math.round(x * 1000) / 1000;
