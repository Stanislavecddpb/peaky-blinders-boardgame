import { faceOf, type Color, type Industry, type MerchantTile } from '@bb/engine';

export const BOARD = '/board.webp';
export const BEER = '/ui/beer.webp';
export const CARD_BACK = '/cards/back.webp';

export const cardImg = (id: string): string => `/cards/${faceOf(id)}.webp`;
export const tileImg = (industry: Industry, level: number, color: Color, flipped = false): string =>
  `/tiles/${industry}-${level}-${color}${flipped ? '-back' : ''}.webp`;
export const merchantImg = (t: MerchantTile): string => `/merchants/${t}.webp`;
export const avatarImg = (c: Color): string => `/players/${c}.webp`;

export const COLOR_HEX: Record<Color, string> = {
  orange: '#d9772b',
  purple: '#9a68c4',
  teal: '#c9d1da',
  yellow: '#e0b83c',
};

export const COLOR_NAME: Record<Color, string> = {
  orange: 'Оранжевый',
  purple: 'Фиолетовый',
  teal: 'Серебряный',
  yellow: 'Жёлтый',
};

export const INDUSTRY_ICON: Record<Industry, string> = {
  cotton: '🧶',
  manufacturer: '📦',
  pottery: '🏺',
  coal: '⬛',
  iron: '🟧',
  brewery: '🍺',
};
