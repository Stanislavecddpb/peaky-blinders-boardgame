import { describe, expect, it } from 'vitest';
import { LINKS, LOCATIONS, MERCHANTS } from './data/board';
import { buildDeck } from './data/cards';
import { buyFromMarket, incomeLevel, levelTopSpace, loanSpace, sellToMarket } from './data/market';
import { STACKS, TILES } from './data/tiles';
import { INDUSTRIES } from './types';

describe('данные', () => {
  it('колода 40/54/64', () => {
    expect(buildDeck(2)).toHaveLength(40);
    expect(buildDeck(3)).toHaveLength(54);
    expect(buildDeck(4)).toHaveLength(64);
    expect(new Set(buildDeck(4)).size).toBe(64);
  });

  it('у игрока 45 плиток', () => {
    expect(INDUSTRIES.reduce((a, i) => a + STACKS[i].length, 0)).toBe(45);
    expect(TILES).toHaveLength(29);
  });

  it('связи ведут в существующие места', () => {
    expect(LINKS).toHaveLength(39);
    for (const l of LINKS) for (const e of l.ends) expect(e in LOCATIONS || e in MERCHANTS).toBe(true);
    for (const loc of Object.keys(LOCATIONS)) expect(LINKS.some((l) => l.ends.includes(loc))).toBe(true);
  });

  it('шкала дохода', () => {
    expect(incomeLevel(10)).toBe(0);
    expect(incomeLevel(0)).toBe(-10);
    expect(incomeLevel(11)).toBe(1);
    expect(incomeLevel(12)).toBe(1);
    expect(incomeLevel(30)).toBe(10);
    expect(incomeLevel(31)).toBe(11);
    expect(incomeLevel(61)).toBe(21);
    expect(incomeLevel(99)).toBe(30);
    for (let lvl = -10; lvl <= 30; lvl++) expect(incomeLevel(levelTopSpace(lvl))).toBe(lvl);
    expect(incomeLevel(levelTopSpace(5) + 1)).toBe(6);
  });

  it('заём: −3 уровня на верхнюю клетку, не ниже −10', () => {
    expect(loanSpace(10)).toBe(levelTopSpace(-3));
    expect(loanSpace(14)).toBe(levelTopSpace(-1)); // клетка 14 — уровень 2
    expect(incomeLevel(loanSpace(14)!)).toBe(-1);
    expect(loanSpace(levelTopSpace(-8))).toBeNull();
    expect(loanSpace(levelTopSpace(-7))).toBe(0);
  });

  it('рынки: покупка с дешёвого конца, продажа в самое дорогое пустое место', () => {
    expect(buyFromMarket('coal', 13, 1)).toEqual({ cost: 1, filled: 12 });
    expect(buyFromMarket('coal', 13, 3)).toEqual({ cost: 1 + 2 + 2, filled: 10 });
    expect(buyFromMarket('coal', 1, 2)).toEqual({ cost: 7 + 8, filled: 0 });
    expect(buyFromMarket('iron', 8, 1)).toEqual({ cost: 2, filled: 7 });
    expect(buyFromMarket('iron', 0, 2)).toEqual({ cost: 12, filled: 0 });
    expect(sellToMarket('coal', 13, 3)).toEqual({ income: 1, sold: 1, filled: 14 });
    expect(sellToMarket('coal', 10, 2)).toEqual({ income: 2 + 2, sold: 2, filled: 12 });
    expect(sellToMarket('iron', 8, 4)).toEqual({ income: 2, sold: 2, filled: 10 });
  });
});
