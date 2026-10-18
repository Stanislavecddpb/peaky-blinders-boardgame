import { LINKS, MERCHANT_LINK_VP, isMerchant } from './data/board';
import { HAND_SIZE } from './data/cards';
import { incomeLevel } from './data/market';
import { tileDef } from './data/tiles';
import { LINKS_PER_PLAYER } from './actions/network';
import { currentPid, locName, log, nameOf, tileName } from './helpers';
import type { BBState, EraScore } from './types';

export type Shuffle = <T>(a: T[]) => T[];

export const pids = (G: BBState): string[] => Object.keys(G.players);

/** Действий в ходу: первый раунд эпохи каналов — одно, иначе два. */
export const actionsPerTurn = (G: BBState): number => (G.era === 'canal' && G.round === 1 ? 1 : 2);

const outOfCards = (G: BBState, pid: string): boolean =>
  G.deck.length === 0 && G.players[pid].hand.length === 0;

export function startTurn(G: BBState): void {
  G.actionsLeft = actionsPerTurn(G);
  G.actionsDone = 0;
  G.changes = { seq: G.changes.seq + 1, slots: [], links: [] };
  const pid = currentPid(G);
  log(G, `Ход: ${nameOf(G, pid)}`, pid);
}

/** Можно ли завершить ход: все действия сделаны или карты кончились. */
export function canFinishTurn(G: BBState, pid: string): string | null {
  if (!G.started || G.gameover) return 'Игра не идёт';
  if (currentPid(G) !== pid) return 'Сейчас не ваш ход';
  if (G.actionsLeft > 0 && G.players[pid].hand.length > 0) return 'Сначала сделайте все действия';
  return null;
}

function drawUp(G: BBState, pid: string): void {
  const p = G.players[pid];
  while (p.hand.length < HAND_SIZE && G.deck.length) p.hand.push(G.deck.pop()!);
  p.handCount = p.hand.length;
}

/** Пропустить игроков без карт (только когда колода пуста). */
function skipCardless(G: BBState): void {
  while (G.orderPos < G.order.length && outOfCards(G, G.order[G.orderPos])) {
    log(G, `${nameOf(G, G.order[G.orderPos])} без карт — пропускает ход`, G.order[G.orderPos]);
    G.orderPos++;
  }
}

/** Конец хода текущего игрока: добор, следующий игрок, при необходимости конец раунда/эпохи. */
export function finishTurn(G: BBState, shuffle: Shuffle): void {
  drawUp(G, currentPid(G));
  G.orderPos++;
  skipCardless(G);
  if (G.orderPos >= G.order.length) {
    endRound(G, shuffle);
    if (G.gameover) return;
    skipCardless(G);
  }
  startTurn(G);
}

/** Отрицательный доход: платить, снимать свои плитки за полцены, затем терять ПО. */
function payDebt(G: BBState, pid: string, owed: number): void {
  const p = G.players[pid];
  while (p.money < owed) {
    // Снимаем сначала неперевёрнутые, с меньшими ПО, с большей выручкой.
    const options: { loc: string; slot: number; value: number; key: number[] }[] = [];
    for (const [loc, slots] of Object.entries(G.slots)) {
      slots.forEach((t, slot) => {
        if (!t || t.owner !== pid) return;
        const def = tileDef(t.industry, t.level);
        const value = Math.floor(def.money / 2);
        if (value > 0) options.push({ loc, slot, value, key: [t.flipped ? 1 : 0, def.vp, -value] });
      });
    }
    if (!options.length) break;
    options.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
    const b = options[0];
    const t = G.slots[b.loc][b.slot]!;
    G.slots[b.loc][b.slot] = null;
    p.money += b.value;
    log(G, `${nameOf(G, pid)} не хватает на выплату: продаёт ${tileName(t)} в ${locName(b.loc)} за £${b.value}`, pid);
  }
  const paid = Math.min(p.money, owed);
  p.money -= paid;
  const deficit = owed - paid;
  if (deficit > 0) {
    p.vp = Math.max(0, p.vp - deficit);
    log(G, `${nameOf(G, pid)} теряет ${deficit} ПО из-за долга`, pid);
  }
}

function endRound(G: BBState, shuffle: Shuffle): void {
  const eraEnd = G.deck.length === 0 && pids(G).every((pid) => G.players[pid].hand.length === 0);
  const finalRound = eraEnd && G.era === 'rail';

  const ranked = G.order.map((pid, i) => ({ pid, i, spent: G.players[pid].spent }));
  ranked.sort((a, b) => a.spent - b.spent || a.i - b.i);
  G.order = ranked.map((r) => r.pid);
  log(G, `Конец раунда ${G.round}. Новый порядок: ${ranked.map((r) => `${nameOf(G, r.pid)} (£${r.spent})`).join(', ')}`);
  for (const pid of pids(G)) G.players[pid].spent = 0;

  if (!finalRound) {
    for (const pid of G.order) {
      const p = G.players[pid];
      const lvl = incomeLevel(p.incomeSpace);
      if (lvl > 0) p.money += lvl;
      else if (lvl < 0) payDebt(G, pid, -lvl);
    }
    log(G, `Доход: ${G.order.map((pid) => `${nameOf(G, pid)} ${fmtIncome(incomeLevel(G.players[pid].incomeSpace))}`).join(', ')}`);
  }
  G.round++;
  G.orderPos = 0;
  if (eraEnd) endEra(G, shuffle);
}

export const fmtIncome = (n: number): string => (n >= 0 ? `+£${n}` : `−£${-n}`);

/** Очки за связи и перевёрнутые плитки. */
export function scoreEra(G: BBState): EraScore {
  const rows: EraScore['rows'] = {};
  for (const pid of pids(G)) rows[pid] = { links: 0, tiles: 0 };
  G.links.forEach((owner, i) => {
    if (owner == null) return;
    let vp = 0;
    for (const end of LINKS[i].ends) {
      if (isMerchant(end)) vp += MERCHANT_LINK_VP;
      else for (const t of G.slots[end]) if (t?.flipped) vp += tileDef(t.industry, t.level).linkVp;
    }
    rows[owner].links += vp;
  });
  for (const slots of Object.values(G.slots)) {
    for (const t of slots) if (t?.flipped) rows[t.owner].tiles += tileDef(t.industry, t.level).vp;
  }
  for (const pid of pids(G)) G.players[pid].vp += rows[pid].links + rows[pid].tiles;
  const score: EraScore = { era: G.era, rows };
  G.eraScores.push(score);
  return score;
}

function endEra(G: BBState, shuffle: Shuffle): void {
  const score = scoreEra(G);
  const eraName = G.era === 'canal' ? 'каналов' : 'железных дорог';
  log(G, `Конец эпохи ${eraName}. Очки: ${pids(G).map((pid) => `${nameOf(G, pid)} +${score.rows[pid].links} за связи, +${score.rows[pid].tiles} за плитки`).join('; ')}`);
  if (G.era === 'rail') {
    endGame(G);
    return;
  }
  // Переход к эпохе железных дорог.
  G.links = G.links.map(() => null);
  for (const pid of pids(G)) G.players[pid].linksLeft = LINKS_PER_PLAYER;
  for (const slots of Object.values(G.slots)) {
    slots.forEach((t, i) => { if (t && t.level === 1) slots[i] = null; });
  }
  for (const m of Object.values(G.merchants)) m.beer = m.tiles.map((t) => t !== 'blank');
  G.deck = shuffle([...G.discard]);
  G.discard = [];
  for (const pid of pids(G)) G.players[pid].lastDiscard = null;
  for (const pid of G.order) drawUp(G, pid);
  G.era = 'rail';
  G.round = 1;
  log(G, 'Начинается эпоха железных дорог: связи и плитки I уровня убраны, бочки торговцев пополнены, раздано по 8 карт');
}

export function ranking(G: BBState): string[] {
  const key = (pid: string) => {
    const p = G.players[pid];
    return [p.vp, incomeLevel(p.incomeSpace), p.money];
  };
  return [...pids(G)].sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  });
}

function endGame(G: BBState): void {
  const order = ranking(G);
  const top = G.players[order[0]];
  const same = (pid: string) => {
    const p = G.players[pid];
    return p.vp === top.vp && incomeLevel(p.incomeSpace) === incomeLevel(top.incomeSpace) && p.money === top.money;
  };
  G.gameover = { winners: order.filter(same), ranking: order };
  log(G, `Игра окончена! Победа: ${G.gameover.winners.map((pid) => nameOf(G, pid)).join(', ')}`);
}
