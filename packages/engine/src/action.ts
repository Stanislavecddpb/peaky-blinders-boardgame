import { doBuild } from './actions/build';
import { doNetwork } from './actions/network';
import { doDevelop, doLoan, doPass, doScout, doSell } from './actions/other';
import { currentPid } from './helpers';
import type { Action, BBState } from './types';

export const ACTION_RU: Record<Action['type'], string> = {
  build: 'Строить',
  network: 'Сеть',
  develop: 'Развивать',
  sell: 'Продать',
  loan: 'Заём',
  scout: 'Разведка',
  pass: 'Пропуск',
};

/** Выполнить действие (мутирует G). Возвращает текст ошибки или null. При ошибке G нужно выбросить. */
export function doAction(G: BBState, pid: string, a: Action): string | null {
  if (!G.started || G.gameover) return 'Игра не идёт';
  if (currentPid(G) !== pid) return 'Сейчас не ваш ход';
  if (G.actionsLeft <= 0) return 'Действия в этом ходу закончились';
  G.lastRes = [];
  let err: string | null;
  switch (a.type) {
    case 'build': err = doBuild(G, pid, a); break;
    case 'network': err = doNetwork(G, pid, a); break;
    case 'develop': err = doDevelop(G, pid, a); break;
    case 'sell': err = doSell(G, pid, a); break;
    case 'loan': err = doLoan(G, pid, a.card); break;
    case 'scout': err = doScout(G, pid, a.cards); break;
    case 'pass': err = doPass(G, pid, a.card); break;
    default: err = 'Неизвестное действие';
  }
  G.lastRes = [];
  if (err) return err;
  G.actionsLeft--;
  G.actionsDone++;
  return null;
}

/** Копия состояния без длинного журнала (для предпросмотра). */
export function cloneState(G: BBState): BBState {
  return structuredClone({ ...G, log: G.log.slice(-1) }) as BBState;
}

/** Попробовать действие на копии: ошибка и состояние после. */
export function tryAction(G: BBState, pid: string, a: Action): { error: string | null; after: BBState } {
  const after = cloneState(G);
  const error = doAction(after, pid, a);
  return { error, after };
}
