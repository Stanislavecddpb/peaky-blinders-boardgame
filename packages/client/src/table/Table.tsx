import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { currentPid, deckSize, nextBuyPrice, type BBState } from '@bb/engine';
import { Board } from './Board';
import { Hand } from './Hand';
import { Lobby } from './Lobby';
import { Log } from './Log';
import { Mat } from './Mat';
import { EraModal, GameOver, Handoff } from './Modals';
import { Players } from './Players';
import { Rules } from './Rules';
import { useWizard } from './Wizard';

/** В хотсите — переключить «сиденье» клиента на игрока. */
export const SeatContext = createContext<((pid: string) => void) | null>(null);

interface MatchPlayer { id: number; name?: string }

const TITLE = 'Brass: Birmingham';

function beep(): void {
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.35);
  } catch { /* без звука */ }
}

function useYourTurnSignal(need: boolean): void {
  const was = useRef(false);
  useEffect(() => {
    document.title = need ? `● Ваш ход — ${TITLE}` : TITLE;
    if (need && !was.current && !document.hasFocus()) beep();
    was.current = need;
  }, [need]);
  useEffect(() => () => { document.title = TITLE; }, []);
}

export function NetBoard(p: BoardProps<BBState>) {
  const need = !!p.playerID && p.ctx.phase === 'play' && !p.ctx.gameover && p.ctx.currentPlayer === p.playerID;
  useYourTurnSignal(need);
  return <Table G={p.G} ctx={p.ctx} moves={p.moves} undo={p.undo} me={p.playerID} matchData={p.matchData as MatchPlayer[] | undefined} />;
}

export function HotseatBoard(p: BoardProps<BBState>) {
  const setSeat = useContext(SeatContext);
  const { G, ctx } = p;
  const seat = p.playerID ?? '0';
  const desired = ctx.phase === 'lobby' ? '0' : ctx.currentPlayer;
  const handoff = ctx.phase !== 'lobby' && !ctx.gameover && desired !== seat;
  const name = G.players[desired]?.name || `Игрок ${Number(desired) + 1}`;
  return (
    <>
      <Table G={G} ctx={ctx} moves={p.moves} undo={p.undo} me={seat} hotseat hideHand={handoff} />
      {handoff && setSeat && <Handoff name={name} color={G.players[desired]?.color ?? undefined} onReady={() => setSeat(desired)} />}
    </>
  );
}

export interface TableProps {
  G: BBState; ctx: any; moves: any; undo: () => void; me: string | null; matchData?: MatchPlayer[];
  hotseat?: boolean; hideHand?: boolean;
}

export function Table({ G, ctx, moves, undo, me, matchData, hotseat, hideHand }: TableProps) {
  const [matFor, setMatFor] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMatFor(null); setRulesOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const nameOf = (pid: string) =>
    matchData?.find((m) => String(m.id) === pid)?.name || G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;

  // Сетевая игра: имя из лобби boardgame.io попадает в состояние игры.
  useEffect(() => {
    if (ctx.phase !== 'lobby' || !me || !matchData) return;
    const n = matchData.find((m) => String(m.id) === me)?.name;
    if (n && G.players[me]?.name !== n) moves.setName(n);
  }, [ctx.phase, me, matchData, G.players, moves]);

  const myTurn = ctx.phase === 'play' && !ctx.gameover && !!me && ctx.currentPlayer === me && !hideHand;
  const wiz = useWizard({ G, me, moves, undo, active: myTurn, turnKey: `${ctx.turn}` });

  if (ctx.phase === 'lobby') {
    const joined = matchData ? (pid: string) => !!matchData.find((m) => String(m.id) === pid)?.name : undefined;
    return <Lobby G={G} me={me} moves={moves} nameOf={nameOf} joined={joined} hotseat={hotseat} />;
  }

  const mine = me ? G.players[me] : null;
  const cur = G.started ? currentPid(G) : null;
  const showMat = wiz.matPick && me ? me : matFor;
  const eraRu = G.era === 'canal' ? 'Эпоха каналов' : 'Эпоха железных дорог';

  return (
    <div className="table">
      <div className="table-main">
        <Board G={G} hl={wiz.hl} onSlot={wiz.onSlot} onLink={wiz.onLink} />
        {showMat && !rulesOpen && (
          <Mat G={G} pid={showMat} pick={showMat === me ? wiz.matPick : undefined}
            onClose={() => setMatFor(null)} />
        )}
        {rulesOpen && <Rules onClose={() => setRulesOpen(false)} />}
        {mine && (
          <div className="hand-bar">
            <div className="hand-side">
              <button className={`btn small ${rulesOpen ? '' : 'ghost'}`} onClick={() => setRulesOpen(!rulesOpen)}>📜 Правила</button>
              <button className={`btn small ${showMat === me && !rulesOpen ? '' : 'ghost'}`}
                onClick={() => { setRulesOpen(false); setMatFor(matFor === me ? null : me); }}>🏭 Мой планшет</button>
              <div className="hint">Карт: {mine.hand.length}</div>
            </div>
            <Hand cards={mine.hand} select={wiz.hand} hidden={hideHand} />
          </div>
        )}
      </div>
      <aside className="table-side">
        <div className="status">
          <div className="status-row"><b>{eraRu}</b><span>раунд {G.round}</span><span title="Карт в колоде">🂠 {deckSize(G)}</span></div>
          <div className="status-row market" title="Кубов на рынке и цена следующего куба">
            <span><i className="cube-ico coal" /> уголь {G.coal}/14 · £{nextBuyPrice('coal', G.coal)}</span>
            <span><i className="cube-ico iron" /> железо {G.iron}/10 · £{nextBuyPrice('iron', G.iron)}</span>
          </div>
          {cur && !G.gameover && (
            <div className={`now ${cur === me ? 'mine' : ''}`}>
              {cur === me ? 'Ваш ход' : `Ходит ${nameOf(cur)}…`} · действий осталось {G.actionsLeft}
            </div>
          )}
        </div>
        {wiz.panel}
        <Players G={G} me={me} onMat={(pid) => { setRulesOpen(false); setMatFor(matFor === pid ? null : pid); }} />
        <Log G={G} />
      </aside>
      <EraModal G={G} nameOf={nameOf} />
      <GameOver G={G} nameOf={nameOf} />
    </div>
  );
}
