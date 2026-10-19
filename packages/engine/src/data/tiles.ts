import type { Industry } from '../types';

export interface TileDef {
  industry: Industry;
  level: number;
  /** Сколько таких плиток у игрока. */
  count: number;
  money: number;
  coal: number;
  iron: number;
  /** Пиво для продажи (хлопок, мануфактура, гончарня). */
  beer: number;
  /** Кубов при постройке (уголь, железо); у пивоварни бочки зависят от эпохи. */
  res: number;
  vp: number;
  /** На сколько клеток сдвигается доход при перевороте. */
  income: number;
  /** Значков связи на перевёрнутой плитке. */
  linkVp: number;
  /** Можно строить в эпоху каналов / ж/д. */
  canal: boolean;
  rail: boolean;
  /** Лампочка: нельзя развивать. */
  noDevelop: boolean;
}

type Row = [Industry, number, number, number, number, number, number, number, number, number, number, string?];
// отрасль, уровень, кол-во, £, уголь, железо, пиво, кубы, ПО, доход, значки связи, флаги
// флаги: c — только каналы (уровень 1), r — только ж/д, b — лампочка
const ROWS: Row[] = [
  ['cotton', 1, 3, 12, 0, 0, 1, 0, 5, 5, 1, 'c'],
  ['cotton', 2, 2, 14, 1, 0, 1, 0, 5, 4, 2],
  ['cotton', 3, 3, 16, 1, 1, 1, 0, 9, 3, 1],
  ['cotton', 4, 3, 18, 1, 1, 1, 0, 12, 2, 1],
  ['manufacturer', 1, 1, 8, 1, 0, 1, 0, 3, 5, 2, 'c'],
  ['manufacturer', 2, 2, 10, 0, 1, 1, 0, 5, 1, 1],
  ['manufacturer', 3, 1, 12, 2, 0, 0, 0, 4, 4, 0],
  ['manufacturer', 4, 1, 8, 0, 1, 1, 0, 3, 6, 1],
  ['manufacturer', 5, 2, 16, 1, 0, 2, 0, 8, 2, 2],
  ['manufacturer', 6, 1, 20, 0, 0, 1, 0, 7, 6, 1],
  ['manufacturer', 7, 1, 16, 1, 1, 0, 0, 9, 4, 0],
  ['manufacturer', 8, 2, 20, 0, 2, 1, 0, 11, 1, 1],
  ['pottery', 1, 1, 17, 0, 1, 1, 0, 10, 5, 1, 'b'],
  ['pottery', 2, 1, 0, 1, 0, 1, 0, 1, 1, 1],
  ['pottery', 3, 1, 22, 2, 0, 2, 0, 11, 5, 1, 'b'],
  ['pottery', 4, 1, 0, 1, 0, 1, 0, 1, 1, 1],
  ['pottery', 5, 1, 24, 2, 0, 2, 0, 20, 5, 1, 'r'],
  ['coal', 1, 1, 5, 0, 0, 0, 2, 1, 4, 2, 'c'],
  ['coal', 2, 2, 7, 0, 0, 0, 3, 2, 7, 1],
  ['coal', 3, 2, 8, 0, 1, 0, 4, 3, 6, 1],
  ['coal', 4, 2, 10, 0, 1, 0, 5, 4, 5, 1],
  ['iron', 1, 1, 5, 1, 0, 0, 4, 3, 3, 1, 'c'],
  ['iron', 2, 1, 7, 1, 0, 0, 4, 5, 3, 1],
  ['iron', 3, 1, 9, 1, 0, 0, 5, 7, 2, 1],
  ['iron', 4, 1, 12, 1, 0, 0, 6, 9, 1, 1],
  ['brewery', 1, 2, 5, 0, 1, 0, 0, 4, 4, 2, 'c'],
  ['brewery', 2, 2, 7, 0, 1, 0, 0, 5, 5, 2],
  ['brewery', 3, 2, 9, 0, 1, 0, 0, 7, 5, 2],
  ['brewery', 4, 1, 9, 0, 1, 0, 0, 10, 5, 2, 'r'],
];

export const TILES: TileDef[] = ROWS.map(([industry, level, count, money, coal, iron, beer, res, vp, income, linkVp, f = '']) => ({
  industry, level, count, money, coal, iron, beer, res, vp, income, linkVp,
  canal: !f.includes('r'),
  rail: !f.includes('c'),
  noDevelop: f.includes('b'),
}));

/** Стопка отрасли на планшете: плитки по возрастанию уровня, каждая столько раз, сколько их есть. */
export const STACKS: Record<Industry, TileDef[]> = {
  cotton: [], manufacturer: [], pottery: [], coal: [], iron: [], brewery: [],
};
for (const t of TILES) for (let i = 0; i < t.count; i++) STACKS[t.industry].push(t);

export function tileDef(industry: Industry, level: number): TileDef {
  const t = TILES.find((x) => x.industry === industry && x.level === level);
  if (!t) throw new Error(`нет плитки ${industry} ${level}`);
  return t;
}

/** Бочек на новой пивоварне. */
export const BREWERY_BARRELS = { canal: 1, rail: 2 } as const;

export const INDUSTRY_RU: Record<Industry, string> = {
  cotton: 'Хлопкопрядильня',
  manufacturer: 'Мануфактура',
  pottery: 'Гончарня',
  coal: 'Угольная шахта',
  iron: 'Металлургический завод',
  brewery: 'Пивоварня',
};

export const INDUSTRY_SHORT: Record<Industry, string> = {
  cotton: 'хлопок',
  manufacturer: 'мануфактура',
  pottery: 'гончарня',
  coal: 'уголь',
  iron: 'железо',
  brewery: 'пивоварня',
};

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
