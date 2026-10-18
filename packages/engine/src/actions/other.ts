import { MERCHANTS } from '../data/board';
import { isWild } from '../data/cards';
import { advanceIncome, incomeLevel, loanSpace } from '../data/market';
import { INDUSTRY_SHORT, STACKS, tileDef } from '../data/tiles';
import { reachable } from '../graph';
import { discardCard, flipTile, locName, log, markChanged, nameOf, slotKey, tileName } from '../helpers';
import { merchantAccepts, takeBeer, takeIron } from '../resources';
import { INDUSTRIES, type Action, type BBState, type Industry, type LocId, type MerchantId } from '../types';

type Develop = Extract<Action, { type: 'develop' }>;
type Sell = Extract<Action, { type: 'sell' }>;

/** Отрасль, у которой можно развить следующую плитку. */
export function canDevelop(G: BBState, pid: string, industry: Industry, already = 0): boolean {
  const t = STACKS[industry][G.players[pid].taken[industry] + already];
  return !!t && !t.noDevelop;
}

/** Снять плитку с планшета (без оплаты). */
function removeFromMat(G: BBState, pid: string, industry: Industry): string | null {
  if (!canDevelop(G, pid, industry)) {
    const t = STACKS[industry][G.players[pid].taken[industry]];
    return t ? `${tileName(t)} (лампочка) развивать нельзя` : `Плитки «${INDUSTRY_SHORT[industry]}» кончились`;
  }
  G.players[pid].taken[industry]++;
  return null;
}

export function doDevelop(G: BBState, pid: string, a: Develop): string | null {
  const p = G.players[pid];
  if (!p.hand.includes(a.card)) return 'Этой карты нет на руке';
  if (a.industries.length < 1 || a.industries.length > 2) return 'Развить можно одну или две плитки';
  discardCard(G, pid, a.card);
  const names: string[] = [];
  for (const ind of a.industries) {
    const t = STACKS[ind][p.taken[ind]];
    const err = removeFromMat(G, pid, ind);
    if (err) return err;
    names.push(tileName(t));
  }
  const before = p.money;
  const err = takeIron(G, pid, a.industries.length, a.iron);
  if (err) return err;
  log(G, `${nameOf(G, pid)} развивает: ${names.join(', ')} (£${before - p.money}; ${G.lastRes.join('; ')})`, pid);
  return null;
}

/** Торговцы, которым можно продать плитку в loc (связь + подходящая плитка торговца). */
export function sellMerchants(G: BBState, loc: LocId, industry: Industry): MerchantId[] {
  const reach = reachable(G, [loc]);
  return (Object.keys(G.merchants) as MerchantId[]).filter(
    (m) => reach.has(m) && G.merchants[m].tiles.some((t) => merchantAccepts(t, industry)),
  );
}

export function doSell(G: BBState, pid: string, a: Sell): string | null {
  const p = G.players[pid];
  if (!p.hand.includes(a.card)) return 'Этой карты нет на руке';
  if (!a.sales.length) return 'Выберите, что продать';
  discardCard(G, pid, a.card);
  const bonusQueue = [...(a.bonusDevelop ?? [])];
  for (const s of a.sales) {
    const t = G.slots[s.loc]?.[s.slot];
    if (!t || t.owner !== pid) return 'Продавать можно только свои плитки';
    if (t.flipped) return 'Плитка уже перевёрнута';
    if (t.industry !== 'cotton' && t.industry !== 'manufacturer' && t.industry !== 'pottery') return 'Продаются только хлопок, мануфактуры и гончарни';
    if (!sellMerchants(G, s.loc, t.industry).includes(s.merchant)) {
      return `${MERCHANTS[s.merchant].ru} не покупает это или не связан с ${locName(s.loc)}`;
    }
    const def = tileDef(t.industry, t.level);
    if (s.beer && s.beer.filter((b) => b.kind === 'merchant').length > 1) return 'Не больше одной бочки торговца на продажу';
    G.lastRes = [];
    const r = takeBeer(G, pid, [s.loc], def.beer, s.beer, { merchant: s.merchant, industry: t.industry });
    if (r.error) return r.error;
    if (r.merchantUsed > 1) return 'Не больше одной бочки торговца на продажу';
    log(G, `${nameOf(G, pid)} продаёт ${tileName(t)} из ${locName(s.loc)} в ${MERCHANTS[s.merchant].ru}${G.lastRes.length ? ` (${G.lastRes.join('; ')})` : ''}`, pid);
    flipTile(G, s.loc, s.slot);
    markChanged(G, [slotKey(s.loc, s.slot)], []);
    if (r.merchantUsed) {
      const b = MERCHANTS[s.merchant].bonus;
      if (b.kind === 'vp') {
        p.vp += b.amount;
        log(G, `Бонус ${MERCHANTS[s.merchant].ru}: +${b.amount} ПО`, pid);
      } else if (b.kind === 'money') {
        p.money += b.amount;
        log(G, `Бонус ${MERCHANTS[s.merchant].ru}: +£${b.amount}`, pid);
      } else if (b.kind === 'income') {
        p.incomeSpace = advanceIncome(p.incomeSpace, b.amount);
        log(G, `Бонус ${MERCHANTS[s.merchant].ru}: доход +${b.amount}`, pid);
      } else {
        const want = bonusQueue.shift();
        const ind = want ?? INDUSTRIES.find((i) => canDevelop(G, pid, i));
        if (ind) {
          const tile = STACKS[ind][p.taken[ind]];
          const err = removeFromMat(G, pid, ind);
          if (err) return err;
          log(G, `Бонус ${MERCHANTS[s.merchant].ru}: бесплатное развитие (${tileName(tile)})`, pid);
        }
      }
    }
  }
  return null;
}

export function doLoan(G: BBState, pid: string, card: string): string | null {
  const p = G.players[pid];
  if (!p.hand.includes(card)) return 'Этой карты нет на руке';
  const space = loanSpace(p.incomeSpace);
  if (space == null) return 'Доход не может опуститься ниже −10';
  discardCard(G, pid, card);
  p.money += 30;
  p.incomeSpace = space;
  log(G, `${nameOf(G, pid)} берёт заём £30 (доход теперь ${incomeLevel(space)})`, pid);
  return null;
}

export function doScout(G: BBState, pid: string, cards: string[]): string | null {
  const p = G.players[pid];
  if (cards.length !== 3 || new Set(cards).size !== 3) return 'Нужно сбросить три карты';
  if (cards.some((c) => !p.hand.includes(c))) return 'Этой карты нет на руке';
  if (p.hand.some(isWild)) return 'На руке уже есть джокер';
  if (G.wild.location < 1 || G.wild.industry < 1) return 'Джокеры кончились';
  for (const c of cards) discardCard(G, pid, c);
  G.wild.location--;
  G.wild.industry--;
  p.hand.push(`wild-location#${pid}`, `wild-industry#${pid}`);
  p.handCount = p.hand.length;
  log(G, `${nameOf(G, pid)} разведывает: сбрасывает 3 карты и берёт «любую локацию» и «любую отрасль»`, pid);
  return null;
}

export function doPass(G: BBState, pid: string, card: string): string | null {
  const err = discardCard(G, pid, card);
  if (err) return err;
  log(G, `${nameOf(G, pid)} пропускает действие`, pid);
  return null;
}
