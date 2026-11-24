// Stop-рядки: зупинити генерацію, щойно модель написала, наприклад, "<|end|>".
// Складність у тому, що stop-рядок приходить по шматочках ("<|", "en", "d|>"), тому текст,
// який МОЖЕ бути початком stop-рядка, притримуємо, доки не стане ясно.

export class StopMatcher {
  private readonly stops: string[];
  private buffer = "";

  constructor(stops: readonly string[] = []) {
    this.stops = stops.filter((s) => s.length > 0);
  }

  /** Додає новий шматок. Повертає текст, який вже безпечно показати, і чи треба зупинитись. */
  push(chunk: string): { text: string; stopped: boolean } {
    this.buffer += chunk;

    let cut = -1;
    for (const s of this.stops) {
      const i = this.buffer.indexOf(s);
      if (i >= 0 && (cut < 0 || i < cut)) cut = i;
    }
    if (cut >= 0) {
      const text = this.buffer.slice(0, cut);
      this.buffer = "";
      return { text, stopped: true };
    }

    const hold = this.longestPendingPrefix();
    const text = this.buffer.slice(0, this.buffer.length - hold);
    this.buffer = this.buffer.slice(this.buffer.length - hold);
    return { text, stopped: false };
  }

  /** Залишок буфера після кінця генерації. */
  flush(): string {
    const rest = this.buffer;
    this.buffer = "";
    return rest;
  }

  /** Довжина найдовшого «хвоста» буфера, що збігається з початком якогось stop-рядка. */
  private longestPendingPrefix(): number {
    let best = 0;
    for (const s of this.stops) {
      for (let len = Math.min(s.length - 1, this.buffer.length); len > best; len--) {
        if (this.buffer.endsWith(s.slice(0, len))) {
          best = len;
          break;
        }
      }
    }
    return best;
  }
}
