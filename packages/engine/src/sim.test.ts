import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { doAction } from './action';
import { buildDeck, isWild } from './data/cards';
import { BrassGame } from './game';
import { currentPid } from './helpers';
import { enumerateActions } from './options';
import { finishTurn } from './round';
import { applySetColor, applySetName, applyStart, setupGame } from './setup';
import { COLORS, type BBState } from './types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function shuffleWith(r: () => number) {
  return <T,>(a: T[]): T[] => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
}

function checkInvariants(G: BBState, n: number) {
  expect(G.coal).toBeGreaterThanOrEqual(0);
  expect(G.coal).toBeLessThanOrEqual(14);
  expect(G.iron).toBeGreaterThanOrEqual(0);
  expect(G.iron).toBeLessThanOrEqual(10);
  let cards = G.deck.length + G.discard.length;
  for (const p of Object.values(G.players)) {
    expect(p.money).toBeGreaterThanOrEqual(0);
    expect(p.linksLeft).toBeGreaterThanOrEqual(0);
    expect(p.hand.length).toBeLessThanOrEqual(8);
    cards += p.hand.filter((c) => !isWild(c)).length;
  }
  expect(cards).toBe(buildDeck(n).length);
  for (const slots of Object.values(G.slots)) for (const t of slots) {
    if (t && (t.industry === 'coal' || t.industry === 'iron' || t.industry === 'brewery')) {
      expect(t.flipped).toBe(t.res === 0);
    }
  }
}

/** Случайная партия напрямую через движок; предпочитаем «полезные» действия, чтобы игра была содержательной. */
function playRandom(n: number, seed: number): BBState {
  const r = rng(seed);
  const shuffle = shuffleWith(r);
  const G = setupGame(n, shuffle);
  for (let i = 0; i < n; i++) {
    applySetName(G, String(i), `P${i}`);
    applySetColor(G, String(i), String(i), COLORS[i]);
  }
  applyStart(G, '0');
  let turns = 0;
  while (!G.gameover) {
    const pid = currentPid(G);
    while (G.actionsLeft > 0 && G.players[pid].hand.length > 0) {
      const all = enumerateActions(G, pid);
      const sells = all.filter((a) => a.type === 'sell');
      const good = all.filter((a) => a.type === 'build' || a.type === 'network' || (a.type === 'loan' && G.players[pid].money < 8));
      const pool = sells.length && r() < 0.7 ? sells : good.length && r() < 0.9 ? good : all;
      const a = pool[Math.floor(r() * pool.length)];
      const err = doAction(G, pid, a);
      expect(err, JSON.stringify(a)).toBeNull();
    }
    finishTurn(G, shuffle);
    checkInvariants(G, n);
    turns++;
    expect(turns).toBeLessThan(200);
  }
  return G;
}

describe('случайные партии', () => {
  for (const n of [2, 3, 4]) {
    it(`${n} игрока — партии доходят до конца`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const G = playRandom(n, seed * 97 + n);
        expect(G.gameover!.ranking).toHaveLength(n);
        expect(G.eraScores).toHaveLength(2);
        const vp = Object.values(G.players).reduce((a, p) => a + p.vp, 0);
        expect(vp).toBeGreaterThan(0);
      }
    }, 120_000);
  }
});

describe('boardgame.io', () => {
  it('лобби, ходы, отмена, порядок ходов', () => {
    const spec = { game: BrassGame, numPlayers: 2, multiplayer: Local() };
    const c0 = Client({ ...spec, playerID: '0' });
    const c1 = Client({ ...spec, playerID: '1' });
    c0.start();
    c1.start();
    c0.moves.setName('Аня');
    c1.moves.setName('Боря');
    c0.moves.setColor('orange');
    c1.moves.setColor('purple');
    c0.moves.startGame();
    let s = c0.getState()!;
    expect(s.ctx.phase).toBe('play');
    const first = s.G.order[0];
    expect(s.ctx.currentPlayer).toBe(first);
    const cf = first === '0' ? c0 : c1;
    const other = first === '0' ? c1 : c0;
    // Чужие карты не видны.
    expect(other.getState()!.G.players[first].hand).toEqual([]);
    expect(other.getState()!.G.deck).toEqual([]);

    const card = cf.getState()!.G.players[first].hand[0];
    cf.moves.act({ type: 'loan', card });
    expect(cf.getState()!.G.players[first].money).toBe(47);
    cf.undo();
    expect(cf.getState()!.G.players[first].money).toBe(17);
    cf.moves.act({ type: 'loan', card });
    cf.moves.finishTurn();
    s = c0.getState()!;
    const second = s.G.order[1];
    expect(s.ctx.currentPlayer).toBe(second);
    expect(s.G.players[first].handCount).toBe(8);
    const cs = second === '0' ? c0 : c1;
    cs.moves.act({ type: 'pass', card: cs.getState()!.G.players[second].hand[0] });
    cs.moves.finishTurn();
    s = c0.getState()!;
    // Раунд 2: первым ходит потративший меньше — оба потратили £0, порядок прежний.
    expect(s.G.round).toBe(2);
    expect(s.ctx.currentPlayer).toBe(first);
    expect(s.G.actionsLeft).toBe(2);
  });
});
