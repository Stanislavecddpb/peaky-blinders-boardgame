import { describe, expect, it } from 'vitest';
import { doAction } from './action';
import { LINKS } from './data/board';
import { incomeLevel } from './data/market';
import { canFinishTurn, finishTurn } from './round';
import { act, giveTurn, link, newGame, put } from './testkit';
import type { BBState } from './types';

const noShuffle = <T,>(a: T[]) => [...a];

describe('подготовка', () => {
  it('2 игрока', () => {
    const G = newGame(2);
    expect(G.players['0'].hand).toHaveLength(8);
    expect(G.discard).toHaveLength(2);
    expect(G.deck).toHaveLength(40 - 16 - 2);
    expect(G.merchants.shrewsbury.tiles).toHaveLength(1);
    expect(G.merchants.gloucester.tiles).toHaveLength(2);
    expect(G.merchants.oxford.tiles).toHaveLength(2);
    expect(G.merchants.warrington.tiles).toHaveLength(0);
    expect(G.merchants.nottingham.tiles).toHaveLength(0);
    expect(G.coal).toBe(13);
    expect(G.iron).toBe(8);
    expect(G.players['1'].money).toBe(17);
    expect(G.actionsLeft).toBe(1);
  });

  it('4 игрока: все торговцы', () => {
    const G = newGame(4);
    expect(G.deck).toHaveLength(64 - 32 - 4);
    const tiles = Object.values(G.merchants).flatMap((m) => m.tiles);
    expect(tiles).toHaveLength(9);
    expect(tiles.filter((t) => t === 'blank')).toHaveLength(3);
  });
});

describe('строительство', () => {
  it('карта локации: без сети, деньги списываются', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0']);
    const r = act(G, '0', { type: 'build', card: 'loc-birmingham#0', industry: 'cotton', loc: 'birmingham', slot: 0 });
    expect(r.err).toBeNull();
    expect(r.G.players['0'].money).toBe(5);
    expect(r.G.players['0'].spent).toBe(12);
    expect(r.G.slots.birmingham[0]).toMatchObject({ owner: '0', industry: 'cotton', level: 1, flipped: false });
    expect(r.G.players['0'].taken.cotton).toBe(1);
    expect(r.G.players['0'].hand).toHaveLength(0);
    expect(r.G.discard).toContain('loc-birmingham#0');
  });

  it('сначала слот только с этой отраслью', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0']);
    link(G, ['birmingham', 'oxford'], '1');
    expect(act(G, '0', { type: 'build', card: 'loc-birmingham#0', industry: 'manufacturer', loc: 'birmingham', slot: 0 }).err)
      .toMatch(/только с этой отраслью/);
    expect(act(G, '0', { type: 'build', card: 'loc-birmingham#0', industry: 'manufacturer', loc: 'birmingham', slot: 1 }).err).toBeNull();
  });

  it('уголь с рынка — только при связи с торговцем', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0']);
    const a = { type: 'build', card: 'loc-birmingham#0', industry: 'manufacturer', loc: 'birmingham', slot: 1 } as const;
    expect(act(G, '0', a).err).toMatch(/торговц/);
    link(G, ['birmingham', 'oxford'], '1');
    const r = act(G, '0', a);
    expect(r.err).toBeNull();
    expect(r.G.coal).toBe(12);
    expect(r.G.players['0'].money).toBe(17 - 8 - 1);
  });

  it('карта отрасли — только в своей сети (если сеть есть)', () => {
    const G = newGame();
    giveTurn(G, '0', ['ind-coal#0']);
    expect(act(G, '0', { type: 'build', card: 'ind-coal#0', industry: 'coal', loc: 'dudley', slot: 0 }).err).toBeNull();
    put(G, 'birmingham', 0, '0', 'cotton', 1);
    expect(act(G, '0', { type: 'build', card: 'ind-coal#0', industry: 'coal', loc: 'dudley', slot: 0 }).err).toMatch(/сети/);
    link(G, ['birmingham', 'dudley'], '0');
    expect(act(G, '0', { type: 'build', card: 'ind-coal#0', industry: 'coal', loc: 'dudley', slot: 0 }).err).toBeNull();
  });

  it('эпоха каналов: одна своя плитка на город; ж/д — можно больше', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0']);
    put(G, 'birmingham', 0, '0', 'cotton', 1);
    link(G, ['birmingham', 'oxford'], '1');
    const a = { type: 'build', card: 'loc-birmingham#0', industry: 'manufacturer', loc: 'birmingham', slot: 1 } as const;
    expect(act(G, '0', a).err).toMatch(/одной своей/);
    G.era = 'rail';
    G.players['0'].taken.manufacturer = 1;
    expect(act(G, '0', a).err).toBeNull();
  });

  it('уровень I нельзя в эпоху ж/д, гончарню V — только в ж/д', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0', 'loc-coventry#0']);
    G.era = 'rail';
    expect(act(G, '0', { type: 'build', card: 'loc-birmingham#0', industry: 'cotton', loc: 'birmingham', slot: 0 }).err).toMatch(/развейте/);
    G.era = 'canal';
    G.players['0'].taken.pottery = 4;
    G.players['0'].money = 100;
    link(G, ['birmingham', 'coventry'], '1');
    link(G, ['birmingham', 'oxford'], '1');
    expect(act(G, '0', { type: 'build', card: 'loc-coventry#0', industry: 'pottery', loc: 'coventry', slot: 0 }).err).toMatch(/только в эпоху/);
  });

  it('перестройка: своя — да; чужая шахта — только когда угля нигде нет', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-dudley#0']);
    put(G, 'dudley', 0, '0', 'coal', 1, 1);
    G.players['0'].taken.coal = 1;
    let r = act(G, '0', { type: 'build', card: 'loc-dudley#0', industry: 'coal', loc: 'dudley', slot: 0 });
    expect(r.err).toBeNull();
    expect(r.G.slots.dudley[0]).toMatchObject({ level: 2, res: 3 });

    G.slots.dudley[0]!.owner = '1';
    expect(act(G, '0', { type: 'build', card: 'loc-dudley#0', industry: 'coal', loc: 'dudley', slot: 0 }).err).toMatch(/ни на поле, ни на рынке/);
    G.coal = 0;
    G.slots.dudley[0]!.res = 0;
    G.slots.dudley[0]!.flipped = true;
    r = act(G, '0', { type: 'build', card: 'loc-dudley#0', industry: 'coal', loc: 'dudley', slot: 0 });
    expect(r.err).toBeNull();
    expect(r.G.slots.dudley[0]!.owner).toBe('0');
  });

  it('чужую хлопкопрядильню перестроить нельзя', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0']);
    put(G, 'birmingham', 0, '1', 'cotton', 1);
    G.players['0'].taken.cotton = 3;
    expect(act(G, '0', { type: 'build', card: 'loc-birmingham#0', industry: 'cotton', loc: 'birmingham', slot: 0 }).err).toMatch(/Чужие/);
  });

  it('уголь из ближайшей шахты; последний куб переворачивает шахту', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0']);
    put(G, 'dudley', 0, '1', 'coal', 1, 1);
    put(G, 'wolverhampton', 1, '1', 'coal', 2, 3);
    link(G, ['birmingham', 'dudley'], '1');
    link(G, ['dudley', 'wolverhampton'], '1');
    const a = { type: 'build', card: 'loc-birmingham#0', industry: 'manufacturer', loc: 'birmingham', slot: 1 } as const;
    expect(act(G, '0', { ...a, coal: [{ loc: 'wolverhampton', slot: 1, n: 1 }] }).err).toMatch(/ближайших/);
    const r = act(G, '0', a);
    expect(r.err).toBeNull();
    expect(r.G.slots.dudley[0]).toMatchObject({ res: 0, flipped: true });
    expect(r.G.players['1'].incomeSpace).toBe(14);
    expect(r.G.coal).toBe(13);
  });

  it('новая шахта со связью с торговцем продаёт уголь на рынок', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-coalbrookdale#0']);
    G.players['0'].taken.coal = 1;
    const a = { type: 'build', card: 'loc-coalbrookdale#0', industry: 'coal', loc: 'coalbrookdale', slot: 2 } as const;
    let r = act(G, '0', a);
    expect(r.G.slots.coalbrookdale[2]!.res).toBe(3);
    link(G, ['coalbrookdale', 'shrewsbury'], '1');
    r = act(G, '0', a);
    expect(r.err).toBeNull();
    expect(r.G.coal).toBe(14);
    expect(r.G.slots.coalbrookdale[2]!.res).toBe(2);
    expect(r.G.players['0'].money).toBe(17 - 7 + 1);
  });

  it('новый завод всегда продаёт железо', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-dudley#0']);
    put(G, 'dudley', 0, '0', 'coal', 1, 2);
    G.players['0'].taken.coal = 1;
    G.era = 'rail';
    G.players['0'].taken.iron = 1;
    const r = act(G, '0', { type: 'build', card: 'loc-dudley#0', industry: 'iron', loc: 'dudley', slot: 1 });
    expect(r.err).toBeNull();
    expect(r.G.iron).toBe(10);
    expect(r.G.slots.dudley[1]!.res).toBe(2);
    expect(r.G.players['0'].money).toBe(17 - 7 + 2);
    expect(r.G.slots.dudley[0]!.res).toBe(1);
  });

  it('пивоварня: 1 бочка в каналы, 2 в ж/д', () => {
    const G = newGame();
    giveTurn(G, '0', ['ind-brewery#0']);
    const a = { type: 'build', card: 'ind-brewery#0', industry: 'brewery', loc: 'farm-north', slot: 0 } as const;
    expect(act(G, '0', a).G.slots['farm-north'][0]!.res).toBe(1);
    G.era = 'rail';
    G.players['0'].taken.brewery = 2;
    expect(act(G, '0', a).G.slots['farm-north'][0]!.res).toBe(2);
  });

  it('не хватает денег', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-birmingham#0']);
    G.players['0'].money = 11;
    expect(act(G, '0', { type: 'build', card: 'loc-birmingham#0', industry: 'cotton', loc: 'birmingham', slot: 0 }).err).toMatch(/денег/);
  });
});

describe('сеть', () => {
  it('канал £3, примыкает к сети', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-leek#0']);
    const bc = LINKS.findIndex((l) => l.ends.includes('birmingham') && l.ends.includes('coventry'));
    const ls = LINKS.findIndex((l) => l.ends.includes('leek') && l.ends.includes('stoke-on-trent'));
    expect(act(G, '0', { type: 'network', card: 'loc-leek#0', links: [ls] }).err).toBeNull();
    put(G, 'birmingham', 0, '0', 'cotton', 1);
    expect(act(G, '0', { type: 'network', card: 'loc-leek#0', links: [ls] }).err).toMatch(/сети/);
    const r = act(G, '0', { type: 'network', card: 'loc-leek#0', links: [bc] });
    expect(r.err).toBeNull();
    expect(r.G.players['0'].money).toBe(14);
    expect(r.G.players['0'].linksLeft).toBe(13);
  });

  it('в каналы нельзя строить там, где только ж/д', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-leek#0']);
    const bn = LINKS.findIndex((l) => l.ends.includes('birmingham') && l.ends.includes('nuneaton'));
    expect(act(G, '0', { type: 'network', card: 'loc-leek#0', links: [bn] }).err).toMatch(/нет канала/);
  });

  it('две железные дороги: £15, 2 угля, 1 пиво', () => {
    const G = newGame();
    G.era = 'rail';
    giveTurn(G, '0', ['loc-leek#0']);
    put(G, 'birmingham', 1, '0', 'manufacturer', 2);
    put(G, 'coventry', 1, '0', 'coal', 2, 3);
    put(G, 'farm-north', 0, '0', 'brewery', 2, 1);
    const bc = LINKS.findIndex((l) => l.ends.includes('birmingham') && l.ends.includes('coventry'));
    const cn = LINKS.findIndex((l) => l.ends.includes('coventry') && l.ends.includes('nuneaton'));
    const r = act(G, '0', { type: 'network', card: 'loc-leek#0', links: [bc, cn] });
    expect(r.err).toBeNull();
    expect(r.G.players['0'].money).toBe(2);
    expect(r.G.slots.coventry[1]!.res).toBe(1);
    expect(r.G.slots['farm-north'][0]).toMatchObject({ res: 0, flipped: true });
    // без пива — нельзя
    G.slots['farm-north'][0] = null;
    expect(act(G, '0', { type: 'network', card: 'loc-leek#0', links: [bc, cn] }).err).toMatch(/пива/);
  });
});

describe('развитие, заём, разведка, пропуск', () => {
  it('развитие: железо с рынка; гончарню с лампочкой нельзя', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-leek#0']);
    expect(act(G, '0', { type: 'develop', card: 'loc-leek#0', industries: ['pottery'] }).err).toMatch(/лампочка/);
    const r = act(G, '0', { type: 'develop', card: 'loc-leek#0', industries: ['coal', 'coal'] });
    expect(r.err).toBeNull();
    expect(r.G.players['0'].taken.coal).toBe(2);
    expect(r.G.iron).toBe(6);
    expect(r.G.players['0'].money).toBe(17 - 4);
  });

  it('заём', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-leek#0']);
    const r = act(G, '0', { type: 'loan', card: 'loc-leek#0' });
    expect(r.G.players['0'].money).toBe(47);
    expect(incomeLevel(r.G.players['0'].incomeSpace)).toBe(-3);
    expect(r.G.players['0'].spent).toBe(0);
    G.players['0'].incomeSpace = 2;
    expect(act(G, '0', { type: 'loan', card: 'loc-leek#0' }).err).toMatch(/−10/);
  });

  it('разведка и джокер локации', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-leek#0', 'loc-leek#1', 'ind-iron#0', 'ind-coal#0']);
    const r = act(G, '0', { type: 'scout', cards: ['loc-leek#0', 'loc-leek#1', 'ind-iron#0'] });
    expect(r.err).toBeNull();
    expect(r.G.players['0'].hand).toEqual(['ind-coal#0', 'wild-location#0', 'wild-industry#0']);
    expect(r.G.wild).toEqual({ location: 3, industry: 3 });
    expect(act(r.G, '0', { type: 'scout', cards: ['ind-coal#0', 'wild-location#0', 'wild-industry#0'] }).err).toMatch(/джокер/);
    const b = act(r.G, '0', { type: 'build', card: 'wild-location#0', industry: 'coal', loc: 'cannock', slot: 1 });
    expect(b.err).toBeNull();
    expect(b.G.wild.location).toBe(4);
    expect(b.G.discard).not.toContain('wild-location#0');
  });

  it('число действий в ходу', () => {
    const G = newGame();
    const pid = G.order[0];
    G.players[pid].hand = ['loc-leek#0', 'loc-leek#1'];
    expect(doAction(G, pid, { type: 'pass', card: 'loc-leek#0' })).toBeNull();
    expect(doAction(G, pid, { type: 'pass', card: 'loc-leek#1' })).toMatch(/закончились/);
    expect(canFinishTurn(G, pid)).toBeNull();
  });
});

describe('продажа', () => {
  function sellSetup(): BBState {
    const G = newGame();
    giveTurn(G, '0', ['loc-leek#0']);
    put(G, 'birmingham', 0, '0', 'cotton', 1);
    link(G, ['birmingham', 'oxford'], '0');
    G.merchants.oxford = { tiles: ['cotton', 'any'], beer: [true, true] };
    return G;
  }

  it('пиво торговца даёт бонус', () => {
    const G = sellSetup();
    const r = act(G, '0', { type: 'sell', card: 'loc-leek#0', sales: [{ loc: 'birmingham', slot: 0, merchant: 'oxford' }] });
    expect(r.err).toBeNull();
    expect(r.G.slots.birmingham[0]!.flipped).toBe(true);
    expect(r.G.players['0'].incomeSpace).toBe(10 + 5 + 2);
    expect(r.G.merchants.oxford.beer.filter(Boolean)).toHaveLength(1);
  });

  it('торговец должен принимать отрасль', () => {
    const G = sellSetup();
    G.merchants.oxford = { tiles: ['pottery', 'blank'], beer: [true, false] };
    expect(act(G, '0', { type: 'sell', card: 'loc-leek#0', sales: [{ loc: 'birmingham', slot: 0, merchant: 'oxford' }] }).err).toMatch(/не покупает/);
  });

  it('нет пива — нельзя', () => {
    const G = sellSetup();
    G.merchants.oxford.beer = [false, false];
    expect(act(G, '0', { type: 'sell', card: 'loc-leek#0', sales: [{ loc: 'birmingham', slot: 0, merchant: 'oxford' }] }).err).toMatch(/пива/);
    put(G, 'walsall', 1, '1', 'brewery', 1, 1);
    expect(act(G, '0', { type: 'sell', card: 'loc-leek#0', sales: [{ loc: 'birmingham', slot: 0, merchant: 'oxford' }] }).err).toMatch(/пива/);
    link(G, ['birmingham', 'walsall'], '1');
    expect(act(G, '0', { type: 'sell', card: 'loc-leek#0', sales: [{ loc: 'birmingham', slot: 0, merchant: 'oxford' }] }).err).toBeNull();
  });

  it('Глостер: бесплатное развитие', () => {
    const G = newGame();
    giveTurn(G, '0', ['loc-leek#0']);
    put(G, 'redditch', 0, '0', 'manufacturer', 1);
    link(G, ['redditch', 'gloucester'], '0');
    G.merchants.gloucester = { tiles: ['manufacturer', 'blank'], beer: [true, false] };
    const r = act(G, '0', { type: 'sell', card: 'loc-leek#0', sales: [{ loc: 'redditch', slot: 0, merchant: 'gloucester' }], bonusDevelop: ['coal'] });
    expect(r.err).toBeNull();
    expect(r.G.players['0'].taken.coal).toBe(1);
  });
});

describe('раунды и эпохи', () => {
  it('порядок по тратам и доход', () => {
    const G = newGame();
    const [a, b] = G.order;
    G.players[a].spent = 10;
    G.players[b].spent = 3;
    G.players[a].incomeSpace = 14; // уровень 2
    G.orderPos = 1;
    G.actionsLeft = 0;
    finishTurn(G, noShuffle);
    expect(G.order).toEqual([b, a]);
    expect(G.players[a].money).toBe(19);
    expect(G.players[a].spent).toBe(0);
    expect(G.round).toBe(2);
    expect(G.actionsLeft).toBe(2);
  });

  it('долг: продаёт плитки, затем теряет ПО', () => {
    const G = newGame();
    const [a] = G.order;
    G.players[a].money = 0;
    G.players[a].vp = 5;
    G.players[a].incomeSpace = 3; // −7
    put(G, 'birmingham', 0, a, 'cotton', 1); // за полцены £6
    G.orderPos = 1;
    finishTurn(G, noShuffle);
    expect(G.slots.birmingham[0]).toBeNull();
    expect(G.players[a].money).toBe(0);
    expect(G.players[a].vp).toBe(4);
  });

  function eraEndState(): BBState {
    const G = newGame();
    for (const pid of Object.keys(G.players)) G.players[pid].hand = [];
    G.discard.push(...G.deck);
    G.deck = [];
    G.orderPos = 1;
    put(G, 'birmingham', 0, '0', 'cotton', 1, 0, true);
    put(G, 'coventry', 1, '1', 'coal', 2, 2);
    link(G, ['birmingham', 'oxford'], '0');
    return G;
  }

  it('конец эпохи каналов', () => {
    const G = eraEndState();
    const vp0 = G.players['0'].vp;
    finishTurn(G, noShuffle);
    expect(G.era).toBe('rail');
    expect(G.eraScores[0].rows['0']).toEqual({ links: 3, tiles: 5 });
    expect(G.players['0'].vp).toBe(vp0 + 8);
    expect(G.slots.birmingham[0]).toBeNull();
    expect(G.slots.coventry[1]).not.toBeNull();
    expect(G.links.every((l) => l == null)).toBe(true);
    expect(G.players['0'].hand).toHaveLength(8);
    expect(G.players['1'].hand).toHaveLength(8);
    expect(G.deck).toHaveLength(40 - 16 - 16); // руки в тесте обнулены
    expect(G.round).toBe(1);
    expect(G.actionsLeft).toBe(2);
  });

  it('конец игры', () => {
    const G = eraEndState();
    G.era = 'rail';
    G.players['1'].incomeSpace = 30;
    finishTurn(G, noShuffle);
    expect(G.gameover).not.toBeNull();
    expect(G.gameover!.winners).toEqual(['0']);
    expect(G.players['1'].money).toBe(17); // в последнем раунде дохода нет
  });
});
