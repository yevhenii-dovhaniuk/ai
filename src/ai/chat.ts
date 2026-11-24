// Перетворення діалогу на текст для моделі (див. docs/ai/08-assistant.md).
import type { ChatMessage, PromptFormat } from "./types.ts";

export const SPECIAL = {
  system: "<|system|>",
  user: "<|user|>",
  assistant: "<|assistant|>",
  end: "<|end|>",
} as const;

export interface FormattedPrompt {
  prompt: string;
  stop: string[];
}

export function formatPrompt(messages: readonly ChatMessage[], format: PromptFormat): FormattedPrompt {
  if (format === "chat-template") {
    // Для моделі, навченої на діалогах (після SFT):
    //   <|system|>…<|end|>\n<|user|>…<|end|>\n<|assistant|>  ← модель продовжує звідси
    const prompt = messages.map((m) => `${SPECIAL[m.role]}${m.content}${SPECIAL.end}\n`).join("") + SPECIAL.assistant;
    return { prompt, stop: [SPECIAL.end, SPECIAL.user] };
  }

  // "plain": для моделі, яка вміє лише продовжувати текст (наша чернетка, pretraining без SFT).
  // Діалогу вона не розуміє, тому просто дописує продовження останньої репліки користувача
  // до кінця абзацу.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return { prompt: (lastUser?.content.trim() ?? "") + " ", stop: ["\n\n"] };
}
