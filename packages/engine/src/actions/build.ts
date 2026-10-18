import { LOCATIONS } from '../data/board';
import { cardFace } from '../data/cards';
import { sellToMarket } from '../data/market';
import { BREWERY_BARRELS, STACKS, type TileDef } from '../data/tiles';
import { connectedToAnyMerchant, inNetwork } from '../graph';
import { discardCard, flipTile, locName, log, markChanged, nameOf, pay, slotKey, tileName } from '../helpers';
import { takeCoal, takeIron } from '../resources';
import type { Action, BBState, Industry, PlacedTile } from '../types';

type Build = Extract<Action, { type: 'build' }>;

/** Следующая плитка отрасли на планшете игрока (или null, если кончились). */
export function nextTile(G: BBState, pid: string, industry: Industry): TileDef | null {
  return STACKS[industry][G.players[pid].taken[industry]] ?? null;
}

/** Есть ли где-то на поле или рынке этот ресурс (для перестройки чужих шахт/заводов). */
function resourceLeft(G: BBState, industry: 'coal' | 'iron'): boolean {
  if ((industry === 'coal' ? G.coal : G.iron) > 0) return true;
  return Object.values(G.slots).some((s) => s.some((t) => t && t.industry === industry && t.res > 0));
}

/** Проверки без изменения состояния. */
export function checkBuild(G: BBState, pid: string, a: Build): string | null {
  const p = G.players[pid];
  if (!p.hand.includes(a.card)) return 'Этой карты нет на руке';
  const loc = LOCATIONS[a.loc];
  if (!loc) return 'Нет такой локации';
  const icons = loc.slots[a.slot];
  if (!icons) return 'Нет такого слота';
  if (!icons.includes(a.industry)) return 'Этот слот не для этой отрасли';

  const face = cardFace(a.card);
  if (face.kind === 'location' && face.loc !== a.loc) return 'Карта локации позволяет строить только в этом городе';
  if (face.kind === 'industry' && !face.industries.includes(a.industry)) return 'Карта отрасли не подходит';
  if ((face.kind === 'industry' || face.kind === 'wild-industry') && !inNetwork(G, pid, a.loc)) {
    return `${locName(a.loc)} не в вашей сети`;
  }

  const def = nextTile(G, pid, a.industry);
  if (!def) return 'Плитки этой отрасли кончились';
  if (G.era === 'canal' && !def.canal) return `${tileName(def)} строится только в эпоху железных дорог`;
  if (G.era === 'rail' && !def.rail) return `${tileName(def)} нельзя строить в эпоху железных дорог — сначала развейте`;

  const slots = G.slots[a.loc];
  if (G.era === 'canal' && slots.some((t, i) => t?.owner === pid && i !== a.slot)) {
    return 'В эпоху каналов — не больше одной своей плитки в городе';
  }
  const existing = slots[a.slot];
  if (!existing) {
    if (icons.length > 1) {
      const single = loc.slots.findIndex((ic, i) => ic.length === 1 && ic[0] === a.industry && !slots[i]);
      if (single >= 0) return 'Сначала нужно занять свободный слот только с этой отраслью';
    }
  } else {
    if (existing.industry !== a.industry) return 'Перестроить можно только плитку той же отрасли';
    if (def.level <= existing.level) return 'Перестроить можно только плиткой более высокого уровня';
    if (existing.owner !== pid) {
      if (existing.industry !== 'coal' && existing.industry !== 'iron') return 'Чужие плитки перестраивать нельзя (кроме угля и железа)';
      if (resourceLeft(G, existing.industry)) {
        return existing.industry === 'coal'
          ? 'Чужую шахту можно перестроить, только когда угля нет ни на поле, ни на рынке'
          : 'Чужой завод можно перестроить, только когда железа нет ни на поле, ни на рынке';
      }
    }
  }
  return null;
}

export function doBuild(G: BBState, pid: string, a: Build): string | null {
  const err = checkBuild(G, pid, a);
  if (err) return err;
  const p = G.players[pid];
  const def = nextTile(G, pid, a.industry)!;
  const existing = G.slots[a.loc][a.slot];

  discardCard(G, pid, a.card);
  if (existing) {
    G.slots[a.loc][a.slot] = null;
    log(G, `${nameOf(G, pid)} сносит ${tileName(existing)} (${nameOf(G, existing.owner)}) в ${locName(a.loc)}`, pid);
  }
  const moneyBefore = p.money;
  const e1 = pay(G, pid, def.money);
  if (e1) return e1;
  const e2 = takeCoal(G, pid, [a.loc], def.coal, a.coal);
  if (e2) return e2;
  const e3 = takeIron(G, pid, def.iron, a.iron);
  if (e3) return e3;

  const res = a.industry === 'brewery' ? BREWERY_BARRELS[G.era] : def.res;
  const tile: PlacedTile = { owner: pid, industry: a.industry, level: def.level, flipped: false, res };
  G.slots[a.loc][a.slot] = tile;
  p.taken[a.industry]++;
  const spent = moneyBefore - p.money;
  log(G, `${nameOf(G, pid)} строит ${tileName(tile)} в ${locName(a.loc)} (£${spent}${G.lastRes.length ? '; ' + G.lastRes.join('; ') : ''})`, pid);

  // Новая шахта, связанная с торговцем, и любой новый завод сразу продают ресурс на рынок.
  if (a.industry === 'coal' && connectedToAnyMerchant(G, [a.loc])) {
    const s = sellToMarket('coal', G.coal, tile.res);
    if (s.sold) {
      G.coal = s.filled;
      tile.res -= s.sold;
      p.money += s.income;
      log(G, `Продано на рынок угля: ${s.sold} за £${s.income}`, pid);
    }
  }
  if (a.industry === 'iron') {
    const s = sellToMarket('iron', G.iron, tile.res);
    if (s.sold) {
      G.iron = s.filled;
      tile.res -= s.sold;
      p.money += s.income;
      log(G, `Продано на рынок железа: ${s.sold} за £${s.income}`, pid);
    }
  }
  if ((a.industry === 'coal' || a.industry === 'iron') && tile.res === 0) flipTile(G, a.loc, a.slot);
  markChanged(G, [slotKey(a.loc, a.slot)], []);
  return null;
}
