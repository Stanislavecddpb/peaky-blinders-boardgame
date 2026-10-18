import { doAction } from './action';
import { LINKS } from './data/board';
import { applySetColor, applySetName, applyStart, setupGame } from './setup';
import { COLORS, type Action, type BBState, type Industry, type PlacedTile } from './types';

/** Начатая партия без перемешивания: порядок 0,1,2…; руки задаются в тесте. */
export function newGame(n = 2): BBState {
  const G = setupGame(n, (a) => [...a]);
  for (let i = 0; i < n; i++) {
    applySetName(G, String(i), `P${i}`);
    applySetColor(G, String(i), String(i), COLORS[i]);
  }
  applyStart(G, '0');
  return G;
}

/** Ход второго раунда (два действия) для игрока pid. */
export function giveTurn(G: BBState, pid: string, hand: string[], actions = 2): void {
  G.orderPos = G.order.indexOf(pid);
  G.actionsLeft = actions;
  G.players[pid].hand = [...hand];
  G.players[pid].handCount = hand.length;
}

export function put(G: BBState, loc: string, slot: number, owner: string, industry: Industry, level: number, res = 0, flipped = false): PlacedTile {
  const t: PlacedTile = { owner, industry, level, res, flipped };
  G.slots[loc][slot] = t;
  return t;
}

export function link(G: BBState, ends: [string, string], owner: string): number {
  const i = LINKS.findIndex((l) => l.ends.includes(ends[0]) && l.ends.includes(ends[1]));
  if (i < 0) throw new Error(`нет связи ${ends}`);
  G.links[i] = owner;
  return i;
}

/** Выполнить действие на копии; вернуть ошибку и копию. */
export function act(G: BBState, pid: string, a: Action): { err: string | null; G: BBState } {
  const copy = structuredClone(G);
  const err = doAction(copy, pid, a);
  return { err, G: copy };
}
