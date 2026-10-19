import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  INDUSTRY_RU, INDUSTRY_SHORT, LINKS, LOCATIONS, MERCHANTS, ROMAN, deckSize, incomeLevel, isMerchant, linkName, nameOf, slotKey, tileDef,
  type BBState, type Color, type MerchantId, type MerchantTile, type NodeId, type PlacedTile,
} from '@bb/engine';
import { BEER, BOARD, COLOR_HEX, avatarImg, merchantImg, tileImg } from './assets';
import {
  COAL_MARKET_CELLS, CROP, DECK_RECTS, INCOME_TRACK, IRON_MARKET_CELLS, LINK_MIDPOINTS, MARKET_CELL_SIZE, MERCHANT_GEOM,
  SLOT_RECTS, TURN_BARRELS, TURN_MONEY, VP_TRACK, type Point,
} from './geometry';

export interface BoardHL {
  /** Пустые/перестраиваемые слоты, куда можно кликнуть. */
  slots?: Set<string>;
  /** Выбранные слоты/плитки. */
  selected?: Set<string>;
  links?: Set<number>;
  selectedLinks?: Set<number>;
}

const MERCHANT_TILE_RU: Record<MerchantTile, string> = {
  any: 'всё', cotton: 'хлопок', manufacturer: 'мануфактуру', pottery: 'гончарню', blank: '—',
};
const BONUS_RU: Record<string, string> = { vp: 'ПО', income: 'доход', money: '£', develop: 'развитие' };

function tileTip(G: BBState, loc: string, t: PlacedTile): ReactNode {
  const d = tileDef(t.industry, t.level);
  const res = t.industry === 'coal' ? 'угля' : t.industry === 'iron' ? 'железа' : 'пива';
  return (
    <>
      <b>{LOCATIONS[loc].ru}</b>
      <div>{INDUSTRY_RU[t.industry]} {ROMAN[t.level]} — {nameOf(G, t.owner)}</div>
      <div className="tip-dim">
        {t.flipped ? 'перевёрнута' : t.industry === 'coal' || t.industry === 'iron' || t.industry === 'brewery' ? `осталось ${res}: ${t.res}` : `для продажи пива: ${d.beer}`}
      </div>
      <div className="tip-dim">★ {d.vp} ПО · доход +{d.income} · ⛓ {d.linkVp}</div>
    </>
  );
}

const W = CROP.size;
const MIN_W = W / 6;
const CHANGED_MS = 5000;

interface View { x: number; y: number; w: number }

function center(rects: { x: number; y: number; w: number; h: number }[]): Point {
  const xs = rects.map((r) => r.x + r.w / 2);
  const ys = rects.map((r) => r.y + r.h / 2);
  return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length };
}

export function nodeAnchor(n: NodeId): Point {
  return isMerchant(n) ? center(MERCHANT_GEOM[n].tiles) : center(SLOT_RECTS[n]);
}

/** Путь связи: от первого конца через середину ко второму (и к ферме, если есть). */
function linkPath(i: number): string {
  const ends = LINKS[i].ends.map(nodeAnchor);
  const m = LINK_MIDPOINTS[i];
  // Квадратичная кривая проходит через середину при контрольной точке 2m − (a+b)/2.
  const c = { x: 2 * m.x - (ends[0].x + ends[1].x) / 2, y: 2 * m.y - (ends[0].y + ends[1].y) / 2 };
  let d = `M${ends[0].x},${ends[0].y} Q${c.x},${c.y} ${ends[1].x},${ends[1].y}`;
  for (const e of ends.slice(2)) d += ` M${m.x},${m.y} L${e.x},${e.y}`;
  return d;
}

/** Что изменилось за ход — подсвечивается несколько секунд. */
function useChanged(G: BBState): { slots: Set<string>; links: Set<number> } {
  const [shown, setShown] = useState<{ slots: Set<string>; links: Set<number> }>({ slots: new Set(), links: new Set() });
  const sig = `${G.changes.seq}:${G.changes.slots.join(',')}:${G.changes.links.join(',')}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!G.changes.slots.length && !G.changes.links.length) return;
    setShown({ slots: new Set(G.changes.slots), links: new Set(G.changes.links) });
    const t = setTimeout(() => setShown({ slots: new Set(), links: new Set() }), CHANGED_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return shown;
}

/** Поле: колесо — зум к курсору, перетаскивание — панорама, двойной клик — всё поле. */
export function Board({ G, hl, onSlot, onLink }: {
  G: BBState;
  hl: BoardHL;
  onSlot?: (loc: string, slot: number) => void;
  onLink?: (i: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const full: View = { x: CROP.x, y: CROP.y, w: W };
  const [view, setView] = useState<View>(full);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pan = useRef<{ px: number; py: number; view: View; moved: boolean } | null>(null);
  const changed = useChanged(G);
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null);
  /** Обработчики всплывающей подсказки для элемента поля. */
  const tipFor = (body: () => ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, body: body() }),
    onMouseLeave: () => setTip(null),
  });
  const colorOf = (pid: string): Color => G.players[pid]?.color ?? 'orange';

  function clamp(v: View): View {
    const w = Math.min(W, Math.max(MIN_W, v.w));
    return {
      w,
      x: Math.min(CROP.x + W - w, Math.max(CROP.x, v.x)),
      y: Math.min(CROP.y + W - w, Math.max(CROP.y, v.y)),
    };
  }

  useEffect(() => {
    const svg = svgRef.current!;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const v = viewRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      const k = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      const w = Math.min(W, Math.max(MIN_W, v.w * k));
      const f = w / v.w;
      setView(clamp({ w, x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f }));
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pxPerUnit(v: View): number {
    const r = svgRef.current!.getBoundingClientRect();
    return Math.min(r.width, r.height) / v.w;
  }
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    pan.current = { px: e.clientX, py: e.clientY, view, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.px;
    const dy = e.clientY - p.py;
    if (!p.moved && Math.hypot(dx, dy) < 5) return;
    p.moved = true;
    const s = pxPerUnit(p.view);
    setView(clamp({ ...p.view, x: p.view.x - dx / s, y: p.view.y - dy / s }));
  }
  function onPointerUp() {
    setTimeout(() => { pan.current = null; }, 0);
  }
  const clickable = (fn: () => void) => () => { if (!pan.current?.moved) fn(); };

  const zoomed = view.w < W - 1;
  const linkIdx = G.links.map((_, i) => i);

  return (
    <div className="board-wrap">
      <svg ref={svgRef} className="board" viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        onDoubleClick={() => setView(full)}>
        <image href={BOARD} x={CROP.x} y={CROP.y} width={W} height={W} />

        {/* Связи: построенные, затем кандидаты поверх */}
        {linkIdx.map((i) => {
          const owner = G.links[i];
          if (owner == null) return null;
          const m = LINK_MIDPOINTS[i];
          const col = COLOR_HEX[colorOf(owner)];
          return (
            <g key={`l${i}`} className={`link built ${changed.links.has(i) ? 'changed' : ''}`}
              {...tipFor(() => <><b>{linkName(i)}</b><div>{G.era === 'canal' ? 'Канал' : 'Железная дорога'} — {nameOf(G, owner)}</div></>)}>
              <path d={linkPath(i)} className="link-shadow" />
              <path d={linkPath(i)} className="link-line" style={{ stroke: col }} />
              {G.era === 'rail' && <path d={linkPath(i)} className="link-ties" />}
              <circle cx={m.x} cy={m.y} r={62} className="link-token" style={{ fill: col }} />
              <text x={m.x} y={m.y + 26} className="link-glyph">{G.era === 'canal' ? '⛴' : '🚂'}</text>
            </g>
          );
        })}
        {[...(hl.links ?? [])].map((i) => {
          const m = LINK_MIDPOINTS[i];
          const sel = hl.selectedLinks?.has(i);
          return (
            <g key={`c${i}`} className={`link cand ${sel ? 'sel' : ''}`} onClick={clickable(() => onLink?.(i))}
              {...tipFor(() => <><b>{linkName(i)}</b><div className="tip-dim">кликните, чтобы выбрать</div></>)}>
              <path d={linkPath(i)} className="link-hit" />
              <path d={linkPath(i)} className="link-cand" />
              <circle cx={m.x} cy={m.y} r={58} className="link-cand-dot" />
            </g>
          );
        })}
        {[...(hl.selectedLinks ?? [])].filter((i) => !hl.links?.has(i)).map((i) => (
          <g key={`s${i}`} className="link cand sel">
            <path d={linkPath(i)} className="link-cand" />
            <circle cx={LINK_MIDPOINTS[i].x} cy={LINK_MIDPOINTS[i].y} r={58} className="link-cand-dot" />
          </g>
        ))}

        {/* Слоты и плитки */}
        {Object.entries(SLOT_RECTS).map(([loc, rects]) => rects.map((r, slot) => {
          const t = G.slots[loc]?.[slot];
          const key = slotKey(loc, slot);
          const icons = LOCATIONS[loc].slots[slot].map((i) => INDUSTRY_SHORT[i]).join(' / ');
          const isHl = hl.slots?.has(key);
          const isSel = hl.selected?.has(key);
          return (
            <g key={key} className={`slot ${isHl ? 'hl' : ''} ${isSel ? 'sel' : ''} ${changed.slots.has(key) ? 'changed' : ''}`}
              onClick={isHl ? clickable(() => onSlot?.(loc, slot)) : undefined}
              {...tipFor(() => (t ? tileTip(G, loc, t) : <><b>{LOCATIONS[loc].ru}</b><div className="tip-dim">свободный слот: {icons}</div></>))}>
              {t && <image href={tileImg(t.industry, t.level, colorOf(t.owner), t.flipped)} x={r.x - 4} y={r.y - 4} width={r.w + 8} height={r.h + 8} />}
              {t && !t.flipped && t.res > 0 && <Resources x={r.x} y={r.y + r.h} w={r.w} kind={t.industry} n={t.res} />}
              <rect x={r.x - 6} y={r.y - 6} width={r.w + 12} height={r.h + 12} rx={14} className="slot-frame" />
            </g>
          );
        }))}

        {/* Торговцы */}
        {(Object.keys(MERCHANT_GEOM) as MerchantId[]).map((m) => {
          const g = MERCHANT_GEOM[m];
          const st = G.merchants[m];
          return (
            <g key={m} {...tipFor(() => (
              <>
                <b>Торговец {MERCHANTS[m].ru}</b>
                {st.tiles.length
                  ? <>
                      <div>Покупает: {[...new Set(st.tiles.filter((t) => t !== 'blank').map((t) => MERCHANT_TILE_RU[t]))].join(', ') || 'ничего'}</div>
                      <div className="tip-dim">Бонус за его пиво: {MERCHANTS[m].bonus.kind === 'develop' ? 'бесплатное развитие' : `+${MERCHANTS[m].bonus.amount} ${BONUS_RU[MERCHANTS[m].bonus.kind]}`}</div>
                      <div className="tip-dim">Бочек: {st.beer.filter(Boolean).length}</div>
                    </>
                  : <div className="tip-dim">в этой партии не используется (но связь с ним считается)</div>}
              </>
            ))}>
              {st.tiles.map((tile, i) => (
                <image key={i} href={merchantImg(tile)} x={g.tiles[i].x} y={g.tiles[i].y} width={g.tiles[i].w} height={g.tiles[i].h} />
              ))}
              {st.tiles.length === 0 && g.tiles.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={20} className="merchant-off" />)}
              {st.beer.map((b, i) => b && (
                <image key={`b${i}`} href={BEER} x={g.beer[i].x - 6} y={g.beer[i].y - 6} width={g.beer[i].w + 12} height={g.beer[i].h + 12} />
              ))}
            </g>
          );
        })}

        {/* Рынки */}
        {COAL_MARKET_CELLS.map((c, i) => i >= COAL_MARKET_CELLS.length - G.coal && (
          <rect key={`coal${i}`} x={c.x - MARKET_CELL_SIZE / 2} y={c.y - MARKET_CELL_SIZE / 2} width={MARKET_CELL_SIZE} height={MARKET_CELL_SIZE} rx={8} className="cube coal" />
        ))}
        {IRON_MARKET_CELLS.map((c, i) => i >= IRON_MARKET_CELLS.length - G.iron && (
          <rect key={`iron${i}`} x={c.x - MARKET_CELL_SIZE / 2} y={c.y - MARKET_CELL_SIZE / 2} width={MARKET_CELL_SIZE} height={MARKET_CELL_SIZE} rx={8} className="cube iron" />
        ))}

        {/* Порядок ходов */}
        {G.order.map((pid, i) => {
          const b = TURN_BARRELS[i];
          const mo = TURN_MONEY[i];
          const p = G.players[pid];
          return (
            <g key={`turn${pid}`}>
              <title>{`${i + 1}. ${nameOf(G, pid)}: потрачено £${p.spent}`}</title>
              <clipPath id={`av${pid}`}><circle cx={b.x} cy={b.y} r={105} /></clipPath>
              <image href={avatarImg(colorOf(pid))} x={b.x - 105} y={b.y - 105} width={210} height={210} clipPath={`url(#av${pid})`} />
              <circle cx={b.x} cy={b.y} r={105} className={`turn-ring ${i === G.orderPos && G.started && !G.gameover ? 'now' : ''}`} style={{ stroke: COLOR_HEX[colorOf(pid)] }} />
              <text x={mo.x} y={mo.y + 30} className="turn-money">£{p.spent}</text>
            </g>
          );
        })}

        {/* Треки ПО и дохода */}
        <Track G={G} points={VP_TRACK} value={(pid) => G.players[pid].vp % 100} label={(pid) => `${nameOf(G, pid)}: ${G.players[pid].vp} ПО`} colorOf={colorOf} r={42} />
        <Track G={G} points={INCOME_TRACK} value={(pid) => G.players[pid].incomeSpace} label={(pid) => `${nameOf(G, pid)}: доход ${incomeLevel(G.players[pid].incomeSpace)}`} colorOf={colorOf} r={30} ring />

        {/* Колоды */}
        <DeckLabel r={DECK_RECTS.draw} text={`Колода: ${deckSize(G)}`} />
        <DeckLabel r={DECK_RECTS.wildIndustry} text={`Любая отрасль: ${G.wild.industry}`} />
        <DeckLabel r={DECK_RECTS.wildLocation} text={`Любая локация: ${G.wild.location}`} />
      </svg>
      {tip && <div className="board-tip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 290), top: Math.min(tip.y + 16, window.innerHeight - 130) }}>{tip.body}</div>}
      {zoomed && <button className="btn small zoom-reset" onClick={() => setView(full)}>⤢ Всё поле</button>}
    </div>
  );
}

function Resources({ x, y, w, kind, n }: { x: number; y: number; w: number; kind: string; n: number }) {
  const size = kind === 'brewery' ? 64 : 44;
  const gap = 6;
  const total = n * size + (n - 1) * gap;
  const scale = total > w + 30 ? (w + 30) / total : 1;
  const s = size * scale;
  const x0 = x + w / 2 - (n * s + (n - 1) * gap * scale) / 2;
  return (
    <g pointerEvents="none">
      {Array.from({ length: n }, (_, i) => {
        const cx = x0 + i * (s + gap * scale);
        return kind === 'brewery'
          ? <image key={i} href={BEER} x={cx} y={y - s * 0.8} width={s} height={s} />
          : <rect key={i} x={cx} y={y - s * 0.75} width={s} height={s} rx={6} className={`cube ${kind}`} />;
      })}
    </g>
  );
}

function Track({ G, points, value, label, colorOf, r, ring }: {
  G: BBState; points: Point[]; value: (pid: string) => number; label: (pid: string) => string;
  colorOf: (pid: string) => Color; r: number; ring?: boolean;
}) {
  const byPos = new Map<number, string[]>();
  for (const pid of Object.keys(G.players)) {
    const v = Math.max(0, Math.min(points.length - 1, value(pid)));
    byPos.set(v, [...(byPos.get(v) ?? []), pid]);
  }
  return (
    <g>
      {[...byPos.entries()].flatMap(([pos, list]) => list.map((pid, k) => {
        const p = points[pos];
        const off = (k - (list.length - 1) / 2) * r * 0.9;
        return (
          <g key={`${pid}`}>
            <title>{label(pid)}</title>
            <circle cx={p.x + off} cy={p.y - off * 0.4} r={r} className={ring ? 'track-disc ring' : 'track-disc'}
              style={ring ? { stroke: COLOR_HEX[colorOf(pid)] } : { fill: COLOR_HEX[colorOf(pid)] }} />
          </g>
        );
      }))}
    </g>
  );
}

function DeckLabel({ r, text }: { r: { x: number; y: number; w: number; h: number }; text: string }) {
  return (
    <g pointerEvents="none">
      <rect x={r.x + 40} y={r.y + r.h / 2 - 60} width={r.w - 80} height={120} rx={20} className="deck-label-bg" />
      <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 22} className="deck-label">{text}</text>
    </g>
  );
}
