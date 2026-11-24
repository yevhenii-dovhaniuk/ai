// Веб-клієнт чату: відправка повідомлень, стрімінг відповіді, налаштування, історія.
import type { ChatMessage } from "../../src/ai/types.ts";
import { ApiError, fetchInfo, streamChat, type InfoResponse } from "./api.ts";
import { loadHistory, loadSettings, saveHistory, saveSettings, type Settings } from "./storage.ts";

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const els = {
  messages: $("#messages"),
  empty: $("#empty"),
  modelName: $("#model-name"),
  composer: $<HTMLFormElement>("#composer"),
  input: $<HTMLTextAreaElement>("#input"),
  send: $<HTMLButtonElement>("#send"),
  newChat: $<HTMLButtonElement>("#new-chat"),
  openSettings: $<HTMLButtonElement>("#open-settings"),
  dialog: $<HTMLDialogElement>("#settings"),
  token: $<HTMLInputElement>("#token"),
  tokenStatus: $("#token-status"),
  temperature: $<HTMLInputElement>("#temperature"),
  temperatureValue: $<HTMLOutputElement>("#temperature-value"),
  maxTokens: $<HTMLInputElement>("#max-tokens"),
  topK: $<HTMLInputElement>("#top-k"),
  modelInfo: $("#model-info"),
};

let settings: Settings = loadSettings();
let history: ChatMessage[] = loadHistory();
let info: InfoResponse | null = null;
let generation: AbortController | null = null;

// ---------- відображення ----------

function addBubble(role: ChatMessage["role"] | "error", text: string): HTMLElement {
  els.empty.hidden = true;
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  els.messages.append(el);
  scrollToBottom(true);
  return el;
}

function renderHistory(): void {
  els.messages.querySelectorAll(".msg").forEach((el) => el.remove());
  els.empty.hidden = history.length > 0;
  for (const m of history) addBubble(m.role, m.content);
}

function scrollToBottom(force = false): void {
  const m = els.messages;
  const nearBottom = m.scrollHeight - m.scrollTop - m.clientHeight < 120;
  if (force || nearBottom) m.scrollTop = m.scrollHeight;
}

function setBusy(busy: boolean): void {
  els.composer.classList.toggle("busy", busy);
  els.send.setAttribute("aria-label", busy ? "Зупинити" : "Надіслати");
  updateSendButton();
}

function updateSendButton(): void {
  els.send.disabled = !generation && els.input.value.trim() === "";
}

/** Поле вводу росте разом з текстом (до max-height із CSS, далі з'являється прокрутка). */
function autoGrow(): void {
  const el = els.input;
  el.style.height = "auto";
  const borders = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + borders}px`;
  el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
}

// ---------- підключення до сервера ----------

async function connect(): Promise<void> {
  if (!settings.token) {
    els.modelName.textContent = "потрібен токен доступу";
    openSettings();
    return;
  }
  try {
    info = await fetchInfo(settings.token);
    els.modelName.textContent = info.model.name;
    setTokenStatus("Підключено ✓", "ok");
    els.modelInfo.textContent = describeModel(info);
  } catch (err) {
    info = null;
    const unauthorized = err instanceof ApiError && err.status === 401;
    els.modelName.textContent = unauthorized ? "неправильний токен" : "сервер недоступний";
    setTokenStatus(unauthorized ? "Токен не підходить" : errorText(err), "bad");
    if (unauthorized) openSettings();
  }
}

function describeModel({ model }: InfoResponse): string {
  const metrics = Object.entries(model.metrics).map(([k, v]) => `  ${k}: ${v}`);
  return [
    model.description,
    "",
    `словник: ${model.vocabSize} токенів`,
    `контекст: ${model.contextSize} токенів`,
    `параметрів: ${model.parameters.toLocaleString("uk-UA")}`,
    `формат промпта: ${model.promptFormat}`,
    ...(metrics.length ? ["метрики:", ...metrics] : []),
  ].join("\n");
}

// ---------- чат ----------

async function send(): Promise<void> {
  const text = els.input.value.trim();
  if (!text || generation) return;
  if (!settings.token) return openSettings();

  els.input.value = "";
  autoGrow();
  history.push({ role: "user", content: text });
  saveHistory(history);
  addBubble("user", text);

  const bubble = addBubble("assistant", "");
  bubble.classList.add("streaming");
  generation = new AbortController();
  setBusy(true);

  let reply = "";
  let meta = "";
  try {
    const params = { messages: fitToLimits(history), temperature: settings.temperature, maxTokens: settings.maxTokens, topK: settings.topK };
    for await (const event of streamChat(settings.token, params, generation.signal)) {
      if (event.type === "token") {
        reply += event.text;
        bubble.textContent = reply;
        scrollToBottom();
      } else {
        const reason = { stop: "", length: " · обрізано за лімітом", aborted: " · зупинено" }[event.finishReason];
        meta = `${event.tokens} ток. · ${(event.ms / 1000).toFixed(1)} с${reason}`;
      }
    }
  } catch (err) {
    if (generation.signal.aborted) {
      meta = "зупинено";
    } else {
      addBubble("error", errorText(err));
      if (err instanceof ApiError && err.status === 401) openSettings();
    }
  } finally {
    bubble.classList.remove("streaming");
    if (reply) {
      history.push({ role: "assistant", content: reply });
      saveHistory(history);
    } else if (!meta) {
      bubble.remove();
    }
    if (meta) {
      const m = document.createElement("span");
      m.className = "meta";
      m.textContent = meta;
      bubble.append(m);
    }
    generation = null;
    setBusy(false);
    scrollToBottom();
  }
}

/** Обрізає найстаріші повідомлення, щоб діалог вліз у ліміти сервера. */
function fitToLimits(messages: ChatMessage[]): ChatMessage[] {
  const maxCount = info?.limits.messages ?? 50;
  const maxChars = info?.limits.totalChars ?? 20_000;
  const result: ChatMessage[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && result.length < maxCount; i--) {
    const m = messages[i]!;
    if (chars + m.content.length > maxChars) break;
    chars += m.content.length;
    result.unshift(m);
  }
  return result;
}

function newChat(): void {
  generation?.abort();
  history = [];
  saveHistory(history);
  renderHistory();
  els.input.focus();
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return "Немає з'єднання з сервером";
  return String(err);
}

// ---------- налаштування ----------

function openSettings(): void {
  els.token.value = settings.token;
  els.temperature.value = String(settings.temperature);
  els.temperatureValue.value = settings.temperature.toFixed(2);
  els.maxTokens.value = String(settings.maxTokens);
  els.topK.value = String(settings.topK);
  if (!els.dialog.open) els.dialog.showModal();
}

function setTokenStatus(text: string, kind: "ok" | "bad" | ""): void {
  els.tokenStatus.textContent = text;
  els.tokenStatus.className = `status ${kind}`;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

els.dialog.addEventListener("close", () => {
  if (els.dialog.returnValue !== "save") return;
  settings = {
    token: els.token.value.trim(),
    temperature: clamp(Number(els.temperature.value), 0, 2, 0.8),
    maxTokens: Math.round(clamp(Number(els.maxTokens.value), 1, info?.limits.maxTokens ?? 1000, 300)),
    topK: Math.round(clamp(Number(els.topK.value), 0, 1000, 20)),
  };
  saveSettings(settings);
  void connect();
});

els.temperature.addEventListener("input", () => {
  els.temperatureValue.value = Number(els.temperature.value).toFixed(2);
});

// ---------- події ----------

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  if (generation) generation.abort();
  else void send();
});

els.input.addEventListener("input", () => {
  autoGrow();
  updateSendButton();
});

// Enter надсилає на комп'ютері; на телефоні Enter = новий рядок, надсилання кнопкою
const touch = matchMedia("(pointer: coarse)").matches;
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !touch) {
    e.preventDefault();
    els.composer.requestSubmit();
  }
});

els.newChat.addEventListener("click", newChat);
els.openSettings.addEventListener("click", openSettings);

// ---------- старт ----------

renderHistory();
autoGrow();
updateSendButton();
void connect();
