# Brass: Birmingham — план реализации

> Выполняется в этой сессии по шагам (inline). Спецификация: `docs/superpowers/specs/2026-10-19-brass-birmingham-design.md`.

**Цель:** играбельная веб-версия Brass: Birmingham (онлайн + хотсит) с полными правилами.

**Архитектура:** npm workspaces `engine` / `server` / `client` по образцу `../ankh-morpork`.
Движок — чистые функции над `G` (мутируют черновик Immer, ошибка → строка → `INVALID_MOVE`);
предпросмотр и подсказки интерфейса — тот же код на клоне `G`.

**Стек:** boardgame.io 0.50, React 18, Vite 5, TypeScript 5, Koa (через boardgame.io/server), vitest 2, puppeteer, Pillow.

## Общие ограничения
- Node 20, `npm install` из корня; пакеты `@bb/engine`, `@bb/server`, `@bb/client`.
- Интерфейс и журнал — по-русски; id в коде — по-английски (kebab-case для городов).
- Десктоп ≥ 1366 px.
- Порт сервера 3001, dev-клиент 5173.

---

### Задача 1. Каркас и ассеты
**Файлы:** корневые `package.json`, `tsconfig.base.json`, `.gitignore`, `.node-version`, `render.yaml`;
`packages/*/package.json`, `tsconfig.json`; `packages/server/src/index.ts`; `packages/client/{index.html,vite.config.ts,src/main.tsx}`;
`tools/assets/build_assets.py`; `packages/client/public/{board.webp,cards/*,tiles/*,merchants/*,ui/*}`.
- Скрипт ассетов: обрезка поля (6144² → область 1000..5180, вывод 3000 px), нарезка листа карт 7×5,
  рубашка, плитки/торговцы/монеты/жетоны → webp. Проверка: все id из данных имеют картинку.
- Проверка: `npm install`, `npm run build` проходит (с заглушкой игры).

### Задача 2. Данные движка
**Файлы:** `engine/src/data/{board,tiles,cards,market,income,names}.ts`, `engine/src/types.ts`; тест `data.test.ts`.
- `LOCATIONS`, `LINKS` (39, `extra` для фермы), `MERCHANTS` (места, бонус), `TILES`, колода по числу игроков,
  `COAL_PRICES`, `IRON_PRICES`, функции шкалы дохода, русские названия.
- Тесты: 40/54/64 карты, 45 плиток у игрока, уровни дохода (клетка 10 → 0, 11/12 → 1, 99 → 30), займ.

### Задача 3. Граф, рынки, ресурсы
**Файлы:** `engine/src/{graph,market,resources}.ts` + тесты.
- `networkNodes(G,pid)`, `hasPresence(G,pid)`, `reachable(G, seeds)`, `distances(G, from[])`, `connectedToMerchant(G, nodes)`.
- `buyCost(kind, filled, n)`, `sellToMarket(...)`.
- `takeCoal(G, at[], need, picks?)`, `takeIron(G, need, picks?)`, `takeBeer(G, pid, at[], need, picks?, merchant?)` —
  мутируют, проверяют правило ближайшего угля, возвращают ошибку или стоимость; переворот плиток при исчерпании.

### Задача 4. Действия
**Файлы:** `engine/src/actions/{build,network,develop,sell,simple}.ts`, `engine/src/action.ts` (диспетчер `doAction`) + тесты.
- `Action = build | network | develop | sell | loan | scout | pass`; `doAction(G, pid, a): string | null`.
- Тесты на каждое правило и запрет из спецификации (сеть, приоритет слота, перестройка, эпохи, бонусы торговцев…).

### Задача 5. Раунды, эпохи, игра boardgame.io
**Файлы:** `engine/src/{setup,round,game,view,log,enumerate,preview}.ts`, `engine/src/index.ts` + тесты.
- Лобби (имена, цвета, старт хостом), подготовка, `finishTurn` (добор, следующий игрок, конец раунда, доход,
  конец эпохи, итог), `playerView`, `enumerateActions(G,pid)`, `tryAction(G,pid,a)`.
- Тесты: подготовка, порядок по тратам, доход/долг, смена эпохи, финал; 300 случайных партий 2/3/4 игроков.

### Задача 6. Клиент: оболочка, лобби, сеть, хотсит
**Файлы:** `client/src/{App,Home,GameRoom,LocalGame,Page,net}.tsx`, `table/{Table,Lobby,Handoff}.tsx`, `styles.css`.
- Перенос из ankh-morpork, тема «индустриальная ночь». Хотсит с экраном передачи хода.

### Задача 7. Клиент: поле
**Файлы:** `client/src/table/{Board,geometry}.tsx/ts`.
- Скан + SVG: слоты, плитки, связи, торговцы, бочки, рынки, треки ПО/дохода, порядок, колоды, зум/пан,
  подсветка целей и изменений, подсказки с русскими названиями.

### Задача 8. Клиент: игроки, рука, планшет, мастер, журнал, итоги
**Файлы:** `client/src/table/{Players,Hand,Mat,Wizard,Sources,Log,EraModal,GameOver}.tsx`.
- Мастер всех действий с предпросмотром стоимости через `tryAction`, выбор источников ресурсов, отмена, конец хода.

### Задача 9. Проверки и выпуск
**Файлы:** `scripts/{net-play,ui-test,shot}.mjs`, `README.md`.
- Сетевая партия ботами (socket.io-клиенты), проверка секретности, puppeteer-прогон интерфейса, скриншоты.
- README, коммит, пуш в `origin main`.
