import type { Industry, LocId } from '../types';
import { LOCATIONS } from './board';
import { INDUSTRY_SHORT } from './tiles';

/** Карта: id вида `loc-birmingham#0`, `ind-cotton-manufacturer#3`, `wild-location#1`. */
export type CardFace =
  | { kind: 'location'; loc: LocId }
  | { kind: 'industry'; industries: Industry[] }
  | { kind: 'wild-location' }
  | { kind: 'wild-industry' };

/** Лицо карты = имя картинки. */
export const faceOf = (id: string): string => id.split('#')[0];

export function cardFace(id: string): CardFace {
  const face = faceOf(id);
  if (face === 'wild-location') return { kind: 'wild-location' };
  if (face === 'wild-industry') return { kind: 'wild-industry' };
  if (face.startsWith('loc-')) return { kind: 'location', loc: face.slice(4) };
  if (face === 'ind-cotton-manufacturer') return { kind: 'industry', industries: ['cotton', 'manufacturer'] };
  return { kind: 'industry', industries: [face.slice(4) as Industry] };
}

export const isWild = (id: string): boolean => faceOf(id).startsWith('wild-');

export function cardName(id: string): string {
  const f = cardFace(id);
  switch (f.kind) {
    case 'location': return LOCATIONS[f.loc].ru;
    case 'industry': return f.industries.map((i) => INDUSTRY_SHORT[i]).join(' / ');
    case 'wild-location': return 'любая локация';
    case 'wild-industry': return 'любая отрасль';
  }
}

/** [лицо, сколько копий, с какого числа игроков]. Итого 40 / 54 / 64. */
const SPECS: [string, number, 2 | 3 | 4][] = [
  ['loc-birmingham', 3, 2],
  ['loc-coventry', 3, 2],
  ['loc-coalbrookdale', 3, 2],
  ['loc-derby', 3, 4],
  ['loc-stoke-on-trent', 3, 3],
  ['loc-belper', 2, 4],
  ['loc-leek', 2, 3],
  ['loc-stone', 2, 3],
  ['loc-uttoxeter', 1, 4],
  ['loc-uttoxeter', 1, 3],
  ['loc-stafford', 2, 2],
  ['loc-burton-on-trent', 2, 2],
  ['loc-cannock', 2, 2],
  ['loc-dudley', 2, 2],
  ['loc-kidderminster', 2, 2],
  ['loc-wolverhampton', 2, 2],
  ['loc-worcester', 2, 2],
  ['loc-tamworth', 1, 2],
  ['loc-walsall', 1, 2],
  ['loc-nuneaton', 1, 2],
  ['loc-redditch', 1, 2],
  ['ind-iron', 4, 2],
  ['ind-coal', 1, 4],
  ['ind-coal', 2, 2],
  ['ind-pottery', 1, 4],
  ['ind-pottery', 2, 2],
  ['ind-brewery', 5, 2],
  ['ind-cotton-manufacturer', 2, 4],
  ['ind-cotton-manufacturer', 6, 3],
];

export function buildDeck(numPlayers: number): string[] {
  const deck: string[] = [];
  const counter: Record<string, number> = {};
  for (const [face, count, min] of SPECS) {
    if (min > numPlayers) continue;
    for (let i = 0; i < count; i++) {
      const n = counter[face] ?? 0;
      counter[face] = n + 1;
      deck.push(`${face}#${n}`);
    }
  }
  return deck;
}

export const WILD_COUNT = 4;
export const HAND_SIZE = 8;
