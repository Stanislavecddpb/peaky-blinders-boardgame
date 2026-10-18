/**
 * Геометрия поля в координатах оригинального скана 6144×6144.
 * Данные разметки взяты из jiangshibiao/BrassBirmingham (web/src/board/geometry.ts).
 */
import type { LocId, MerchantId } from '@bb/engine';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Видимая область поля (картинка board.webp обрезана ровно по ней). */
export const CROP = { x: 1000, y: 1000, size: 4180 };

export const DECK_RECTS = {
  draw: { x: 1300, y: 1434, w: 646, h: 491 },
  wildIndustry: { x: 1300, y: 1987, w: 646, h: 491 },
  wildLocation: { x: 1300, y: 2529, w: 646, h: 491 },
} as const;

export const SLOT_RECTS: Record<LocId, Rect[]> = {
  belper: [
    { x: 3810, y: 1335, w: 185, h: 177 },
    { x: 3998, y: 1335, w: 183, h: 177 },
    { x: 4184, y: 1335, w: 176, h: 177 },
  ],
  derby: [
    { x: 4031, y: 1825, w: 177, h: 185 },
    { x: 3939, y: 2013, w: 176, h: 177 },
    { x: 4119, y: 2013, w: 182, h: 177 },
  ],
  leek: [
    { x: 3105, y: 1277, w: 185, h: 177 },
    { x: 3293, y: 1277, w: 176, h: 177 },
  ],
  'stoke-on-trent': [
    { x: 2636, y: 1381, w: 177, h: 177 },
    { x: 2541, y: 1567, w: 176, h: 176 },
    { x: 2730, y: 1567, w: 176, h: 176 },
  ],
  stone: [
    { x: 2124, y: 1990, w: 176, h: 177 },
    { x: 2304, y: 1990, w: 182, h: 176 },
  ],
  uttoxeter: [
    { x: 3154, y: 1921, w: 186, h: 177 },
    { x: 3343, y: 1921, w: 177, h: 177 },
  ],
  stafford: [
    { x: 2497, y: 2365, w: 177, h: 177 },
    { x: 2677, y: 2365, w: 183, h: 177 },
  ],
  'burton-on-trent': [
    { x: 3627, y: 2481, w: 176, h: 177 },
    { x: 3807, y: 2481, w: 183, h: 177 },
  ],
  cannock: [
    { x: 2793, y: 2774, w: 176, h: 178 },
    { x: 2978, y: 2774, w: 176, h: 177 },
  ],
  tamworth: [
    { x: 3687, y: 2983, w: 177, h: 176 },
    { x: 3869, y: 2983, w: 176, h: 176 },
  ],
  walsall: [
    { x: 3018, y: 3235, w: 177, h: 176 },
    { x: 3204, y: 3235, w: 176, h: 176 },
  ],
  wolverhampton: [
    { x: 2373, y: 3142, w: 176, h: 177 },
    { x: 2558, y: 3143, w: 176, h: 176 },
  ],
  coalbrookdale: [
    { x: 1915, y: 3131, w: 176, h: 184 },
    { x: 1821, y: 3319, w: 177, h: 176 },
    { x: 2007, y: 3317, w: 177, h: 177 },
  ],
  dudley: [
    { x: 2559, y: 3634, w: 176, h: 176 },
    { x: 2744, y: 3633, w: 176, h: 177 },
  ],
  kidderminster: [
    { x: 2280, y: 4047, w: 176, h: 178 },
    { x: 2465, y: 4047, w: 176, h: 178 },
  ],
  worcester: [
    { x: 2332, y: 4566, w: 177, h: 177 },
    { x: 2513, y: 4566, w: 182, h: 177 },
  ],
  birmingham: [
    { x: 3409, y: 3600, w: 176, h: 177 },
    { x: 3596, y: 3600, w: 176, h: 177 },
    { x: 3409, y: 3779, w: 177, h: 186 },
    { x: 3596, y: 3779, w: 176, h: 186 },
  ],
  coventry: [
    { x: 4232, y: 3727, w: 176, h: 176 },
    { x: 4139, y: 3914, w: 176, h: 177 },
    { x: 4319, y: 3914, w: 183, h: 177 },
  ],
  nuneaton: [
    { x: 4047, y: 3387, w: 177, h: 177 },
    { x: 4228, y: 3386, w: 183, h: 177 },
  ],
  redditch: [
    { x: 3222, y: 4261, w: 177, h: 177 },
    { x: 3402, y: 4261, w: 185, h: 177 },
  ],
  'farm-north': [{ x: 2180, y: 2724, w: 176, h: 177 }],
  'farm-south': [{ x: 2023, y: 4346, w: 177, h: 177 }],
};


export const TURN_BARRELS: Point[] = [
  { x: 1490, y: 3780 },
  { x: 1495, y: 4110 },
  { x: 1490, y: 4425 },
  { x: 1495, y: 4700 },
];

export const TURN_MONEY: Point[] = [
  { x: 1770, y: 3785 },
  { x: 1775, y: 4115 },
  { x: 1775, y: 4430 },
  { x: 1772, y: 4705 },
];


export const MERCHANT_GEOM: Record<MerchantId, { tiles: Rect[]; beer: Rect[] }> = {
  warrington: {
    tiles: [
      { x: 2004, y: 1496, w: 171, h: 166 },
      { x: 2186, y: 1496, w: 180, h: 166 },
    ],
    beer: [
      { x: 2011, y: 1682, w: 90, h: 98 },
      { x: 2236, y: 1682, w: 93, h: 98 },
    ],
  },
  nottingham: {
    tiles: [
      { x: 4505, y: 1749, w: 177, h: 178 },
      { x: 4702, y: 1749, w: 167, h: 178 },
    ],
    beer: [
      { x: 4514, y: 1958, w: 92, h: 102 },
      { x: 4781, y: 1958, w: 88, h: 102 },
    ],
  },
  shrewsbury: {
    tiles: [{ x: 1343, y: 3311, w: 178, h: 186 }],
    beer: [{ x: 1551, y: 3329, w: 95, h: 100 }],
  },
  gloucester: {
    tiles: [
      { x: 3313, y: 4706, w: 178, h: 180 },
      { x: 3500, y: 4706, w: 170, h: 180 },
    ],
    beer: [
      { x: 3313, y: 4595, w: 89, h: 93 },
      { x: 3582, y: 4595, w: 92, h: 93 },
    ],
  },
  oxford: {
    tiles: [
      { x: 4203, y: 4402, w: 176, h: 182 },
      { x: 4390, y: 4402, w: 170, h: 182 },
    ],
    beer: [
      { x: 4204, y: 4291, w: 86, h: 98 },
      { x: 4470, y: 4291, w: 85, h: 98 },
    ],
  },
};


export const COAL_MARKET_CELLS: Point[] = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7].map(
  (price, i) => ({ x: 4455 + (i % 2) * 75, y: 3140 - (price - 1) * 120 }),
);

export const IRON_MARKET_CELLS: Point[] = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5].map((price, i) => ({
  x: 4670 + (i % 2) * 80,
  y: 3140 - (price - 1) * 120,
}));
export const MARKET_CELL_SIZE = 66;



interface RingSide {
  from: Point;
  to: Point;
  count: number;
}
const VP_SIDES: RingSide[] = [
  { from: { x: 1100, y: 4740 }, to: { x: 1130, y: 1370 }, count: 25 },
  { from: { x: 1325, y: 1125 }, to: { x: 4840, y: 1110 }, count: 24 },
  { from: { x: 4975, y: 1370 }, to: { x: 4975, y: 4610 }, count: 25 },
  { from: { x: 4620, y: 4985 }, to: { x: 1320, y: 4980 }, count: 26 },
];
const INCOME_SIDES: RingSide[] = [
  { from: { x: 1175, y: 4740 }, to: { x: 1175, y: 1370 }, count: 25 },
  { from: { x: 1325, y: 1200 }, to: { x: 4992, y: 1200 }, count: 25 },
  { from: { x: 4855, y: 1505 }, to: { x: 4855, y: 4745 }, count: 25 },
  { from: { x: 4620, y: 4935 }, to: { x: 1320, y: 4935 }, count: 25 },
];

function ringPositions(sides: RingSide[]): Point[] {
  const out: Point[] = [];
  for (const { from, to, count } of sides) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      out.push({ x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t) });
    }
  }
  return out;
}

export const VP_TRACK: Point[] = ringPositions(VP_SIDES);
export const INCOME_TRACK: Point[] = ringPositions(INCOME_SIDES);


export const LINK_MIDPOINTS: Record<number, Point> = {
  0: { x: 4120, y: 1725 },
  1: { x: 3645, y: 1360 },
  2: { x: 3953, y: 3913 },
  3: { x: 3230, y: 3800 },
  4: { x: 4030, y: 3635 },
  5: { x: 3885, y: 4165 },
  6: { x: 3520, y: 4140 },
  7: { x: 3790, y: 3420 },
  8: { x: 3320, y: 3625 },
  9: { x: 2935, y: 4320 },
  10: { x: 3315, y: 2645 },
  11: { x: 4095, y: 2300 },
  12: { x: 3015, y: 2200 },
  13: { x: 3845, y: 2740 },
  14: { x: 3415, y: 2920 },
  15: { x: 2890, y: 2570 },
  16: { x: 2462, y: 2801 },
  17: { x: 3170, y: 3045 },
  18: { x: 2514, y: 3024 },
  19: { x: 2130, y: 3825 },
  20: { x: 1685, y: 3250 },
  21: { x: 2102, y: 3284 },
  22: { x: 4460, y: 3615 },
  23: { x: 4430, y: 1910 },
  24: { x: 3670, y: 2050 },
  25: { x: 2340, y: 3984 },
  26: { x: 2600, y: 3580 },
  27: { x: 3040, y: 4640 },
  28: { x: 2800, y: 4765 },
  29: { x: 2460, y: 4445 },
  30: { x: 2895, y: 1415 },
  31: { x: 4095, y: 3048 },
  32: { x: 3566, y: 4427 },
  33: { x: 2280, y: 2390 },
  34: { x: 2445, y: 1842 },
  35: { x: 2405, y: 1410 },
  36: { x: 2720, y: 2015 },
  37: { x: 3565, y: 3245 },
  38: { x: 2758, y: 3263 },
};
