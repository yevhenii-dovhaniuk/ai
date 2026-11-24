import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../../src/server/app.ts";
import { silentLogger } from "../../src/server/logger.ts";
import { fakeModel, startServer, testConfig } from "./helpers.ts";

let dir: string;
let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ai-static-"));
  await mkdir(path.join(dir, "web"));
  await writeFile(path.join(dir, "web", "index.html"), "<h1>hi</h1>");
  await writeFile(path.join(dir, "web", "app.js"), "console.log(1)");
  await writeFile(path.join(dir, "secret.txt"), "top secret");
  const config = testConfig({ webDir: path.join(dir, "web") });
  server = await startServer(createApp({ config, logger: silentLogger, model: fakeModel() }));
});
after(async () => {
  await server.close();
  await rm(dir, { recursive: true, force: true });
});

test("/ віддає index.html із заголовками безпеки", async () => {
  const res = await fetch(`${server.url}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.ok(res.headers.get("content-security-policy"));
  assert.equal(await res.text(), "<h1>hi</h1>");
});

test("js-файл з правильним Content-Type", async () => {
  const res = await fetch(`${server.url}/app.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
});

test("неіснуючий файл → 404", async () => {
  assert.equal((await fetch(`${server.url}/nope.css`)).status, 404);
});

test("вихід за межі папки (../) неможливий", async () => {
  // fetch нормалізує "..", тому шлем сирий запит
  for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/..%5csecret.txt"]) {
    const status = await rawGet(server.url, p);
    assert.notEqual(status, 200, p);
  }
});

function rawGet(base: string, rawPath: string): Promise<number> {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    request({ hostname, port, path: rawPath }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    })
      .on("error", reject)
      .end();
  });
}
