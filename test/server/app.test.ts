import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { clientIp, createApp } from "../../src/server/app.ts";
import { silentLogger } from "../../src/server/logger.ts";
import { startServer, testConfig } from "./helpers.ts";

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => {
  server = await startServer(createApp({ config: testConfig(), logger: silentLogger }));
});
after(() => server.close());

test("GET /api/health → 200", async () => {
  const res = await fetch(`${server.url}/api/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean };
  assert.equal(body.ok, true);
});

test("невідомий API-шлях → 404 JSON", async () => {
  const res = await fetch(`${server.url}/api/nope`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /json/);
});

test("неправильний метод → 405 з Allow", async () => {
  const res = await fetch(`${server.url}/api/health`, { method: "DELETE" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET");
});

test("clientIp: X-Forwarded-For лише з TRUST_PROXY, береться останній запис", () => {
  const req = {
    headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.7" },
    socket: { remoteAddress: "10.0.0.2" },
  } as unknown as IncomingMessage;
  assert.equal(clientIp(req, false), "10.0.0.2");
  assert.equal(clientIp(req, true), "203.0.113.7");
});
