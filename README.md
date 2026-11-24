# AI: власна мовна модель з нуля

Навчальний проєкт: пишемо свою LLM на **Node.js + TypeScript** без ML-бібліотек,
плюс сервер, який можна відкрити в інтернет, і простий веб-чат для телефона.

**Статус:** сервер і веб-клієнт готові; модель поки чернетка (символьна n-gram),
яка продовжує текст. Далі — свій трансформер (див. [план](docs/ai/11-roadmap.md)).

## Документація

- 📚 [Як влаштована LLM](docs/ai/README.md): теорія по блоках, просто й коротко
- 🗺️ [План коду](docs/ai/11-roadmap.md): що й у якому порядку пишемо
- 🌐 [Інфраструктура](docs/infra.md): як відкрити сервер в інтернет і зайти з телефона

## Швидкий старт

Потрібен **Node.js 24+** (запускає TypeScript напряму, без компіляції):

```powershell
winget install OpenJS.NodeJS.LTS
```

```powershell
npm install
cp .env.example .env    # впишіть ACCESS_TOKEN
npm run dev             # сервер + автоперезбірка веб-клієнта
```

Відкрийте `http://localhost:3000`, введіть токен у налаштуваннях і пишіть.
З телефона в тій самій Wi-Fi: `http://<IP комп'ютера>:3000` (див. [infra](docs/infra.md#а-локальна-мережа-5-хвилин)).

| Команда | Що робить |
|---------|-----------|
| `npm run dev` | розробка: сервер з автоперезапуском + watch веб-клієнта |
| `npm run build` | перевірка типів + збірка веб-клієнта в `dist/web` |
| `npm start` | запуск сервера (спершу `npm run build`) |
| `npm test` | тести (`node:test`) |
| `npm run typecheck` | лише перевірка типів (сервер і веб) |

## Структура

```
docs/ai/          теорія LLM, по файлу на блок
docs/infra.md     вихід в інтернет, безпека, Docker, VPS
src/ai/           ШІ: токенізатор, модель, семплінг, метрики (тут кодимо далі)
src/server/       HTTP-сервер на node:http без фреймворків
  routes/         /api/health, /api/info, /api/chat (SSE-стрім)
  security/       Bearer-токен, ліміт запитів на IP
web/              веб-клієнт: public/ (html, css, manifest) + src/ (TypeScript)
scripts/          збірка веб-клієнта, dev-режим
data/corpus.txt   маленький тестовий корпус
deploy/           Caddyfile (HTTPS), скрипти Windows, systemd
test/             тести сервера, ШІ і веб-клієнта
```

## API

Усі `/api/*`, крім `health`, потребують заголовка `Authorization: Bearer <ACCESS_TOKEN>`.

```bash
curl http://localhost:3000/api/health
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/info
curl -N -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Добрий"}],"temperature":0.8,"maxTokens":200}'
```

`/api/chat` відповідає потоком SSE: `event: token` з шматками тексту, наприкінці `event: done`
з `finishReason` (`stop` | `length` | `aborted`), кількістю токенів і часом.

## Як влаштовано

```
браузер ──HTTP──► src/server ──► LanguageModel (src/ai)
  web/              │                 ▲
                    │                 └─ зараз: n-gram чернетка, далі: свій GPT
                    └─ віддає і веб-сторінку (dist/web), і API на одному порту
```

Сервер знає модель лише через інтерфейс `LanguageModel` (`src/ai/types.ts`):
`generate(prompt, options)` віддає текст шматками. Тому заміна моделі не зачіпає сервер і веб.
