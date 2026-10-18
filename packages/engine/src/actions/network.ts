import { LINKS, linkName } from '../data/board';
import { linkAdjacent, linkAllowed } from '../graph';
import { discardCard, log, markChanged, nameOf, pay } from '../helpers';
import { takeBeer, takeCoal } from '../resources';
import type { Action, BBState } from '../types';

type Network = Extract<Action, { type: 'network' }>;

export const LINK_COST = { canal: 3, rail1: 5, rail2: 15 } as const;
export const LINKS_PER_PLAYER = 14;

/** Можно ли сейчас построить связь i (с учётом уже построенных и сети игрока). */
export function linkError(G: BBState, pid: string, i: number): string | null {
  if (!LINKS[i]) return 'Нет такой связи';
  if (G.links[i] != null) return 'Связь уже построена';
  if (!linkAllowed(G, i)) return G.era === 'canal' ? 'Здесь нет канала' : 'Здесь нет железной дороги';
  if (!linkAdjacent(G, pid, i)) return 'Связь должна примыкать к вашей сети';
  return null;
}

export function doNetwork(G: BBState, pid: string, a: Network): string | null {
  const p = G.players[pid];
  if (!p.hand.includes(a.card)) return 'Этой карты нет на руке';
  const n = a.links.length;
  if (n < 1 || n > (G.era === 'canal' ? 1 : 2)) return G.era === 'canal' ? 'В эпоху каналов — одна связь за действие' : 'Одна или две связи';
  if (n === 2 && a.links[0] === a.links[1]) return 'Две разные связи';
  if (p.linksLeft < n) return 'Жетоны связей кончились';
  discardCard(G, pid, a.card);
  const moneyBefore = p.money;
  const err = pay(G, pid, G.era === 'canal' ? LINK_COST.canal : n === 1 ? LINK_COST.rail1 : LINK_COST.rail2);
  if (err) return err;
  for (let k = 0; k < n; k++) {
    const i = a.links[k];
    const e = linkError(G, pid, i);
    if (e) return e;
    G.links[i] = pid;
    p.linksLeft--;
    if (G.era === 'rail') {
      const ce = takeCoal(G, pid, LINKS[i].ends, 1, a.coal?.[k]);
      if (ce) return ce;
    }
  }
  if (n === 2) {
    const r = takeBeer(G, pid, LINKS[a.links[1]].ends, 1, a.beer ? [a.beer] : undefined);
    if (r.error) return r.error;
  }
  const what = a.links.map(linkName).join(' и ');
  const kind = G.era === 'canal' ? 'канал' : n === 2 ? 'железные дороги' : 'железную дорогу';
  log(G, `${nameOf(G, pid)} строит ${kind} ${what} (£${moneyBefore - p.money}${G.lastRes.length ? '; ' + G.lastRes.join('; ') : ''})`, pid);
  markChanged(G, [], a.links);
  return null;
}
