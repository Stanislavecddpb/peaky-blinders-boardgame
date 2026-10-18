import type { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { doAction } from './action';
import { currentPid } from './helpers';
import { canFinishTurn, finishTurn } from './round';
import { applySetColor, applySetName, applyStart, setupGame } from './setup';
import type { Action, BBState, Color } from './types';
import { playerView } from './view';

export const GAME_ID = 'brass-birmingham';

const check = (error: string | null) => (error ? INVALID_MOVE : undefined);

/** Номер текущего игрока в ctx.playOrder. */
const posOf = ({ G, ctx }: { G: BBState; ctx: { playOrder: string[] } }) => ctx.playOrder.indexOf(currentPid(G));

export const BrassGame: Game<BBState> = {
  name: GAME_ID,
  minPlayers: 2,
  maxPlayers: 4,

  setup: ({ ctx, random }) => setupGame(ctx.numPlayers, (a) => random.Shuffle(a)),
  playerView,
  endIf: ({ G }) => G.gameover ?? undefined,

  phases: {
    // Лобби: имена и цвета; хост жмёт «Начать игру».
    lobby: {
      start: true,
      next: 'play',
      endIf: ({ G }) => G.started,
      turn: { activePlayers: { all: 'default' } },
      moves: {
        setName: ({ G, playerID }, name: string, forPid?: string) => check(applySetName(G, playerID, forPid ?? playerID, name)),
        setColor: ({ G, playerID }, color: Color, forPid?: string) => check(applySetColor(G, playerID, forPid ?? playerID, color)),
        startGame: ({ G, playerID }) => check(applyStart(G, playerID)),
      },
    },

    play: {
      turn: {
        order: { first: posOf, next: posOf },
      },
      moves: {
        // Действия детерминированы и ничего не открывают — их можно отменять до конца хода.
        act: ({ G, playerID }, action: Action) => check(doAction(G, playerID, action)),
        // Добор карт (и перемешивание в конце эпохи) — только на сервере, без отмены.
        finishTurn: {
          move: ({ G, playerID, random, events }) => {
            if (canFinishTurn(G, playerID)) return INVALID_MOVE;
            finishTurn(G, (a) => random.Shuffle(a));
            if (!G.gameover) events.endTurn();
          },
          client: false,
          undoable: false,
        },
      },
    },
  },
};
