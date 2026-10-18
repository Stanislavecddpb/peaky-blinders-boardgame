import { MERCHANTS } from './data/board';
import { buyFromMarket } from './data/market';
import { connectedToAnyMerchant, distances, reachable } from './graph';
import { flipTile, locName, nameOf, pay } from './helpers';
import type { BBState, BeerPick, Industry, LocId, MerchantId, MerchantTile, NodeId, ResPick } from './types';

export interface ResSource {
  loc: LocId;
  slot: number;
  owner: string;
  avail: number;
  /** Для угля — расстояние в связях. */
  dist: number;
}

/** Шахты с углём, связанные с местом, по возрастанию расстояния. */
export function coalSources(G: BBState, at: NodeId[]): ResSource[] {
  const dist = distances(G, at);
  const out: ResSource[] = [];
  for (const [loc, slots] of Object.entries(G.slots)) {
    const d = dist.get(loc);
    if (d == null) continue;
    slots.forEach((t, slot) => {
      if (t && t.industry === 'coal' && !t.flipped && t.res > 0) out.push({ loc, slot, owner: t.owner, avail: t.res, dist: d });
    });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

/** Все заводы с железом (связь не нужна). */
export function ironSources(G: BBState): ResSource[] {
  const out: ResSource[] = [];
  for (const [loc, slots] of Object.entries(G.slots)) {
    slots.forEach((t, slot) => {
      if (t && t.industry === 'iron' && !t.flipped && t.res > 0) out.push({ loc, slot, owner: t.owner, avail: t.res, dist: 0 });
    });
  }
  return out;
}

const totalAvail = (s: ResSource[]) => s.reduce((a, x) => a + x.avail, 0);

/** Проверить явный выбор кубов и вернуть итоговый список; null-ошибка — строка. */
function resolvePicks(sources: ResSource[], need: number, picks: ResPick[] | undefined, nearestFirst: boolean): ResPick[] | string {
  const fromBoard = Math.min(need, totalAvail(sources));
  if (!picks) {
    // По умолчанию: ближайшие (для железа — по порядку), по очереди.
    const out: ResPick[] = [];
    let left = fromBoard;
    for (const s of sources) {
      if (left <= 0) break;
      const n = Math.min(left, s.avail);
      out.push({ loc: s.loc, slot: s.slot, n });
      left -= n;
    }
    return out;
  }
  let sum = 0;
  const used = new Map<string, number>();
  for (const p of picks) {
    if (p.n <= 0) continue;
    const s = sources.find((x) => x.loc === p.loc && x.slot === p.slot);
    if (!s) return `Источник в ${locName(p.loc)} недоступен`;
    const k = `${p.loc}:${p.slot}`;
    const total = (used.get(k) ?? 0) + p.n;
    if (total > s.avail) return `В ${locName(p.loc)} столько нет`;
    used.set(k, total);
    sum += p.n;
  }
  if (sum !== fromBoard) return `Нужно взять с поля ${fromBoard}, выбрано ${sum}`;
  if (nearestFirst) {
    // Пока не исчерпаны ближние шахты, дальние брать нельзя.
    for (const s of sources) {
      const takenHere = used.get(`${s.loc}:${s.slot}`) ?? 0;
      if (takenHere === 0) continue;
      const nearer = sources.filter((x) => x.dist < s.dist);
      const nearerTaken = nearer.reduce((a, x) => a + (used.get(`${x.loc}:${x.slot}`) ?? 0), 0);
      if (nearerTaken < totalAvail(nearer)) return 'Уголь берётся из ближайших шахт';
    }
  }
  return picks.filter((p) => p.n > 0);
}

function consume(G: BBState, picks: ResPick[]): void {
  for (const p of picks) {
    const t = G.slots[p.loc][p.slot]!;
    t.res -= p.n;
    if (t.res === 0) flipTile(G, p.loc, p.slot);
  }
}

function describe(G: BBState, what: string, picks: ResPick[], market: number, cost: number): string {
  const parts = picks.map((p) => `${locName(p.loc)} (${nameOf(G, G.slots[p.loc][p.slot]!.owner)}) ×${p.n}`);
  if (market) parts.push(`рынок ×${market} за £${cost}`);
  return `${what}: ${parts.join(', ')}`;
}

/** Взять уголь для места at: ближайшие связанные шахты, затем рынок (если есть связь с торговцем). */
export function takeCoal(G: BBState, pid: string, at: NodeId[], need: number, picks?: ResPick[]): string | null {
  if (need <= 0) return null;
  const sources = coalSources(G, at);
  const resolved = resolvePicks(sources, need, picks, true);
  if (typeof resolved === 'string') return resolved;
  const fromBoard = resolved.reduce((a, p) => a + p.n, 0);
  const market = need - fromBoard;
  let cost = 0;
  if (market > 0) {
    if (!connectedToAnyMerchant(G, at)) return 'Угля нет: связанных шахт не хватает, а связи с торговцем для рынка нет';
    const buy = buyFromMarket('coal', G.coal, market);
    const err = pay(G, pid, buy.cost);
    if (err) return err;
    G.coal = buy.filled;
    cost = buy.cost;
  }
  consume(G, resolved);
  G.lastRes.push(describe(G, 'уголь', resolved, market, cost));
  return null;
}

/** Взять железо: любые заводы, затем рынок. */
export function takeIron(G: BBState, pid: string, need: number, picks?: ResPick[]): string | null {
  if (need <= 0) return null;
  const resolved = resolvePicks(ironSources(G), need, picks, false);
  if (typeof resolved === 'string') return resolved;
  const fromBoard = resolved.reduce((a, p) => a + p.n, 0);
  const market = need - fromBoard;
  let cost = 0;
  if (market > 0) {
    const buy = buyFromMarket('iron', G.iron, market);
    const err = pay(G, pid, buy.cost);
    if (err) return err;
    G.iron = buy.filled;
    cost = buy.cost;
  }
  consume(G, resolved);
  G.lastRes.push(describe(G, 'железо', resolved, market, cost));
  return null;
}

export const merchantAccepts = (tile: MerchantTile, industry: Industry): boolean =>
  tile === 'any' || tile === industry;

export interface BeerOption {
  pick: BeerPick;
  /** Сколько бочек доступно из этого источника. */
  avail: number;
  owner?: string;
}

/**
 * Доступное пиво: свои пивоварни где угодно, чужие — связанные с местом at;
 * при продаже — бочки торговца merchant у плиток, принимающих отрасль.
 */
export function beerOptions(G: BBState, pid: string, at: NodeId[], sell?: { merchant: MerchantId; industry: Industry }): BeerOption[] {
  const out: BeerOption[] = [];
  if (sell) {
    G.merchants[sell.merchant].tiles.forEach((tile, idx) => {
      if (G.merchants[sell.merchant].beer[idx] && merchantAccepts(tile, sell.industry)) {
        out.push({ pick: { kind: 'merchant', merchant: sell.merchant, idx }, avail: 1 });
      }
    });
  }
  const reach = reachable(G, at);
  const own: BeerOption[] = [];
  const other: BeerOption[] = [];
  for (const [loc, slots] of Object.entries(G.slots)) {
    slots.forEach((t, slot) => {
      if (!t || t.industry !== 'brewery' || t.flipped || t.res <= 0) return;
      const opt: BeerOption = { pick: { kind: 'brewery', loc, slot }, avail: t.res, owner: t.owner };
      if (t.owner === pid) own.push(opt);
      else if (reach.has(loc)) other.push(opt);
    });
  }
  return [...out, ...own, ...other];
}

const pickKey = (p: BeerPick) => (p.kind === 'merchant' ? `m:${p.merchant}:${p.idx}` : `b:${p.loc}:${p.slot}`);

export interface BeerResult {
  error: string | null;
  merchantUsed: number;
}

/** Потратить need бочек пива. */
export function takeBeer(
  G: BBState, pid: string, at: NodeId[], need: number, picks: BeerPick[] | undefined,
  sell?: { merchant: MerchantId; industry: Industry },
): BeerResult {
  if (need <= 0) return { error: null, merchantUsed: 0 };
  const options = beerOptions(G, pid, at, sell);
  let chosen: BeerPick[] = [];
  if (picks) {
    if (picks.length !== need) return { error: `Нужно пива: ${need}`, merchantUsed: 0 };
    const used = new Map<string, number>();
    for (const p of picks) {
      const opt = options.find((o) => pickKey(o.pick) === pickKey(p));
      if (!opt) return { error: 'Это пиво недоступно', merchantUsed: 0 };
      const n = (used.get(pickKey(p)) ?? 0) + 1;
      if (n > opt.avail) return { error: 'Столько пива там нет', merchantUsed: 0 };
      used.set(pickKey(p), n);
    }
    chosen = picks;
  } else {
    // По умолчанию одна бочка торговца (бонус), дальше свои, затем чужие.
    let left = need;
    let merchantTaken = false;
    for (const o of options) {
      if (o.pick.kind === 'merchant') {
        if (merchantTaken) continue;
        merchantTaken = true;
      }
      const n = Math.min(left, o.avail);
      for (let i = 0; i < n; i++) chosen.push(o.pick);
      left -= n;
      if (left === 0) break;
    }
    if (left > 0) return { error: 'Не хватает пива', merchantUsed: 0 };
  }
  let merchantUsed = 0;
  const parts: string[] = [];
  for (const p of chosen) {
    if (p.kind === 'merchant') {
      G.merchants[p.merchant].beer[p.idx] = false;
      merchantUsed++;
      parts.push(`торговец ${MERCHANTS[p.merchant].ru}`);
    } else {
      const t = G.slots[p.loc][p.slot]!;
      t.res -= 1;
      parts.push(`${locName(p.loc)} (${nameOf(G, t.owner)})`);
      if (t.res === 0) flipTile(G, p.loc, p.slot);
    }
  }
  G.lastRes.push(`пиво: ${parts.join(', ')}`);
  return { error: null, merchantUsed };
}
