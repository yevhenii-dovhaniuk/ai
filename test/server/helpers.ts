// Піднімає застосунок на випадковому порту для інтеграційних тестів.
import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import type { GenerateOptions, GenerateResult, LanguageModel } from "../../src/ai/types.ts";
import { loadConfig, type Config } from "../../src/server/config.ts";

export const TEST_TOKEN = "test-token-0123456789";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return { ...loadConfig({ ACCESS_TOKEN: TEST_TOKEN, HOST: "127.0.0.1", PORT: "0" }), ...overrides };
}

/** Фейкова модель: відповідає словами з `reply`, по одному слову за токен. */
export function fakeModel(reply = "Привіт від моделі"): LanguageModel & { lastPrompt?: string; lastOptions?: GenerateOptions } {
  const model: LanguageModel & { lastPrompt?: string; lastOptions?: GenerateOptions } = {
    info: {
      name: "fake",
      description: "тестова",
      promptFormat: "chat-template",
      vocabSize: 1,
      contextSize: 1,
      parameters: 0,
      metrics: {},
    },
    async *generate(prompt, options): AsyncGenerator<string, GenerateResult> {
      model.lastPrompt = prompt;
      model.lastOptions = options;
      const words = reply.split(/(?<= )/);
      let tokens = 0;
      for (const w of words) {
        if (tokens >= options.maxTokens) return { finishReason: "length", tokens };
        if (options.signal?.aborted) return { finishReason: "aborted", tokens };
        tokens++;
        yield w;
      }
      return { finishReason: "stop", tokens };
    },
  };
  return model;
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
