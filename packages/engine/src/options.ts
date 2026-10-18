import { LINKS, LOCATIONS } from './data/board';
import { faceOf, isWild } from './data/cards';
import { loanSpace } from './data/market';
import { tryAction } from './action';
import { checkBuild } from './actions/build';
import { linkError } from './actions/network';
import { canDevelop, sellMerchants } from './actions/other';
import type { Action, BBState, Industry, LocId, MerchantId } from './types';
import { INDUSTRIES } from './types';

export interface BuildTarget {
  loc: LocId;
  slot: number;
  industry: Industry;
}

/** Карты руки с уникальными лицами (одинаковые карты дают одинаковые варианты). */
export function uniqueCards(hand: string[]): string[] {
  const seen = new Set<string>();
  return hand.filter((c) => {
    const f = faceOf(c);
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });
}

/** Куда можно строить с этой картой (с учётом денег и ресурсов). */
export function buildTargets(G: BBState, pid: string, card: string): BuildTarget[] {
  const out: BuildTarget[] = [];
  for (const [loc, def] of Object.entries(LOCATIONS)) {
    def.slots.forEach((icons, slot) => {
      for (const industry of icons) {
        const a: Action = { type: 'build', card, industry, loc, slot };
        if (checkBuild(G, pid, a)) continue;
        if (!tryAction(G, pid, a).error) out.push({ loc, slot, industry });
      }
    });
  }
  return out;
}

/** Связи, которые можно построить (вторая — после first). */
export function linkTargets(G: BBState, pid: string, card: string, first?: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < LINKS.length; i++) {
    if (first == null) {
      if (linkError(G, pid, i)) continue;
      if (!tryAction(G, pid, { type: 'network', card, links: [i] }).error) out.push(i);
    } else {
      if (i === first) continue;
      if (!tryAction(G, pid, { type: 'network', card, links: [first, i] }).error) out.push(i);
    }
  }
  return out;
}

/** Отрасли, которые можно развивать (с учётом уже выбранных). */
export function developIndustries(G: BBState, pid: string, chosen: Industry[] = []): Industry[] {
  return INDUSTRIES.filter((ind) => canDevelop(G, pid, ind, chosen.filter((c) => c === ind).length));
}

export interface SellTarget {
  loc: LocId;
  slot: number;
  industry: Industry;
  merchants: MerchantId[];
}

/** Свои неперевёрнутые плитки на продажу, связанные с подходящим торговцем. */
export function sellTargets(G: BBState, pid: string): SellTarget[] {
  const out: SellTarget[] = [];
  for (const [loc, slots] of Object.entries(G.slots)) {
    slots.forEach((t, slot) => {
      if (!t || t.owner !== pid || t.flipped) return;
      if (t.industry !== 'cotton' && t.industry !== 'manufacturer' && t.industry !== 'pottery') return;
      const merchants = sellMerchants(G, loc, t.industry);
      if (merchants.length) out.push({ loc, slot, industry: t.industry, merchants });
    });
  }
  return out;
}

export const canLoan = (G: BBState, pid: string): boolean => loanSpace(G.players[pid].incomeSpace) != null;

export function canScout(G: BBState, pid: string): boolean {
  const hand = G.players[pid].hand;
  return hand.length >= 3 && !hand.some(isWild) && G.wild.location > 0 && G.wild.industry > 0;
}

/** Все (почти все) допустимые действия — для тестов и ботов. Продажи — по одной плитке и «всё сразу». */
export function enumerateActions(G: BBState, pid: string): Action[] {
  const hand = G.players[pid].hand;
  if (!hand.length) return [];
  const out: Action[] = [];
  const ok = (a: Action) => { if (!tryAction(G, pid, a).error) out.push(a); };
  for (const card of uniqueCards(hand)) {
    for (const t of buildTargets(G, pid, card)) out.push({ type: 'build', card, ...t });
  }
  const card = hand[0];
  for (const i of linkTargets(G, pid, card)) {
    out.push({ type: 'network', card, links: [i] });
    if (G.era === 'rail') for (const j of linkTargets(G, pid, card, i)) out.push({ type: 'network', card, links: [i, j] });
  }
  for (const a of developIndustries(G, pid)) {
    ok({ type: 'develop', card, industries: [a] });
    for (const b of developIndustries(G, pid, [a])) if (b >= a) ok({ type: 'develop', card, industries: [a, b] });
  }
  const sells = sellTargets(G, pid);
  for (const s of sells) for (const m of s.merchants) ok({ type: 'sell', card, sales: [{ loc: s.loc, slot: s.slot, merchant: m }] });
  if (sells.length > 1) ok({ type: 'sell', card, sales: sells.map((s) => ({ loc: s.loc, slot: s.slot, merchant: s.merchants[0] })) });
  if (canLoan(G, pid)) out.push({ type: 'loan', card });
  if (canScout(G, pid)) out.push({ type: 'scout', cards: hand.slice(0, 3) });
  out.push({ type: 'pass', card });
  return out;
}
