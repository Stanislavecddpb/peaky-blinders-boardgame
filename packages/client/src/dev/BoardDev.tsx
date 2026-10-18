import { useMemo } from 'react';
import {
  COLORS, LINKS, LOCATIONS, applySetColor, applySetName, applyStart, currentPid, doAction, enumerateActions, finishTurn, setupGame,
  slotKey, type BBState,
} from '@bb/engine';
import { Board } from '../table/Board';

/** Случайная позиция: n ходов случайными (жадными к стройке) действиями. */
function randomState(players: number, turns: number, seed: number): BBState {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const shuffle = <T,>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const G = setupGame(players, shuffle);
  for (let i = 0; i < players; i++) {
    applySetName(G, String(i), String(i), `Игрок ${i + 1}`);
    applySetColor(G, String(i), String(i), COLORS[i]);
  }
  applyStart(G, '0');
  for (let t = 0; t < turns && !G.gameover; t++) {
    const pid = currentPid(G);
    while (G.actionsLeft > 0 && G.players[pid].hand.length) {
      const all = enumerateActions(G, pid);
      const sells = all.filter((a) => a.type === 'sell');
      const good = all.filter((a) => a.type === 'build' || a.type === 'network');
      const pool = sells.length && r() < 0.7 ? sells : good.length && r() < 0.9 ? good : all;
      doAction(G, pid, pool[Math.floor(r() * pool.length)]);
    }
    finishTurn(G, shuffle);
  }
  return G;
}

/** #/dev/board?turns=20&players=4&hl=1 — проверка разметки поля. */
export function BoardDev() {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const turns = Number(q.get('turns') ?? 20);
  const players = Number(q.get('players') ?? 4);
  const seed = Number(q.get('seed') ?? 7);
  const G = useMemo(() => randomState(players, turns, seed), [players, turns, seed]);
  const all = q.get('hl') === '1';
  const hl = all
    ? {
        slots: new Set(Object.entries(LOCATIONS).flatMap(([loc, d]) => d.slots.map((_, i) => slotKey(loc, i)))),
        links: new Set(LINKS.map((_, i) => i).filter((i) => G.links[i] == null)),
      }
    : {};
  return (
    <div className="dev-board" style={{ height: '100vh', display: 'flex' }}>
      <Board G={G} hl={hl} />
    </div>
  );
}
