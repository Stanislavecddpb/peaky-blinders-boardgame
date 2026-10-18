import type { BBState } from './types';

/** Что видит игрок: свои карты; у остальных — только число карт; колода и закрытый сброс скрыты. */
export function playerView({ G, playerID }: { G: BBState; playerID?: string | null }): BBState {
  const players: BBState['players'] = {};
  for (const [pid, p] of Object.entries(G.players)) {
    players[pid] = pid === playerID ? p : { ...p, hand: [], handCount: p.hand.length };
  }
  return { ...G, players, deck: [], deckSize: G.deck.length, discard: [] };
}

export const deckSize = (G: BBState): number => G.deckSize ?? G.deck.length;
