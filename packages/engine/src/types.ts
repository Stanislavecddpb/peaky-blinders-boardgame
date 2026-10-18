export type Industry = 'cotton' | 'manufacturer' | 'pottery' | 'coal' | 'iron' | 'brewery';
export const INDUSTRIES: Industry[] = ['cotton', 'manufacturer', 'pottery', 'coal', 'iron', 'brewery'];

export type Era = 'canal' | 'rail';
export type LocId = string;
export type MerchantId = 'shrewsbury' | 'gloucester' | 'oxford' | 'warrington' | 'nottingham';
/** Узел сети: город, ферма или торговая точка. */
export type NodeId = LocId | MerchantId;
export type MerchantTile = 'any' | 'cotton' | 'manufacturer' | 'pottery' | 'blank';

export type Color = 'orange' | 'purple' | 'teal' | 'yellow';
export const COLORS: Color[] = ['orange', 'purple', 'teal', 'yellow'];

export interface PlacedTile {
  owner: string;
  industry: Industry;
  level: number;
  flipped: boolean;
  /** Кубы угля/железа или бочки пива на плитке. */
  res: number;
}

export interface PlayerState {
  name: string;
  color: Color | null;
  /** id карт; в playerView у чужих — пусто (см. handCount). */
  hand: string[];
  handCount: number;
  money: number;
  /** Клетка шкалы дохода 0..99 (10 = доход 0). */
  incomeSpace: number;
  vp: number;
  /** Потрачено в этом раунде (для порядка ходов). */
  spent: number;
  /** Сколько плиток каждой отрасли уже снято с планшета (построено или развито). */
  taken: Record<Industry, number>;
  linksLeft: number;
  /** Верхняя открытая карта сброса игрока. */
  lastDiscard: string | null;
}

export interface MerchantState {
  tiles: MerchantTile[];
  /** Бочка у каждой плитки. */
  beer: boolean[];
}

export interface LogEntry {
  /** Сквозной номер записи. */
  n: number;
  text: string;
  pid?: string;
}

export interface EraScore {
  era: Era;
  /** По игрокам: ПО за связи и за плитки. */
  rows: Record<string, { links: number; tiles: number }>;
}

export interface GameOver {
  winners: string[];
  ranking: string[];
}

/** Что изменилось последним действием — для подсветки на поле. */
export interface Changes {
  seq: number;
  slots: string[];
  links: number[];
}

export interface BBState {
  started: boolean;
  players: Record<string, PlayerState>;
  era: Era;
  round: number;
  /** Порядок ходов в раунде (playerID). */
  order: string[];
  orderPos: number;
  /** Сколько действий осталось текущему игроку. */
  actionsLeft: number;
  /** Сколько действий уже сделано в этом ходу. */
  actionsDone: number;
  slots: Record<LocId, (PlacedTile | null)[]>;
  /** Владелец связи по индексу LINKS, null — не построена. */
  links: (string | null)[];
  merchants: Record<MerchantId, MerchantState>;
  /** Кубов на рынке угля (0..14) и железа (0..10). */
  coal: number;
  iron: number;
  deck: string[];
  /** В playerView колода скрыта: тогда здесь её размер. */
  deckSize?: number;
  discard: string[];
  wild: { location: number; industry: number };
  log: LogEntry[];
  eraScores: EraScore[];
  changes: Changes;
  /** Служебное: описание расхода ресурсов текущего действия (для журнала). */
  lastRes: string[];
  gameover: GameOver | null;
}

/** Явный источник угля/железа: плитка и число кубов. */
export interface ResPick {
  loc: LocId;
  slot: number;
  n: number;
}

/** Источник одной бочки пива. */
export type BeerPick =
  | { kind: 'brewery'; loc: LocId; slot: number }
  | { kind: 'merchant'; merchant: MerchantId; idx: number };

export interface Sale {
  loc: LocId;
  slot: number;
  merchant: MerchantId;
  beer?: BeerPick[];
}

export type Action =
  | { type: 'build'; card: string; industry: Industry; loc: LocId; slot: number; coal?: ResPick[]; iron?: ResPick[] }
  | { type: 'network'; card: string; links: number[]; coal?: ResPick[][]; beer?: BeerPick }
  | { type: 'develop'; card: string; industries: Industry[]; iron?: ResPick[] }
  | { type: 'sell'; card: string; sales: Sale[]; bonusDevelop?: Industry[] }
  | { type: 'loan'; card: string }
  | { type: 'scout'; cards: string[] }
  | { type: 'pass'; card: string };

export type ActionType = Action['type'];
