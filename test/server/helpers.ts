// Піднімає застосунок на випадковому порту для інтеграційних тестів.
import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import { loadConfig, type Config } from "../../src/server/config.ts";

export const TEST_TOKEN = "test-token-0123456789";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return { ...loadConfig({ ACCESS_TOKEN: TEST_TOKEN, HOST: "127.0.0.1", PORT: "0" }), ...overrides };
}

export async function startServer(app: RequestListener): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
