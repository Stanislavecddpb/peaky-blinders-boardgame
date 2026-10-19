import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ACTION_RU, INDUSTRY_SHORT, LINKS, LOCATIONS, MERCHANTS, ROMAN, buildTargets, canFinishTurn, canLoan, canScout, cardName, cloneState,
  developIndustries, faceOf, linkName, linkTargets, nextTile, sellTargets, slotKey, tileDef, tryAction, uniqueCards,
  type Action, type BBState, type BeerPick, type BuildTarget, type Industry, type ResPick, type Sale, type SellTarget,
} from '@bb/engine';
import type { BoardHL } from './Board';
import type { HandSelect } from './Hand';
import { BeerPicker, CoalPicker, IronPicker } from './Sources';

type Kind = Action['type'];

interface Draft {
  kind: Kind;
  card: string | null;
  scout: string[];
  target: BuildTarget | null;
  /** Клик по слоту с двумя возможными отраслями — выбор. */
  slotChoices: BuildTarget[] | null;
  links: number[];
  addSecond: boolean;
  industries: Industry[];
  sales: Sale[];
  pendingSale: SellTarget | null;
  coal: ResPick[] | null;
  iron: ResPick[] | null;
  beer: BeerPick[] | null;
  bonus: Industry | null;
}

const empty = (kind: Kind): Draft => ({
  kind, card: null, scout: [], target: null, slotChoices: null, links: [], addSecond: false, industries: [], sales: [],
  pendingSale: null, coal: null, iron: null, beer: null, bonus: null,
});

function toAction(d: Draft): Action | null {
  switch (d.kind) {
    case 'build':
      return d.card && d.target ? { type: 'build', card: d.card, ...d.target, coal: d.coal ?? undefined, iron: d.iron ?? undefined } : null;
    case 'network':
      return d.card && d.links.length
        ? { type: 'network', card: d.card, links: d.links, beer: d.links.length === 2 && d.beer ? d.beer[0] : undefined }
        : null;
    case 'develop':
      return d.card && d.industries.length ? { type: 'develop', card: d.card, industries: d.industries, iron: d.iron ?? undefined } : null;
    case 'sell':
      return d.card && d.sales.length ? { type: 'sell', card: d.card, sales: d.sales, bonusDevelop: d.bonus ? [d.bonus] : undefined } : null;
    case 'loan':
    case 'pass':
      return d.card ? { type: d.kind, card: d.card } : null;
    case 'scout':
      return d.scout.length === 3 ? { type: 'scout', cards: d.scout } : null;
  }
}

const ICON: Record<Kind, string> = {
  build: '🏭', network: '⛓', develop: '⚙️', sell: '💰', loan: '🏦', scout: '🔍', pass: '⏭',
};

/** Короткая подсказка под названием кнопки. */
function costHint(kind: Kind, era: 'canal' | 'rail'): string {
  switch (kind) {
    case 'build': return 'плитка с планшета';
    case 'network': return era === 'canal' ? 'канал £3' : 'ж/д £5 + уголь';
    case 'develop': return '1–2 плитки, железо';
    case 'sell': return 'нужно пиво';
    case 'loan': return '+£30, доход −3';
    case 'scout': return '3 карты → 2 джокера';
    case 'pass': return 'сбросить карту';
  }
}

const HELP: Record<Kind, string> = {
  build: 'Карта локации — строить в этом городе; карта отрасли — эту отрасль в своей сети; джокеры — что угодно.',
  network: 'Каналы — £3 за связь. Ж/д — £5 + уголь, или две за £15 + 2 угля + пиво. Связь примыкает к вашей сети.',
  develop: 'Убрать с планшета 1–2 нижние плитки, каждая стоит 1 железо.',
  sell: 'Перевернуть свои хлопок, мануфактуры, гончарни: нужна связь с торговцем и пиво.',
  loan: '+£30, доход −3 уровня.',
  scout: 'Сбросить 3 карты и взять «любую локацию» и «любую отрасль».',
  pass: 'Просто сбросить карту.',
};

export interface Wizard {
  hl: BoardHL;
  onSlot: (loc: string, slot: number) => void;
  onLink: (i: number) => void;
  hand?: HandSelect;
  matPick?: { can: (i: Industry) => boolean; onPick: (i: Industry) => void; chosen: Industry[] };
  panel: ReactNode;
}

export function useWizard({ G, me, moves, undo, active, turnKey }: {
  G: BBState; me: string | null; moves: any; undo: () => void; active: boolean; turnKey: string;
}): Wizard {
  const [d, setD] = useState<Draft | null>(null);
  const upd = (patch: Partial<Draft>) => setD((x) => (x ? { ...x, ...patch } : x));
  useEffect(() => setD(null), [turnKey, G.actionsDone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setD(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mine = me ? G.players[me] : null;
  const hand = mine?.hand ?? [];

  // Варианты постройки по картам руки — считаем в свой ход, чтобы заранее знать, есть ли что строить.
  const buildMap = useMemo(() => {
    if (!me || !active || G.actionsLeft <= 0) return null;
    const m = new Map<string, BuildTarget[]>();
    for (const c of uniqueCards(hand)) m.set(faceOf(c), buildTargets(G, me, c));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, me, active]);
  const anyLink = useMemo(() => (me && active && hand.length && G.actionsLeft > 0 ? linkTargets(G, me, hand[0]).length > 0 : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, me, active]);
  const targetsFor = (card: string | null) => (card && buildMap?.get(faceOf(card))) || [];

  const linkCands = useMemo(() => {
    if (!me || d?.kind !== 'network' || !d.card) return [];
    if (d.links.length === 0) return linkTargets(G, me, d.card);
    if (d.links.length === 1 && d.addSecond) return linkTargets(G, me, d.card, d.links[0]);
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, me, d?.kind, d?.card, d?.links.join(), d?.addSecond]);

  const sells = useMemo(() => (me && d?.kind === 'sell' ? sellTargets(G, me) : []), [G, me, d?.kind]);

  const action = d ? toAction(d) : null;
  const preview = useMemo(() => (me && action ? tryAction(G, me, action) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [G, me, JSON.stringify(action)]);

  const hl: BoardHL = {};
  let onSlot = (_l: string, _s: number) => {};
  let onLink = (_i: number) => {};
  let handSel: HandSelect | undefined;
  let matPick: Wizard['matPick'];

  if (!active || !me || !mine) {
    const status = G.gameover ? 'Игра окончена' : '';
    return { hl, onSlot, onLink, panel: status ? <div className="hint">{status}</div> : null };
  }

  const finishErr = canFinishTurn(G, me);
  const act = () => {
    if (!action || preview?.error) return;
    moves.act(action);
    setD(null);
  };

  // ---- выбор карты ----
  if (d && d.kind !== 'scout') {
    handSel = {
      can: (c) => (d.kind === 'build' ? targetsFor(c).length > 0 : true),
      selected: d.card ? [d.card] : [],
      onCard: (c) => setD({ ...empty(d.kind), card: c }),
    };
  } else if (d?.kind === 'scout') {
    handSel = {
      can: () => true,
      selected: d.scout,
      onCard: (c) => upd({ scout: d.scout.includes(c) ? d.scout.filter((x) => x !== c) : d.scout.length < 3 ? [...d.scout, c] : d.scout }),
    };
  }

  let body: ReactNode = null;
  if (d) {
    const needCard = d.kind !== 'scout' && !d.card;
    const steps: ReactNode[] = [];
    if (needCard) {
      steps.push(<div key="c" className="step">Выберите карту на руке{d.kind === 'build' ? ' (подсвечены подходящие)' : ' — она уйдёт в сброс'}.</div>);
      if (d.kind === 'build' && buildMap && ![...buildMap.values()].some((t) => t.length)) {
        steps.push(<div key="n" className="hint warn">Строить сейчас нечего: не хватает денег, ресурсов или подходящих карт.</div>);
      }
    }

    if (d.kind === 'build' && d.card) {
      const targets = targetsFor(d.card);
      if (!d.target) {
        hl.slots = new Set(targets.map((t) => slotKey(t.loc, t.slot)));
        onSlot = (loc, slot) => {
          const opts = targets.filter((t) => t.loc === loc && t.slot === slot);
          if (opts.length === 1) upd({ target: opts[0], slotChoices: null, coal: null, iron: null });
          else if (opts.length > 1) upd({ slotChoices: opts });
        };
        if (d.slotChoices) {
          steps.push(
            <div key="ch" className="step">Какую отрасль строить?
              <div className="buttons">{d.slotChoices.map((t) => (
                <button key={t.industry} className="btn small" onClick={() => upd({ target: t, slotChoices: null })}>{INDUSTRY_SHORT[t.industry]}</button>
              ))}</div>
            </div>,
          );
        } else {
          steps.push(<div key="t" className="step">Кликните подсвеченный слот на поле или выберите из списка:</div>);
          steps.push(
            <div key="tl" className="target-list">
              {targets.map((t) => (
                <button key={`${t.loc}${t.slot}${t.industry}`} className="btn small ghost"
                  onClick={() => upd({ target: t, coal: null, iron: null })}>
                  {LOCATIONS[t.loc].ru}: {INDUSTRY_SHORT[t.industry]} {ROMAN[nextTile(G, me, t.industry)!.level]}
                  {G.slots[t.loc][t.slot] ? ' (перестройка)' : ''}
                </button>
              ))}
            </div>,
          );
        }
      } else {
        const def = nextTile(G, me, d.target.industry)!;
        hl.selected = new Set([slotKey(d.target.loc, d.target.slot)]);
        hl.slots = new Set(targets.map((t) => slotKey(t.loc, t.slot)));
        onSlot = (loc, slot) => {
          const opts = targets.filter((t) => t.loc === loc && t.slot === slot);
          if (opts.length === 1) upd({ target: opts[0], coal: null, iron: null });
          else if (opts.length > 1) upd({ target: null, slotChoices: opts });
        };
        steps.push(<div key="s" className="step">Строить: <b>{INDUSTRY_SHORT[d.target.industry]} {ROMAN[def.level]}</b> в {LOCATIONS[d.target.loc].ru}</div>);
        steps.push(<CoalPicker key="coal" G={G} at={[d.target.loc]} need={def.coal} value={d.coal} onChange={(v) => upd({ coal: v })} />);
        steps.push(<IronPicker key="iron" G={G} need={def.iron} value={d.iron} onChange={(v) => upd({ iron: v })} />);
      }
    }

    if (d.kind === 'network' && d.card) {
      hl.links = new Set(linkCands);
      hl.selectedLinks = new Set(d.links);
      onLink = (i) => {
        if (d.links.length === 0) upd({ links: [i] });
        else if (d.addSecond && d.links.length === 1) upd({ links: [d.links[0], i], beer: null });
      };
      if (!d.links.length) {
        steps.push(<div key="l" className="step">Кликните связь на поле или выберите из списка:</div>);
        steps.push(
          <div key="ll" className="target-list">
            {linkCands.map((i) => <button key={i} className="btn small ghost" onClick={() => upd({ links: [i] })}>{linkName(i)}</button>)}
            {!linkCands.length && <div className="hint warn">Построить связь сейчас нельзя.</div>}
          </div>,
        );
      } else {
        steps.push(<div key="sel" className="step">Связь: <b>{d.links.map(linkName).join(' и ')}</b></div>);
        if (G.era === 'rail' && d.links.length === 1) {
          steps.push(d.addSecond
            ? <div key="2" className="step">Выберите вторую железную дорогу на поле:
                <div className="target-list">{linkCands.map((i) => <button key={i} className="btn small ghost" onClick={() => upd({ links: [d.links[0], i], beer: null })}>{linkName(i)}</button>)}</div>
                {!linkCands.length && <div className="hint warn">Вторую дорогу построить нельзя (деньги, уголь или пиво).</div>}
                <button className="btn small ghost" onClick={() => upd({ addSecond: false })}>Только одна</button>
              </div>
            : <button key="2b" className="btn small ghost" onClick={() => upd({ addSecond: true })}>+ Вторая ж/д (всего £15, ещё уголь и пиво)</button>);
        }
        if (d.links.length === 2) {
          // Пиво для второй дороги: смотрим связность уже с обеими дорогами.
          const Gx = cloneState(G);
          for (const i of d.links) Gx.links[i] = me;
          steps.push(<BeerPicker key="beer" G={Gx} me={me} at={LINKS[d.links[1]].ends} need={1} value={d.beer} onChange={(v) => upd({ beer: v })} title="Пиво для второй дороги" />);
        }
        steps.push(<button key="r" className="link-btn" onClick={() => upd({ links: [], addSecond: false, beer: null })}>выбрать заново</button>);
      }
    }

    if (d.kind === 'develop' && d.card) {
      const can = developIndustries(G, me, d.industries);
      matPick = {
        can: (i) => d.industries.length < 2 && can.includes(i),
        onPick: (i) => upd({ industries: [...d.industries, i], iron: null }),
        chosen: d.industries,
      };
      steps.push(<div key="d" className="step">Что развивать (до двух плиток; можно и на планшете):</div>);
      steps.push(
        <div key="dl" className="buttons">
          {can.map((i) => {
            const t = nextTile(G, me, i);
            const next = t ? `${INDUSTRY_SHORT[i]} ${ROMAN[(nextTileAfter(G, me, i, d.industries) ?? t).level]}` : INDUSTRY_SHORT[i];
            return <button key={i} className="btn small" disabled={d.industries.length >= 2} onClick={() => upd({ industries: [...d.industries, i], iron: null })}>{next}</button>;
          })}
        </div>,
      );
      if (d.industries.length) {
        steps.push(<div key="ch" className="step">Убрать: <b>{d.industries.map((i) => INDUSTRY_SHORT[i]).join(', ')}</b> <button className="link-btn" onClick={() => upd({ industries: [], iron: null })}>сбросить</button></div>);
        steps.push(<IronPicker key="iron" G={G} need={d.industries.length} value={d.iron} onChange={(v) => upd({ iron: v })} />);
      }
    }

    if (d.kind === 'sell' && d.card) {
      const chosen = new Set(d.sales.map((s) => slotKey(s.loc, s.slot)));
      const free = sells.filter((s) => !chosen.has(slotKey(s.loc, s.slot)));
      hl.slots = new Set(free.map((s) => slotKey(s.loc, s.slot)));
      hl.selected = chosen;
      const add = (s: SellTarget, merchant: (typeof s.merchants)[number]) =>
        upd({ sales: [...d.sales, { loc: s.loc, slot: s.slot, merchant }], pendingSale: null });
      onSlot = (loc, slot) => {
        const s = free.find((x) => x.loc === loc && x.slot === slot);
        if (!s) return;
        if (s.merchants.length === 1) add(s, s.merchants[0]);
        else upd({ pendingSale: s });
      };
      if (d.pendingSale) {
        const s = d.pendingSale;
        steps.push(
          <div key="pm" className="step">Кому продать {INDUSTRY_SHORT[s.industry]} из {LOCATIONS[s.loc].ru}?
            <div className="buttons">{s.merchants.map((m) => (
              <button key={m} className="btn small" onClick={() => add(s, m)}>
                {MERCHANTS[m].ru}{G.merchants[m].beer.some(Boolean) ? ' 🍺' : ''}
              </button>
            ))}</div>
          </div>,
        );
      } else {
        steps.push(<div key="s" className="step">Кликните свою плитку на поле{d.sales.length ? ', чтобы продать ещё' : ''}:</div>);
        steps.push(
          <div key="sl" className="target-list">
            {free.map((s) => (
              <button key={slotKey(s.loc, s.slot)} className="btn small ghost" onClick={() => onSlot(s.loc, s.slot)}>
                {LOCATIONS[s.loc].ru}: {INDUSTRY_SHORT[s.industry]} {ROMAN[G.slots[s.loc][s.slot]!.level]}
              </button>
            ))}
            {!free.length && !d.sales.length && <div className="hint warn">Продавать нечего: нужна своя неперевёрнутая плитка, связанная с подходящим торговцем.</div>}
          </div>,
        );
      }
      d.sales.forEach((s, k) => {
        const t = G.slots[s.loc][s.slot]!;
        const need = tileDef(t.industry, t.level).beer;
        steps.push(
          <div key={`sale${k}`} className="sale">
            <div>
              <b>{INDUSTRY_SHORT[t.industry]} {ROMAN[t.level]}</b> из {LOCATIONS[s.loc].ru} → {MERCHANTS[s.merchant].ru}
              {need ? ` · пива ${need}` : ' · без пива'}
              <button className="link-btn" onClick={() => upd({ sales: d.sales.filter((_, j) => j !== k) })}>убрать</button>
            </div>
            <BeerPicker G={G} me={me} at={[s.loc]} need={need} sell={{ merchant: s.merchant, industry: t.industry }} value={s.beer ?? null}
              onChange={(v) => upd({ sales: d.sales.map((x, j) => (j === k ? { ...x, beer: v ?? undefined } : x)) })} />
          </div>,
        );
      });
      if (d.sales.some((s) => s.merchant === 'gloucester') && G.merchants.gloucester.beer.some(Boolean)) {
        const can = developIndustries(G, me);
        steps.push(
          <div key="gl" className="step">Бонус Глостера (если возьмёте его пиво) — развить:
            <select value={d.bonus ?? ''} onChange={(e) => upd({ bonus: (e.target.value || null) as Industry | null })}>
              <option value="">автоматически</option>
              {can.map((i) => <option key={i} value={i}>{INDUSTRY_SHORT[i]}</option>)}
            </select>
          </div>,
        );
      }
    }

    if (d.kind === 'scout') {
      steps.push(<div key="sc" className="step">Выберите 3 карты для сброса ({d.scout.length}/3).</div>);
    }

    body = (
      <div className="draft">
        <div className="draft-head">
          <b>{ICON[d.kind]} {ACTION_RU[d.kind]}</b>
          {d.card && <span className="hint"> · карта: {cardName(d.card)}</span>}
          <button className="btn small ghost" onClick={() => setD(null)}>Отмена</button>
        </div>
        <div className="hint">{HELP[d.kind]}</div>
        {steps}
        {action && preview && (
          preview.error
            ? <div className="err">{preview.error}</div>
            : (
              <div className="preview">
                <div>Деньги: £{mine.money} → <b>£{preview.after.players[me].money}</b></div>
                <ul>{preview.after.log.slice(1).map((l) => <li key={l.n}>{l.text}</li>)}</ul>
              </div>
            )
        )}
        <button className="btn confirm" disabled={!action || !!preview?.error} onClick={act}>Подтвердить{action && !preview?.error ? ' ✓' : ''}</button>
        <div className="hint kbd-hint">Esc — отменить выбор</div>
      </div>
    );
  }

  const kinds: { kind: Kind; ok: boolean; why?: string }[] = [
    { kind: 'build', ok: !!buildMap && [...buildMap.values()].some((t) => t.length), why: 'строить нечего: не хватает денег, ресурсов или подходящих карт' },
    { kind: 'network', ok: anyLink, why: mine.linksLeft > 0 ? 'связь сейчас построить нельзя (деньги, уголь или сеть)' : 'жетоны связей кончились' },
    { kind: 'develop', ok: developIndustries(G, me).length > 0 },
    { kind: 'sell', ok: sellTargets(G, me).length > 0, why: 'нечего продать' },
    { kind: 'loan', ok: canLoan(G, me), why: 'доход не может опуститься ниже −10' },
    { kind: 'scout', ok: canScout(G, me), why: 'нужно 3 карты и ни одного джокера на руке' },
    { kind: 'pass', ok: true },
  ];
  const canAct = G.actionsLeft > 0 && hand.length > 0;

  const panel = (
    <div className="wizard">
      {canAct && !d && (
        <>
          <div className="step">Выберите действие <span className="pips">{Array.from({ length: G.actionsLeft }, (_, i) => <i key={i} />)}</span></div>
          <div className="action-grid">
            {kinds.map((k) => (
              <button key={k.kind} className={`btn action action-${k.kind}`} disabled={!k.ok} title={k.ok ? HELP[k.kind] : k.why}
                onClick={() => setD(empty(k.kind))}>
                <span className="action-icon">{ICON[k.kind]}</span>
                <span className="action-text">{ACTION_RU[k.kind]}<small>{k.ok ? costHint(k.kind, G.era) : k.why}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      {body}
      {!canAct && !d && <div className="step">{finishErr ? finishErr : 'Все действия сделаны.'}</div>}
      <div className="buttons">
        {G.actionsDone > 0 && <button className="btn ghost small" onClick={() => { setD(null); undo(); }}>↶ Отменить действие</button>}
        <button className={`btn ${!finishErr ? 'finish' : 'ghost'}`} disabled={!!finishErr} onClick={() => moves.finishTurn()}>
          Завершить ход{!finishErr ? ' (добрать карты)' : ''}
        </button>
      </div>
    </div>
  );

  return { hl, onSlot, onLink, hand: handSel, matPick, panel };
}

/** Какая плитка будет следующей после уже выбранных к развитию. */
function nextTileAfter(G: BBState, me: string, ind: Industry, chosen: Industry[]) {
  const shift = chosen.filter((c) => c === ind).length;
  const taken = G.players[me].taken[ind] + shift;
  return nextTile({ ...G, players: { ...G.players, [me]: { ...G.players[me], taken: { ...G.players[me].taken, [ind]: taken } } } }, me, ind);
}
