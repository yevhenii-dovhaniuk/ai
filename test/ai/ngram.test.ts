import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../../src/ai/metrics.ts";
import { NGramModel } from "../../src/ai/ngram.ts";
import { argmax, sample, seededRng, softmax } from "../../src/ai/sampling.ts";

test("softmax: сума 1, більший logit → більша ймовірність", () => {
  const p = softmax([2, 1, 0]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(p[0]! > p[1]! && p[1]! > p[2]!);
});

test("softmax: низька температура загострює розподіл", () => {
  assert.ok(softmax([2, 1, 0], 0.1)[0]! > softmax([2, 1, 0], 1)[0]!);
});

test("sample: temperature 0 = argmax, topK=1 = argmax", () => {
  const logits = [0.1, 3, 0.5];
  assert.equal(sample(logits, { temperature: 0, topK: 0 }), 1);
  const rng = seededRng(1);
  for (let i = 0; i < 20; i++) assert.equal(sample(logits, { temperature: 1, topK: 1 }, rng), 1);
});

test("sample: частоти відповідають ймовірностям", () => {
  const rng = seededRng(42);
  const logits = [Math.log(0.75), Math.log(0.25)];
  let zeros = 0;
  for (let i = 0; i < 4000; i++) if (sample(logits, { temperature: 1, topK: 0 }, rng) === 0) zeros++;
  assert.ok(Math.abs(zeros / 4000 - 0.75) < 0.03, `отримано ${zeros / 4000}`);
});

test("NGram вивчає детерміновану послідовність", () => {
  const ids = [1, 2, 3, 1, 2, 3, 1, 2, 3];
  const m = new NGramModel(2, 4);
  m.train(ids);
  assert.equal(argmax(m.logits([1])), 2);
  assert.equal(argmax(m.logits([2])), 3);
  assert.equal(argmax(m.logits([3])), 1);
});

test("NGram: backoff на коротший контекст для невідомого", () => {
  const m = new NGramModel(3, 5);
  m.train([1, 2, 3, 1, 2, 3]);
  // контексту [4, 2] не було, але [2] був → далі йде 3
  assert.equal(argmax(m.logits([4, 2])), 3);
});

test("evaluate: вищий порядок → менший loss на передбачуваному тексті", () => {
  const ids = Array.from({ length: 300 }, (_, i) => [1, 2, 1, 3][i % 4]!);
  const uni = new NGramModel(1, 4);
  const tri = new NGramModel(3, 4);
  uni.train(ids);
  tri.train(ids);
  assert.ok(evaluate(tri, ids).loss < evaluate(uni, ids).loss);
});
