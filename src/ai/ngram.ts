// Чернетка «моделі»: n-gram. Найпростіша мовна модель, яку можна написати:
// рахуємо, який токен як часто йде після кожної комбінації з (n-1) попередніх токенів.
//
//   "навчання" = підрахунок частот (без градієнтів)
//   "прогноз"  = logits = log(частота), для невідомого контексту беремо коротший (backoff)
//
// Трансформер робить те саме (дає logits наступного токена за контекстом), але замість
// таблиці частот узагальнює через вивчені ваги. Тому n-gram зручний як baseline.

export class NGramModel {
  /** n: скільки токенів разом із тим, що передбачаємо. Контекст = n-1. */
  readonly order: number;
  readonly vocabSize: number;
  /** Згладжування: «уявна» кількість для кожного токена, щоб жоден не мав нульової ймовірності. */
  readonly alpha: number;
  /** tables[k]: контекст довжини k ("12,7,3") → (наступний токен → кількість). */
  private readonly tables: Map<string, Map<number, number>>[];

  constructor(order: number, vocabSize: number, alpha = 0.01) {
    if (order < 1) throw new Error("order має бути ≥ 1");
    this.order = order;
    this.vocabSize = vocabSize;
    this.alpha = alpha;
    this.tables = Array.from({ length: order }, () => new Map());
  }

  get contextSize(): number {
    return this.order - 1;
  }

  /** Кількість збережених чисел: аналог «параметрів» моделі. */
  get parameters(): number {
    let n = 0;
    for (const table of this.tables) for (const counts of table.values()) n += counts.size;
    return n;
  }

  train(ids: readonly number[]): void {
    for (let i = 0; i < ids.length; i++) {
      const next = ids[i]!;
      for (let k = 0; k <= this.contextSize && k <= i; k++) {
        const key = ids.slice(i - k, i).join(",");
        const table = this.tables[k]!;
        const counts = table.get(key) ?? new Map<number, number>();
        counts.set(next, (counts.get(next) ?? 0) + 1);
        table.set(key, counts);
      }
    }
  }

  /** Logits наступного токена. Шукаємо найдовший контекст, який модель бачила при навчанні. */
  logits(context: readonly number[]): Float64Array {
    const maxK = Math.min(this.contextSize, context.length);
    for (let k = maxK; k >= 0; k--) {
      const counts = this.tables[k]!.get(context.slice(context.length - k).join(","));
      if (!counts) continue;
      const logits = new Float64Array(this.vocabSize).fill(Math.log(this.alpha));
      for (const [token, count] of counts) logits[token] = Math.log(count + this.alpha);
      return logits;
    }
    return new Float64Array(this.vocabSize); // нічого не навчено: усі токени рівноймовірні
  }
}
