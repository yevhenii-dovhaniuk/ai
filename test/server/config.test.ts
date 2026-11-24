import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../src/server/config.ts";

test("типові значення, токен генерується", () => {
  const c = loadConfig({});
  assert.equal(c.port, 3000);
  assert.equal(c.host, "0.0.0.0");
  assert.equal(c.accessTokenGenerated, true);
  assert.ok(c.accessToken.length >= 24);
});

test("значення з env", () => {
  const c = loadConfig({ PORT: "8080", ACCESS_TOKEN: "a".repeat(20), TRUST_PROXY: "true", NGRAM_ORDER: "3" });
  assert.equal(c.port, 8080);
  assert.equal(c.accessToken, "a".repeat(20));
  assert.equal(c.accessTokenGenerated, false);
  assert.equal(c.trustProxy, true);
  assert.equal(c.ngramOrder, 3);
});

test("невалідні значення дають зрозумілу помилку", () => {
  assert.throws(() => loadConfig({ PORT: "abc" }), /PORT/);
  assert.throws(() => loadConfig({ ACCESS_TOKEN: "short" }), /ACCESS_TOKEN/);
  assert.throws(() => loadConfig({ TRUST_PROXY: "maybe" }), /TRUST_PROXY/);
  assert.throws(() => loadConfig({ LOG_LEVEL: "loud" }), /LOG_LEVEL/);
});
