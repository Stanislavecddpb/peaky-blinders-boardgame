/** Цены мест рынков по возрастанию. N кубов занимают N самых дорогих мест. */
export const COAL_PRICES = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];
export const IRON_PRICES = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
export const COAL_START = 13;
export const IRON_START = 8;
/** Цена куба, когда рынок пуст. */
export const COAL_EMPTY_PRICE = 8;
export const IRON_EMPTY_PRICE = 6;

export type Res = 'coal' | 'iron';
export const PRICES: Record<Res, number[]> = { coal: COAL_PRICES, iron: IRON_PRICES };
export const EMPTY_PRICE: Record<Res, number> = { coal: COAL_EMPTY_PRICE, iron: IRON_EMPTY_PRICE };

/** Стоимость покупки n кубов при filled кубах на рынке; возвращает цену и новое заполнение. */
export function buyFromMarket(res: Res, filled: number, n: number): { cost: number; filled: number } {
  const prices = PRICES[res];
  let cost = 0;
  for (let i = 0; i < n; i++) {
    if (filled > 0) {
      cost += prices[prices.length - filled];
      filled--;
    } else cost += EMPTY_PRICE[res];
  }
  return { cost, filled };
}

/** Продажа до n кубов на рынок: выручка, сколько продано, новое заполнение. */
export function sellToMarket(res: Res, filled: number, n: number): { income: number; sold: number; filled: number } {
  const prices = PRICES[res];
  let income = 0;
  let sold = 0;
  while (sold < n && filled < prices.length) {
    income += prices[prices.length - filled - 1];
    filled++;
    sold++;
  }
  return { income, sold, filled };
}

/** Цена следующего покупаемого куба (для подсказок). */
export function nextBuyPrice(res: Res, filled: number): number {
  return filled > 0 ? PRICES[res][PRICES[res].length - filled] : EMPTY_PRICE[res];
}

// ---- Шкала дохода: клетки 0..99 ----
export const INCOME_START = 10;
export const INCOME_MIN_LEVEL = -10;

/** Уровень дохода по клетке. */
export function incomeLevel(space: number): number {
  if (space <= 10) return space - 10;
  if (space <= 30) return 1 + Math.floor((space - 11) / 2);
  if (space <= 60) return 11 + Math.floor((space - 31) / 3);
  if (space <= 96) return 21 + Math.floor((space - 61) / 4);
  return 30;
}

/** Самая верхняя клетка уровня. */
export function levelTopSpace(level: number): number {
  if (level <= 0) return level + 10;
  if (level <= 10) return 12 + (level - 1) * 2;
  if (level <= 20) return 33 + (level - 11) * 3;
  if (level <= 29) return 64 + (level - 21) * 4;
  return 99;
}

export const advanceIncome = (space: number, n: number): number => Math.min(99, space + n);

/** Заём: доход падает на 3 уровня, маркер — на верхнюю клетку нового уровня. null — нельзя. */
export function loanSpace(space: number): number | null {
  const level = incomeLevel(space) - 3;
  return level < INCOME_MIN_LEVEL ? null : levelTopSpace(level);
}
