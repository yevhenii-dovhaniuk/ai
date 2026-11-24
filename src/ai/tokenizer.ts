// Крок 1: токенізація по символах. Найпростіший токенізатор: один символ = один токен.
// Завтра поруч з'явиться BpeTokenizer з тим самим інтерфейсом.
import type { Tokenizer } from "./types.ts";

export class CharTokenizer implements Tokenizer {
  /** Токен 0 зарезервовано для невідомих символів. */
  static readonly UNK = 0;

  private readonly idToChar: string[];
  private readonly charToId: Map<string, number>;

  constructor(chars: readonly string[]) {
    this.idToChar = ["�", ...chars]; // � для невідомого
    this.charToId = new Map(chars.map((c, i) => [c, i + 1]));
  }

  /** Будує словник з усіх символів, що трапляються в тексті (у стабільному порядку). */
  static fromText(text: string): CharTokenizer {
    return new CharTokenizer([...new Set(Array.from(text))].sort());
  }

  get vocabSize(): number {
    return this.idToChar.length;
  }

  /** Array.from ріже по code points, тож емодзі й інші «довгі» символи не ламаються. */
  encode(text: string): number[] {
    return Array.from(text, (c) => this.charToId.get(c) ?? CharTokenizer.UNK);
  }

  decode(ids: readonly number[]): string {
    return ids.map((id) => this.idToChar[id] ?? this.idToChar[CharTokenizer.UNK]).join("");
  }

  /** Список символів словника (без UNK): для збереження разом з вагами. */
  toJSON(): { chars: string[] } {
    return { chars: this.idToChar.slice(1) };
  }
}
