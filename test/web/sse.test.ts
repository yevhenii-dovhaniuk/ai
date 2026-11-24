import { test } from "node:test";
import assert from "node:assert/strict";
import { SseParser } from "../../web/src/sse.ts";

test("SseParser збирає події з довільних шматків", () => {
  const p = new SseParser();
  const stream = 'event: token\ndata: {"text":"При"}\n\nevent: token\ndata: {"text":"віт"}\n\nevent: done\ndata: {}\n\n';
  const events = [];
  for (let i = 0; i < stream.length; i += 7) events.push(...p.push(stream.slice(i, i + 7)));
  assert.deepEqual(
    events.map((e) => e.event),
    ["token", "token", "done"],
  );
  assert.equal(JSON.parse(events[1]!.data).text, "віт");
});

test("SseParser: CRLF, коментарі, багаторядкові data, подія без імені", () => {
  const p = new SseParser();
  const events = p.push(": ping\r\n\r\ndata: a\r\ndata: b\r\n\r\n");
  assert.deepEqual(events, [{ event: "message", data: "a\nb" }]);
});
