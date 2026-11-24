// Вибір наступного токена з logits (див. docs/ai/06-generation.md).

/** Генератор випадкових чисел [0, 1). Підміняється в тестах для відтворюваності. */
export type Rng = () => number;

/** Детермінований генератор (mulberry32): однаковий seed дає однакову послідовність. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** softmax(logits / T): logits → ймовірності, що в сумі дають 1. */
export function softmax(logits: ArrayLike<number>, temperature = 1): Float64Array {
  const out = new Float64Array(logits.length);
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i]!);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp((logits[i]! - max) / temperature); // −max: щоб exp не переповнився
    sum += out[i]!;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= sum;
  return out;
}

export function argmax(xs: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i]! > xs[best]!) best = i;
  return best;
}

export interface SampleOptions {
  temperature: number;
  topK: number;
}

export function sample(logits: ArrayLike<number>, { temperature, topK }: SampleOptions, rng: Rng = Math.random): number {
  if (temperature <= 0) return argmax(logits); // greedy

  let scores = Float64Array.from(logits);
  if (topK > 0 && topK < scores.length) {
    const kth = Float64Array.from(scores).sort().reverse()[topK - 1]!;
    scores = scores.map((s) => (s < kth ? -Infinity : s));
  }

  const probs = softmax(scores, temperature);
  let r = rng();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i]!;
    if (r <= 0) return i;
  }
  return argmax(probs); // захист від похибок округлення
}
