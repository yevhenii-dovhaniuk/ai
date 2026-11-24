import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPrompt } from "../../src/ai/chat.ts";
import { DraftLanguageModel } from "../../src/ai/draft-model.ts";
import { createDraftModel } from "../../src/ai/index.ts";
import { NGramModel } from "../../src/ai/ngram.ts";
import { seededRng } from "../../src/ai/sampling.ts";
import { StopMatcher } from "../../src/ai/stop.ts";
import { CharTokenizer } from "../../src/ai/tokenizer.ts";
import type { GenerateResult, LanguageModel } from "../../src/ai/types.ts";

async function collect(model: LanguageModel, prompt: string, opts: Parameters<LanguageModel["generate"]>[1]) {
  const it = model.generate(prompt, opts);
  let text = "";
  for (;;) {
    const r = await it.next();
    if (r.done) return { text, result: r.value as GenerateResult };
    text += r.value;
  }
}

function tinyModel(corpus: string, order = 3) {
  const tok = CharTokenizer.fromText(corpus);
  const ngram = new NGramModel(order, tok.vocabSize);
  ngram.train(tok.encode(corpus));
  const info = { name: "t", description: "", promptFormat: "plain" as const, vocabSize: tok.vocabSize, contextSize: 2, parameters: 0, metrics: {} };
  return new DraftLanguageModel(tok, ngram, info, { rng: seededRng(7) });
}

test("StopMatcher: stop-рядок, що прийшов шматками, не потрапляє у вивід", () => {
  const m = new StopMatcher(["<|end|>"]);
  const out = ["Прив", "іт<", "|en", "d|>зайве"].map((c) => m.push(c));
  assert.equal(out.map((o) => o.text).join(""), "Привіт");
  assert.equal(out.at(-1)!.stopped, true);
});

test("StopMatcher: схожий, але не stop-рядок віддається повністю", () => {
  const m = new StopMatcher(["<|end|>"]);
  const text = m.push("a<|en").text + m.push("x").text + m.flush();
  assert.equal(text, "a<|enx");
});

test("formatPrompt: chat-template і plain", () => {
  const msgs = [
    { role: "system" as const, content: "Будь коротким" },
    { role: "user" as const, content: "Привіт" },
  ];
  const t = formatPrompt(msgs, "chat-template");
  assert.equal(t.prompt, "<|system|>Будь коротким<|end|>\n<|user|>Привіт<|end|>\n<|assistant|>");
  assert.ok(t.stop.includes("<|end|>"));
  assert.equal(formatPrompt(msgs, "plain").prompt, "Привіт ");
});

test("DraftLanguageModel: greedy відтворює вивчений текст", async () => {
  const model = tinyModel("абвгд абвгд абвгд");
  const { text, result } = await collect(model, "аб", { maxTokens: 3, temperature: 0, topK: 0 });
  assert.equal(text, "вгд");
  assert.deepEqual(result, { finishReason: "length", tokens: 3 });
});

test("DraftLanguageModel: зупинка по stop-рядку і по сигналу", async () => {
  const model = tinyModel("абвгд абвгд абвгд");
  const stopped = await collect(model, "аб", { maxTokens: 50, temperature: 0, topK: 0, stop: ["г"] });
  assert.equal(stopped.text, "в");
  assert.equal(stopped.result.finishReason, "stop");

  const ctrl = new AbortController();
  ctrl.abort();
  const aborted = await collect(model, "аб", { maxTokens: 50, temperature: 0, topK: 0, signal: ctrl.signal });
  assert.equal(aborted.result.finishReason, "aborted");
});

test("createDraftModel на data/corpus.txt: модель краща за випадкову", async () => {
  const model = await createDraftModel({ corpusPath: "data/corpus.txt", order: 5 });
  const { valLoss } = model.info.metrics;
  assert.ok(valLoss! < Math.log(model.info.vocabSize), `valLoss ${valLoss} vs random ${Math.log(model.info.vocabSize)}`);
  const { text } = await collect(model, "Добрий ", { maxTokens: 40, temperature: 0.7, topK: 10 });
  assert.ok(text.length > 0);
});
