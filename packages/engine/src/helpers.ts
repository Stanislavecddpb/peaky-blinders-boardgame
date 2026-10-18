import { LOCATIONS } from './data/board';
import { advanceIncome } from './data/market';
import { INDUSTRY_SHORT, ROMAN, tileDef } from './data/tiles';
import type { BBState, LocId, PlacedTile, PlayerState } from './types';

export const COLOR_RU: Record<string, string> = {
  orange: 'оранжевый', purple: 'фиолетовый', teal: 'серебряный', yellow: 'жёлтый',
};

export function nameOf(G: BBState, pid: string): string {
  return G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;
}

export function log(G: BBState, text: string, pid?: string): void {
  const n = (G.log[G.log.length - 1]?.n ?? 0) + 1;
  G.log.push(pid == null ? { n, text } : { n, text, pid });
  if (G.log.length > 400) G.log.splice(0, G.log.length - 400);
}

export const player = (G: BBState, pid: string): PlayerState => G.players[pid];

/** Текущий игрок по порядку раунда. */
export const currentPid = (G: BBState): string => G.order[G.orderPos];

/** Заплатить: деньги уходят в банк и учитываются в тратах. Ошибка, если не хватает. */
export function pay(G: BBState, pid: string, amount: number): string | null {
  const p = G.players[pid];
  if (amount <= 0) return null;
  if (p.money < amount) return `Не хватает денег: нужно £${amount}, есть £${p.money}`;
  p.money -= amount;
  p.spent += amount;
  return null;
}

export const slotKey = (loc: LocId, slot: number): string => `${loc}:${slot}`;

export function tileName(t: Pick<PlacedTile, 'industry' | 'level'>): string {
  return `${INDUSTRY_SHORT[t.industry]} ${ROMAN[t.level]}`;
}

export const locName = (loc: LocId): string => LOCATIONS[loc]?.ru ?? loc;

/** Перевернуть плитку: доход владельца растёт на значение плитки. */
export function flipTile(G: BBState, loc: LocId, slot: number): void {
  const t = G.slots[loc][slot];
  if (!t || t.flipped) return;
  t.flipped = true;
  const def = tileDef(t.industry, t.level);
  const p = G.players[t.owner];
  p.incomeSpace = advanceIncome(p.incomeSpace, def.income);
  log(G, `Переворачивается ${tileName(t)} (${nameOf(G, t.owner)}) в ${locName(loc)}: доход +${def.income}`, t.owner);
}

/** Убрать карту из руки в сброс (джокер — обратно в запас). */
export function discardCard(G: BBState, pid: string, card: string): string | null {
  const p = G.players[pid];
  const i = p.hand.indexOf(card);
  if (i < 0) return 'Этой карты нет на руке';
  p.hand.splice(i, 1);
  p.handCount = p.hand.length;
  if (card.startsWith('wild-location')) G.wild.location++;
  else if (card.startsWith('wild-industry')) G.wild.industry++;
  else G.discard.push(card);
  p.lastDiscard = card;
  return null;
}

export function markChanged(G: BBState, slots: string[], links: number[]): void {
  G.changes.slots.push(...slots);
  G.changes.links.push(...links);
}
