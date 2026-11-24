import { test } from "node:test";
import assert from "node:assert/strict";
import { CharTokenizer } from "../../src/ai/tokenizer.ts";

test("encode/decode повертає той самий текст", () => {
  const text = "Привіт, світе! Ґанок і їжак 🙂";
  const tok = CharTokenizer.fromText(text);
  assert.equal(tok.decode(tok.encode(text)), text);
});

test("словник: унікальні символи + UNK", () => {
  const tok = CharTokenizer.fromText("абба");
  assert.equal(tok.vocabSize, 3); // UNK, а, б
  assert.deepEqual(tok.encode("аб"), [1, 2]);
});

test("невідомий символ → UNK", () => {
  const tok = CharTokenizer.fromText("аб");
  assert.deepEqual(tok.encode("аz"), [1, CharTokenizer.UNK]);
});

test("toJSON відновлює той самий токенізатор", () => {
  const tok = CharTokenizer.fromText("hello світ");
  const copy = new CharTokenizer(tok.toJSON().chars);
  assert.deepEqual(copy.encode("світ hello"), tok.encode("світ hello"));
});
