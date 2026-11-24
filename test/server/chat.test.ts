import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/server/app.ts";
import { silentLogger } from "../../src/server/logger.ts";
import { parseChatRequest } from "../../src/server/routes/chat.ts";
import { HttpError } from "../../src/server/http.ts";
import { fakeModel, startServer, testConfig, TEST_TOKEN } from "./helpers.ts";

const model = fakeModel("Привіт від моделі");
let server: Awaited<ReturnType<typeof startServer>>;
before(async () => {
  server = await startServer(createApp({ config: testConfig({ rateLimitPerMinute: 1000 }), logger: silentLogger, model }));
});
after(() => server.close());

const auth = { Authorization: `Bearer ${TEST_TOKEN}` };
const postChat = (body: unknown, headers: Record<string, string> = auth) =>
  fetch(`${server.url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

/** Розбирає SSE-текст на список подій. */
function parseSse(text: string): { event: string; data: any }[] {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? "message";
      const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? "null");
      return { event, data };
    });
}

test("без токена → 401", async () => {
  const res = await postChat({ messages: [{ role: "user", content: "hi" }] }, {});
  assert.equal(res.status, 401);
  assert.equal((await fetch(`${server.url}/api/info`)).status, 401);
});

test("GET /api/info з токеном", async () => {
  const res = await fetch(`${server.url}/api/info`, { headers: auth });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { model: { name: string } };
  assert.equal(body.model.name, "fake");
});

test("POST /api/chat стрімить токени і подію done", async () => {
  const res = await postChat({ messages: [{ role: "user", content: "Привіт" }], maxTokens: 50 });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);

  const events = parseSse(await res.text());
  const text = events.filter((e) => e.event === "token").map((e) => e.data.text).join("");
  assert.equal(text, "Привіт від моделі");
  const done = events.at(-1)!;
  assert.equal(done.event, "done");
  assert.equal(done.data.finishReason, "stop");
  assert.equal(done.data.tokens, 3);

  // сервер передав моделі діалог у форматі chat template
  assert.equal(model.lastPrompt, "<|user|>Привіт<|end|>\n<|assistant|>");
});

test("maxTokens обрізає відповідь → finishReason length", async () => {
  const events = parseSse(await (await postChat({ messages: [{ role: "user", content: "x" }], maxTokens: 1 })).text());
  assert.equal(events.at(-1)!.data.finishReason, "length");
});

test("невалідні запити → 400 / 415", async () => {
  assert.equal((await postChat({ messages: [] })).status, 400);
  assert.equal((await postChat({ messages: [{ role: "hacker", content: "x" }] })).status, 400);
  assert.equal((await postChat({ messages: [{ role: "user", content: "x" }], temperature: 9 })).status, 400);
  const notJson = await fetch(`${server.url}/api/chat`, { method: "POST", headers: auth, body: "hi" });
  assert.equal(notJson.status, 415);
});

test("parseChatRequest: типові значення", () => {
  const r = parseChatRequest({ messages: [{ role: "user", content: "x" }] });
  assert.deepEqual([r.temperature, r.maxTokens, r.topK], [0.8, 300, 20]);
  assert.throws(() => parseChatRequest({ messages: [{ role: "system", content: "x" }] }), HttpError);
});
