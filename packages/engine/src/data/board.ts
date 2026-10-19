import type { Industry, LocId, MerchantId, NodeId } from '../types';

export interface LocationDef {
  name: string;
  /** Название по-русски для подсказок и журнала. */
  ru: string;
  /** Слоты слева направо; в каждом 1–2 значка отраслей. */
  slots: Industry[][];
  /** Ферма: нет карты локации. */
  farm?: boolean;
}

export const LOCATIONS: Record<LocId, LocationDef> = {
  belper: { name: 'Belper', ru: 'Белпер', slots: [['cotton', 'manufacturer'], ['coal'], ['pottery']] },
  derby: { name: 'Derby', ru: 'Дерби', slots: [['cotton', 'brewery'], ['cotton', 'manufacturer'], ['iron']] },
  leek: { name: 'Leek', ru: 'Лик', slots: [['cotton', 'manufacturer'], ['cotton', 'coal']] },
  'stoke-on-trent': { name: 'Stoke-on-Trent', ru: 'Сток-он-Трент', slots: [['cotton', 'manufacturer'], ['pottery', 'iron'], ['manufacturer']] },
  stone: { name: 'Stone', ru: 'Стоун', slots: [['cotton', 'brewery'], ['manufacturer', 'coal']] },
  uttoxeter: { name: 'Uttoxeter', ru: 'Аттоксетер', slots: [['manufacturer', 'brewery'], ['cotton', 'brewery']] },
  stafford: { name: 'Stafford', ru: 'Стаффорд', slots: [['manufacturer', 'brewery'], ['pottery']] },
  'burton-on-trent': { name: 'Burton-on-Trent', ru: 'Бертон-апон-Трент', slots: [['manufacturer', 'coal'], ['brewery']] },
  cannock: { name: 'Cannock', ru: 'Каннок', slots: [['manufacturer', 'coal'], ['coal']] },
  tamworth: { name: 'Tamworth', ru: 'Тамуэрт', slots: [['cotton', 'coal'], ['cotton', 'coal']] },
  walsall: { name: 'Walsall', ru: 'Уолсолл', slots: [['iron', 'manufacturer'], ['manufacturer', 'brewery']] },
  wolverhampton: { name: 'Wolverhampton', ru: 'Вулвергемптон', slots: [['manufacturer'], ['manufacturer', 'coal']] },
  coalbrookdale: { name: 'Coalbrookdale', ru: 'Коулбрукдейл', slots: [['iron', 'brewery'], ['iron'], ['coal']] },
  dudley: { name: 'Dudley', ru: 'Дадли', slots: [['coal'], ['iron']] },
  kidderminster: { name: 'Kidderminster', ru: 'Киддерминстер', slots: [['cotton', 'coal'], ['cotton']] },
  worcester: { name: 'Worcester', ru: 'Вустер', slots: [['cotton'], ['cotton']] },
  birmingham: { name: 'Birmingham', ru: 'Бирмингем', slots: [['cotton', 'manufacturer'], ['manufacturer'], ['iron'], ['manufacturer']] },
  coventry: { name: 'Coventry', ru: 'Ковентри', slots: [['pottery'], ['manufacturer', 'coal'], ['iron', 'manufacturer']] },
  nuneaton: { name: 'Nuneaton', ru: 'Нанитон', slots: [['manufacturer', 'brewery'], ['cotton', 'coal']] },
  redditch: { name: 'Redditch', ru: 'Реддич', slots: [['manufacturer', 'coal'], ['iron']] },
  'farm-north': { name: 'Farm Brewery', ru: 'Ферма-пивоварня (север)', slots: [['brewery']], farm: true },
  'farm-south': { name: 'Farm Brewery', ru: 'Ферма-пивоварня (юг)', slots: [['brewery']], farm: true },
};

export const LOC_IDS: LocId[] = Object.keys(LOCATIONS);

export interface MerchantDef {
  name: string;
  ru: string;
  places: number;
  bonus: { kind: 'vp' | 'income' | 'money' | 'develop'; amount: number };
  /** Минимальное число игроков, при котором точка участвует. */
  minPlayers: 2 | 3 | 4;
}

export const MERCHANTS: Record<MerchantId, MerchantDef> = {
  shrewsbury: { name: 'Shrewsbury', ru: 'Шрусбери', places: 1, bonus: { kind: 'vp', amount: 4 }, minPlayers: 2 },
  gloucester: { name: 'Gloucester', ru: 'Глостер', places: 2, bonus: { kind: 'develop', amount: 1 }, minPlayers: 2 },
  oxford: { name: 'Oxford', ru: 'Оксфорд', places: 2, bonus: { kind: 'income', amount: 2 }, minPlayers: 2 },
  warrington: { name: 'Warrington', ru: 'Уоррингтон', places: 2, bonus: { kind: 'money', amount: 5 }, minPlayers: 3 },
  nottingham: { name: 'Nottingham', ru: 'Ноттингем', places: 2, bonus: { kind: 'vp', amount: 3 }, minPlayers: 4 },
};

export const MERCHANT_IDS = Object.keys(MERCHANTS) as MerchantId[];
export const isMerchant = (n: NodeId): n is MerchantId => n in MERCHANTS;

/** Значков связи у торговой точки (для очков за связи). */
export const MERCHANT_LINK_VP = 2;

export interface LinkDef {
  /** Все концы связи (у Kidderminster–Worcester ещё и южная ферма). */
  ends: NodeId[];
  canal: boolean;
  rail: boolean;
}

const L = (a: NodeId, b: NodeId, canal: boolean, rail: boolean, extra: NodeId[] = []): LinkDef =>
  ({ ends: [a, b, ...extra], canal, rail });

export const LINKS: LinkDef[] = [
  L('belper', 'derby', true, true),
  L('belper', 'leek', false, true),
  L('birmingham', 'coventry', true, true),
  L('birmingham', 'dudley', true, true),
  L('birmingham', 'nuneaton', false, true),
  L('birmingham', 'oxford', true, true),
  L('birmingham', 'redditch', false, true),
  L('birmingham', 'tamworth', true, true),
  L('birmingham', 'walsall', true, true),
  L('birmingham', 'worcester', true, true),
  L('burton-on-trent', 'cannock', false, true),
  L('burton-on-trent', 'derby', true, true),
  L('burton-on-trent', 'stone', true, true),
  L('burton-on-trent', 'tamworth', true, true),
  L('burton-on-trent', 'walsall', true, false),
  L('cannock', 'stafford', true, true),
  L('cannock', 'farm-north', true, true),
  L('cannock', 'walsall', true, true),
  L('cannock', 'wolverhampton', true, true),
  L('coalbrookdale', 'kidderminster', true, true),
  L('coalbrookdale', 'shrewsbury', true, true),
  L('coalbrookdale', 'wolverhampton', true, true),
  L('coventry', 'nuneaton', false, true),
  L('derby', 'nottingham', true, true),
  L('derby', 'uttoxeter', false, true),
  L('dudley', 'kidderminster', true, true),
  L('dudley', 'wolverhampton', true, true),
  L('gloucester', 'redditch', true, true),
  L('gloucester', 'worcester', true, true),
  L('kidderminster', 'worcester', true, true, ['farm-south']),
  L('leek', 'stoke-on-trent', true, true),
  L('nuneaton', 'tamworth', true, true),
  L('redditch', 'oxford', true, true),
  L('stafford', 'stone', true, true),
  L('stoke-on-trent', 'stone', true, true),
  L('stoke-on-trent', 'warrington', true, true),
  L('stone', 'uttoxeter', false, true),
  L('tamworth', 'walsall', false, true),
  L('walsall', 'wolverhampton', true, true),
];

export function nodeName(n: NodeId): string {
  return isMerchant(n) ? MERCHANTS[n].ru : LOCATIONS[n]?.ru ?? n;
}

export function linkName(i: number): string {
  return LINKS[i].ends.slice(0, 2).map(nodeName).join(' — ');
}
