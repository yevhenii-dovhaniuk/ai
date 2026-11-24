// Оцінка якості моделі: середній cross-entropy loss на тексті, якого модель не бачила
// (див. docs/ai/05-training.md і 10-scale-and-eval.md).
import { softmax } from "./sampling.ts";

export interface NextTokenPredictor {
  readonly contextSize: number;
  logits(context: readonly number[]): ArrayLike<number>;
}

export interface EvalResult {
  /** Середнє −log p(правильний токен). Менше = краще. */
  loss: number;
  /** exp(loss): «зі скількох варіантів у середньому вагається модель». */
  perplexity: number;
  positions: number;
}

export function evaluate(model: NextTokenPredictor, ids: readonly number[], maxPositions = 20_000): EvalResult {
  const positions = Math.min(ids.length - 1, maxPositions);
  if (positions <= 0) return { loss: NaN, perplexity: NaN, positions: 0 };

  let total = 0;
  for (let i = 1; i <= positions; i++) {
    const context = ids.slice(Math.max(0, i - model.contextSize), i);
    const p = softmax(model.logits(context))[ids[i]!]!;
    total += -Math.log(Math.max(p, 1e-12));
  }
  const loss = total / positions;
  return { loss, perplexity: Math.exp(loss), positions };
}
