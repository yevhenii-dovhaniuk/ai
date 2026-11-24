# 11. План коду: від чернетки до свого GPT

Кожен етап — окремий шматок коду з тестом, який доводить, що він працює.
Сервер і веб уже готові. Вони працюють з будь-якою моделлю через інтерфейс
`LanguageModel` (`src/ai/types.ts`), тож міняється лише `src/ai`.

## Що вже є (етап 0)

| Файл | Що робить | Блок теорії |
|------|-----------|-------------|
| `src/ai/types.ts` | інтерфейси `LanguageModel`, `Tokenizer`, `ChatMessage` | — |
| `src/ai/tokenizer.ts` | токенізатор по символах | [01](01-tokenization.md) |
| `src/ai/ngram.ts` | n-gram «модель»: logits з частот | [04](04-transformer.md) (замість трансформера) |
| `src/ai/sampling.ts` | softmax, temperature, top-k, seed | [00](00-math.md), [06](06-generation.md) |
| `src/ai/metrics.ts` | val loss і perplexity | [05](05-training.md), [10](10-scale-and-eval.md) |
| `src/ai/stop.ts` | stop-рядки при стрімінгу | [06](06-generation.md) |
| `src/ai/chat.ts` | діалог → промпт (plain / chat template) | [08](08-assistant.md) |
| `src/ai/draft-model.ts` | цикл генерації (autoregressive) | [06](06-generation.md) |
| `src/ai/index.ts` | збирає модель при старті сервера | — |

Baseline на `data/corpus.txt`: **val loss ≈ 2.7** (n=3). Це число має побити трансформер.
Цікаво: n=5 дає гірший val loss (≈2.9), ніж n=3. Це перенавчання на маленькому корпусі в дії.

## Етапи

### 1. BPE-токенізатор
- `src/ai/bpe.ts`: `BpeTokenizer implements Tokenizer`, `train(text, vocabSize)`, `toJSON/fromJSON`.
- `scripts/train-tokenizer.ts` → `checkpoints/tokenizer.json`.
- ✅ Тест: `decode(encode(x)) === x` для будь-якого тексту, включно з емодзі; українське слово займає менше токенів, ніж символів.

### 2. Тензор і autograd (серце всього)
- `src/ai/nn/tensor.ts`: `Tensor { data: Float32Array, shape, grad, backward() }`.
- Операції: `add`, `mul`, `matmul`, `exp`, `log`, `sum`, `mean`, `reshape`, `transpose`, `softmax`, `gelu`.
- Кожна операція запам'ятовує батьків і функцію похідної; `backward()` обходить граф у зворотному порядку.
- ✅ Тест **gradient check**: аналітичний градієнт ≈ числовий `(f(x+ε) − f(x−ε)) / 2ε` для кожної операції.

### 3. Шари нейромережі
- `src/ai/nn/layers.ts`: `Linear`, `Embedding`, `LayerNorm`, `MLP`.
- `src/ai/nn/attention.ts`: `CausalSelfAttention` (multi-head + маска).
- `src/ai/gpt.ts`: `Block` (attention + MLP + residual) і `GPT` (ембедінги → N блоків → logits).
- ✅ Тест: форми виходів правильні; майбутні токени не впливають на минулі logits (перевірка маски).

### 4. Навчання
- `src/ai/train/loss.ts`: `crossEntropy(logits, targets)`.
- `src/ai/train/adamw.ts`: оптимізатор AdamW.
- `src/ai/train/data.ts`: `getBatch(ids, batchSize, context)` → входи і цілі (зсув на 1).
- `scripts/train.ts`: цикл навчання, лог train/val loss, збереження `checkpoints/gpt.json`.
- ✅ Тест: модель **перенавчається на одному батчі** (loss → ~0). Якщо ні, у backward баг.
- ✅ Ціль: val loss на корпусі **нижчий за n-gram baseline**.

### 5. Інференс у сервері
- `src/ai/gpt-model.ts`: `GptLanguageModel implements LanguageModel` (завантажує checkpoint).
- `src/ai/index.ts`: вибір моделі змінною `MODEL=ngram|gpt`.
- Далі: KV-кеш для швидкості.
- ✅ Перевірка: у веб-клієнті відповідає трансформер, у «Про модель» видно його метрики.

### 6. Більше даних
- `scripts/prepare-data.ts`: очистка, нормалізація апострофів, дедуплікація, токенізація → `data/train.bin`, `data/val.bin`.
- Корпус на 10–100 МБ (див. [07-data.md](07-data.md)). Навчання на ньому вже займе години, тому `worker_threads`.

### 7. Чат (SFT)
- Набір діалогів у форматі chat template, loss лише на відповідях асистента.
- `promptFormat: "chat-template"` у `ModelInfo`. Сервер і веб уже вміють.

### 8. За бажання
- RAG по своїх нотатках ([09](09-around-the-model.md)).
- Адаптер `OllamaLanguageModel` до відкритої моделі для порівняння (той самий інтерфейс).
- Прискорення: WebGPU, onnxruntime-node.

## Розміри для старту (етап 4)

```ts
const config = { vocabSize: 512, context: 64, dModel: 64, nHeads: 4, nLayers: 2 }; // ≈ 0.15 млн параметрів
// lr 3e-4…1e-3, batch 16, 2000–5000 кроків: хвилини на CPU
```
