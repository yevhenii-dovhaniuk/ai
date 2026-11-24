// Точка входу: конфіг → модель → застосунок → HTTP-сервер. Акуратна зупинка по Ctrl+C / SIGTERM.
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { createDraftModel } from "../ai/index.ts";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createLogger } from "./logger.ts";

const config = loadConfig();
const logger = createLogger(config.logLevel);

logger.info("завантажую модель…");
const model = await createDraftModel({ corpusPath: config.corpusPath, order: config.ngramOrder, tokenDelayMs: 15 });
logger.info(`модель ${model.info.name} готова`, {
  vocab: model.info.vocabSize,
  params: model.info.parameters,
  ...model.info.metrics,
});

const server = createServer(createApp({ config, logger, model }));
server.requestTimeout = 5 * 60_000; // довгі генерації можуть тривати хвилини
server.headersTimeout = 30_000;

server.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  logger.info(`сервер слухає ${config.host}:${port}`);
  for (const url of localUrls(config.host, port)) logger.info(`  відкрити: ${url}`);
  if (config.accessTokenGenerated) {
    logger.warn(`ACCESS_TOKEN не задано, згенеровано тимчасовий: ${config.accessToken}`);
    logger.warn("щоб токен не змінювався після перезапуску, впишіть його в .env");
  }
});

function shutdown(signal: string): void {
  logger.info(`${signal}: зупиняю сервер`);
  server.close(() => process.exit(0));
  server.closeAllConnections(); // обірвати активні стріми
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

function localUrls(host: string, port: number): string[] {
  if (host !== "0.0.0.0" && host !== "::") return [`http://${host}:${port}`];
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4")
    .map((i) => i!.address);
  return ips.map((ip) => `http://${ip}:${port}`);
}
