import { LINKS, MERCHANT_IDS, isMerchant } from './data/board';
import type { BBState, LocId, NodeId } from './types';

/** Смежность по построенным связям (любых игроков). */
function adjacency(G: BBState): Map<NodeId, NodeId[]> {
  const adj = new Map<NodeId, NodeId[]>();
  G.links.forEach((owner, i) => {
    if (owner == null) return;
    const ends = LINKS[i].ends;
    for (const a of ends) for (const b of ends) {
      if (a === b) continue;
      const list = adj.get(a);
      if (list) list.push(b);
      else adj.set(a, [b]);
    }
  });
  return adj;
}

/** Расстояния (в связях) от набора узлов по построенным связям. */
export function distances(G: BBState, from: NodeId[]): Map<NodeId, number> {
  const adj = adjacency(G);
  const dist = new Map<NodeId, number>();
  let frontier = [...new Set(from)];
  for (const n of frontier) dist.set(n, 0);
  let d = 0;
  while (frontier.length) {
    d++;
    const next: NodeId[] = [];
    for (const cur of frontier) for (const nb of adj.get(cur) ?? []) {
      if (!dist.has(nb)) { dist.set(nb, d); next.push(nb); }
    }
    frontier = next;
  }
  return dist;
}

export const reachable = (G: BBState, from: NodeId[]): Set<NodeId> => new Set(distances(G, from).keys());

/** Связано ли хоть одно из мест с любой торговой точкой (плитка торговца не обязательна). */
export function connectedToAnyMerchant(G: BBState, from: NodeId[]): boolean {
  const r = reachable(G, from);
  return MERCHANT_IDS.some((m) => r.has(m));
}

/** Есть ли у игрока что-то на поле (плитки или связи). */
export function hasPresence(G: BBState, pid: string): boolean {
  if (G.links.some((o) => o === pid)) return true;
  return Object.values(G.slots).some((s) => s.some((t) => t?.owner === pid));
}

/** Сеть игрока: города с его плитками и все концы его связей. */
export function networkNodes(G: BBState, pid: string): Set<NodeId> {
  const net = new Set<NodeId>();
  for (const [loc, slots] of Object.entries(G.slots)) {
    if (slots.some((t) => t?.owner === pid)) net.add(loc);
  }
  G.links.forEach((owner, i) => {
    if (owner === pid) for (const e of LINKS[i].ends) net.add(e);
  });
  return net;
}

/** Город в сети игрока (или у игрока ещё ничего нет на поле). */
export function inNetwork(G: BBState, pid: string, loc: LocId): boolean {
  return !hasPresence(G, pid) || networkNodes(G, pid).has(loc);
}

/** Связь можно строить в текущую эпоху. */
export const linkAllowed = (G: BBState, i: number): boolean => (G.era === 'canal' ? LINKS[i].canal : LINKS[i].rail);

/** Связь примыкает к сети игрока (или сети нет). */
export function linkAdjacent(G: BBState, pid: string, i: number): boolean {
  if (!hasPresence(G, pid)) return true;
  const net = networkNodes(G, pid);
  return LINKS[i].ends.some((e) => net.has(e));
}

export const locationsOnly = (nodes: Iterable<NodeId>): LocId[] => [...nodes].filter((n) => !isMerchant(n));
