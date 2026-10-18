import { LINKS, LOCATIONS, MERCHANTS, MERCHANT_IDS } from './data/board';
import { buildDeck, HAND_SIZE, WILD_COUNT } from './data/cards';
import { COAL_START, INCOME_START, IRON_START } from './data/market';
import { LINKS_PER_PLAYER } from './actions/network';
import { COLOR_RU, log, nameOf } from './helpers';
import { startTurn, type Shuffle } from './round';
import { COLORS, type BBState, type Color, type MerchantId, type MerchantState, type MerchantTile, type PlayerState } from './types';

export const START_MONEY = 17;

/** Плитки торговцев по числу игроков. */
export function merchantPool(numPlayers: number): MerchantTile[] {
  const pool: MerchantTile[] = ['any', 'cotton', 'manufacturer', 'blank', 'blank'];
  if (numPlayers >= 3) pool.push('pottery', 'blank');
  if (numPlayers >= 4) pool.push('cotton', 'manufacturer');
  return pool;
}

function newPlayer(): PlayerState {
  return {
    name: '', color: null, hand: [], handCount: 0, money: START_MONEY, incomeSpace: INCOME_START, vp: 0, spent: 0,
    taken: { cotton: 0, manufacturer: 0, pottery: 0, coal: 0, iron: 0, brewery: 0 },
    linksLeft: LINKS_PER_PLAYER, lastDiscard: null,
  };
}

export function setupGame(numPlayers: number, shuffle: Shuffle): BBState {
  const ids = Array.from({ length: numPlayers }, (_, i) => String(i));
  const players: Record<string, PlayerState> = {};
  for (const pid of ids) players[pid] = newPlayer();

  // Колода: по одной закрытой карте в сброс каждому, затем по 8 в руку.
  const deck = shuffle(buildDeck(numPlayers));
  const discard: string[] = [];
  for (const _ of ids) discard.push(deck.pop()!);
  for (const pid of ids) {
    players[pid].hand = deck.splice(deck.length - HAND_SIZE, HAND_SIZE);
    players[pid].handCount = HAND_SIZE;
  }

  const tiles = shuffle(merchantPool(numPlayers));
  const merchants = {} as Record<MerchantId, MerchantState>;
  for (const m of MERCHANT_IDS) {
    const placed = MERCHANTS[m].minPlayers <= numPlayers ? tiles.splice(0, MERCHANTS[m].places) : [];
    merchants[m] = { tiles: placed, beer: placed.map((t) => t !== 'blank') };
  }

  const slots: BBState['slots'] = {};
  for (const [id, def] of Object.entries(LOCATIONS)) slots[id] = def.slots.map(() => null);

  return {
    started: false,
    players,
    era: 'canal',
    round: 1,
    order: shuffle(ids),
    orderPos: 0,
    actionsLeft: 0,
    actionsDone: 0,
    slots,
    links: LINKS.map(() => null),
    merchants,
    coal: COAL_START,
    iron: IRON_START,
    deck,
    discard,
    wild: { location: WILD_COUNT, industry: WILD_COUNT },
    log: [],
    eraScores: [],
    changes: { seq: 0, slots: [], links: [] },
    lastRes: [],
    gameover: null,
  };
}

export function applySetName(G: BBState, actor: string, pid: string, name: string): string | null {
  if (G.started) return 'Игра уже началась';
  if (actor !== pid && actor !== '0') return 'Имя меняет сам игрок или хост';
  const n = name.trim().slice(0, 20);
  if (!n || !G.players[pid]) return 'Пустое имя';
  G.players[pid].name = n;
  return null;
}

export function applySetColor(G: BBState, actor: string, pid: string, color: Color): string | null {
  if (G.started) return 'Игра уже началась';
  if (!G.players[pid] || !COLORS.includes(color)) return 'Нет такого цвета';
  if (actor !== pid && actor !== '0') return 'Цвет выбирает сам игрок или хост';
  if (Object.entries(G.players).some(([o, p]) => o !== pid && p.color === color)) return 'Цвет занят';
  G.players[pid].color = color;
  return null;
}

/** Хост начинает игру: у всех должен быть цвет. */
export function applyStart(G: BBState, actor: string): string | null {
  if (G.started) return 'Игра уже началась';
  if (actor !== '0') return 'Начинает хост';
  if (Object.values(G.players).some((p) => !p.color)) return 'Не все выбрали цвет';
  G.started = true;
  log(G, 'Игра началась. Эпоха каналов');
  log(G, `Порядок первого раунда (жребий): ${G.order.map((pid) => `${nameOf(G, pid)} (${COLOR_RU[G.players[pid].color!]})`).join(', ')}`);
  startTurn(G);
  return null;
}
