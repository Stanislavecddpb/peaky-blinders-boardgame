// Хотсит-партия через интерфейс: случайные действия мастером до конца игры.
// node scripts/hotseat-test.mjs [url=http://localhost:5173] [игроков=3] [макс. ходов=400]
import puppeteer from 'puppeteer';
import fs from 'fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const N = Number(process.argv[3] ?? 3);
const MAX_TURNS = Number(process.argv[4] ?? 400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('shots', { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

/** Кликнуть кнопку, текст которой начинается с text (только активную). */
const click = (text, scope = 'body') => page.evaluate((text, scope) => {
  const root = document.querySelector(scope);
  const b = root && [...root.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(text) && !x.disabled);
  if (!b) return false;
  b.click();
  return true;
}, text, scope);

/** Кликнуть случайный элемент по селектору. */
const clickRandom = (sel) => page.evaluate((sel) => {
  const els = [...document.querySelectorAll(sel)].filter((e) => !e.disabled);
  if (!els.length) return false;
  els[Math.floor(Math.random() * els.length)].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
}, sel);

await page.goto(`${base}/#/local`, { waitUntil: 'networkidle0' });
await page.evaluate((n) => [...document.querySelectorAll('.page-count button')].find((b) => b.textContent === String(n)).click(), N);
await click('Начать');
await sleep(300);
await page.evaluate(() => {
  document.querySelectorAll('.seat').forEach((row, i) => row.querySelectorAll('.swatch')[i].click());
});
await sleep(300);
await click('Начать игру');
await sleep(500);

const stats = {};
let turns = 0;
let stuck = 0;
while (turns < MAX_TURNS) {
  if (await page.$('.gameover')) break;
  if (await click('Я ', '.handoff')) { await sleep(150); continue; }
  if (await page.$('.popup .btn') && await click('Продолжить')) { await sleep(150); continue; }

  if (await click('Завершить ход (добрать')) {
    turns++;
    stuck = 0;
    await sleep(200);
    if (turns % 20 === 0) await page.screenshot({ path: `shots/hotseat-${turns}.png` });
    continue;
  }

  // Выбор действия: сначала пробуем «полезные».
  const kinds = await page.evaluate(() => [...document.querySelectorAll('.action-grid button')].filter((b) => !b.disabled).map((b) => b.textContent));
  if (!kinds.length) {
    stuck++;
    if (stuck > 30) { console.log('ЗАСТРЯЛИ'); break; }
    await sleep(200);
    continue;
  }
  const prefer = ['Продать', 'Строить', 'Сеть', 'Строить', 'Сеть', 'Развивать'].filter((k) => kinds.includes(k));
  let kind = Math.random() < 0.85 && prefer.length ? prefer[Math.floor(Math.random() * prefer.length)] : kinds[Math.floor(Math.random() * kinds.length)];
  const money = await page.evaluate(() => Number(document.querySelector('.player.current .money')?.textContent.slice(1) ?? 0));
  if (kind === 'Заём' && money > 10) kind = 'Пропуск';
  if (money < 8 && kinds.includes('Заём') && Math.random() < 0.8) kind = 'Заём';
  await click(kind, '.action-grid');
  await sleep(250);

  if (kind === 'Разведка') {
    for (let i = 0; i < 3; i++) { await clickRandom('.hand-card.can:not(.sel)'); await sleep(80); }
  } else {
    await clickRandom('.hand-card.can');
    await sleep(kind === 'Строить' ? 600 : 300);
    if (kind === 'Строить' || kind === 'Сеть' || kind === 'Продать') {
      await clickRandom('.target-list button');
      await sleep(250);
      // Выбор отрасли для двойного слота или торговца.
      await clickRandom('.draft .step .buttons button');
      await sleep(250);
    }
    if (kind === 'Развивать') {
      await clickRandom('.draft .buttons button:not(.ghost)');
      await sleep(250);
    }
  }
  const ok = await click('Подтвердить', '.draft');
  await sleep(250);
  stats[kind] = (stats[kind] ?? 0) + (ok ? 1 : 0);
  if (!ok) {
    if (process.env.DEBUG) console.log('НЕ ВЫШЛО', kind, '|', await page.evaluate(() => document.querySelector('.draft')?.innerText.replace(/\s+/g, ' ').slice(0, 400)));
    await click('Отмена', '.draft');
    await sleep(100);
    await click('Пропуск', '.action-grid');
    await sleep(150);
    await clickRandom('.hand-card.can');
    await sleep(150);
    await click('Подтвердить', '.draft');
    await sleep(200);
    stats['Пропуск (вынужденно)'] = (stats['Пропуск (вынужденно)'] ?? 0) + 1;
  }
}

await page.screenshot({ path: 'shots/hotseat-end.png' });
const over = await page.evaluate(() => document.querySelector('.gameover')?.innerText ?? null);
console.log('Ходов:', turns);
console.log('Действия:', stats);
console.log('Итог:', over ?? 'игра не закончена');
if (errors.length) console.log('ОШИБКИ:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
process.exit(over && !errors.length ? 0 : 1);
