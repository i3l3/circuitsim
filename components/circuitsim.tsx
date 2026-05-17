"use client";

import {Circle, Layer, Line, Rect, Stage, Text} from "react-konva";
import {useCallback, useEffect, useRef, useState} from "react";
import Konva from "konva";
import Resistor from "@/components/resistor";
import Battery from "@/components/battery";
import ContextMenu, {ContextMenuItem} from "@/components/contextmenu";
import PropertyPanel from "@/components/propertypanel";
import GridBackground from "@/components/grid";
import GridSettings from "@/components/gridsettings";
import HelpPanel from "@/components/helppanel";

export interface Item {
    uuid: string; x: number; y: number; rotation: number;
    connectedA: string | null; connectedB: string | null;
    type: "resistor" | "battery"; value?: number;
}
export interface Point { uuid: string; x: number; y: number; }
export interface ClickEvent { clicked: boolean; x: number; y: number; }
export type Terminal =
    | { type: "item"; itemUuid: string; side: "A" | "B" }
    | { type: "node"; nodeUuid: string };
export interface WireNode { uuid: string; x: number; y: number; }
export interface Wire { uuid: string; from: Terminal; to: Terminal; bendPoints: { x: number; y: number }[]; }
export interface DrawingWire { from: Terminal; fromPos: { x: number; y: number }; bendPoints: { x: number; y: number }[]; mode: "click" | "drag"; }

interface CtxMenuState { visible: boolean; x: number; y: number; items: ContextMenuItem[]; }

function termsEq(a: Terminal, b: Terminal): boolean {
    if (a.type === "item" && b.type === "item") return a.itemUuid === b.itemUuid && a.side === b.side;
    if (a.type === "node" && b.type === "node") return a.nodeUuid === b.nodeUuid;
    return false;
}
function dist2seg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function getItemTermPos(item: Item, side: "A" | "B"): { x: number; y: number } {
    const cx = item.x + 50, cy = item.y + 25, rad = (item.rotation * Math.PI) / 180;
    const lx = side === "A" ? -50 : 50;
    return { x: cx + lx * Math.cos(rad), y: cy + lx * Math.sin(rad) };
}

const CircuitSim = () => {
    const [dims, setDims] = useState(() => typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight } : { w: 0, h: 0 });
    const [items, setItems] = useState<Item[]>([
        { uuid: crypto.randomUUID(), x: 100, y: 100, rotation: 0, connectedA: null, connectedB: null, type: "resistor", value: 100 },
        { uuid: crypto.randomUUID(), x: 100, y: 200, rotation: 0, connectedA: null, connectedB: null, type: "resistor", value: 200 },
    ]);
    const [mpos, setMpos] = useState({ x: 0, y: 0 });
    const [wires, setWires] = useState<Wire[]>([]);
    const [nodes, setNodes] = useState<WireNode[]>([]);
    const [dw, setDw] = useState<DrawingWire | null>(null);
    const [ctx, setCtx] = useState<CtxMenuState>({ visible: false, x: 0, y: 0, items: [] });
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    // Grid & zoom state
    const [gridSize, setGridSize] = useState(25);
    const [gridMode, setGridMode] = useState<"dots" | "lines">("dots");
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [scale, setScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

    const stageRef = useRef<Konva.Stage>(null);
    const bgRef = useRef<Konva.Rect>(null);
    const pendRef = useRef<{ terminal: Terminal; pos: { x: number; y: number }; ms: { x: number; y: number } } | null>(null);
    const shiftBendRef = useRef(false);

    /** Snap a value to grid */
    const snap = useCallback((v: number) => snapEnabled ? Math.round(v / gridSize) * gridSize : v, [snapEnabled, gridSize]);
    const snapPt = useCallback((p: { x: number; y: number }) => ({ x: snap(p.x), y: snap(p.y) }), [snap]);

    /** Get pointer position in world coords (accounting for zoom/pan) */
    const getWorldPos = useCallback((): { x: number; y: number } | null => {
        if (!stageRef.current) return null;
        const pp = stageRef.current.getPointerPosition();
        if (!pp) return null;
        return { x: (pp.x - stagePos.x) / scale, y: (pp.y - stagePos.y) / scale };
    }, [scale, stagePos]);

    const resolvePos = useCallback((t: Terminal) => {
        if (t.type === "item") { const it = items.find(i => i.uuid === t.itemUuid); return it ? getItemTermPos(it, t.side) : null; }
        const n = nodes.find(nd => nd.uuid === t.nodeUuid); return n ? { x: n.x, y: n.y } : null;
    }, [items, nodes]);

    const findTermAt = useCallback((px: number, py: number, th = 15) => {
        for (const it of items) for (const s of ["A", "B"] as const) { const p = getItemTermPos(it, s); if (Math.hypot(px - p.x, py - p.y) < th) return { terminal: { type: "item" as const, itemUuid: it.uuid, side: s }, pos: p }; }
        for (const n of nodes) if (Math.hypot(px - n.x, py - n.y) < th) return { terminal: { type: "node" as const, nodeUuid: n.uuid }, pos: { x: n.x, y: n.y } };
        return null;
    }, [items, nodes]);

    const findWireAt = useCallback((px: number, py: number, th = 8) => {
        let bd = Infinity, br: { wire: Wire; si: number } | null = null;
        for (const w of wires) {
            const fp = resolvePos(w.from), tp = resolvePos(w.to); if (!fp || !tp) continue;
            const pts = [fp, ...w.bendPoints, tp];
            for (let i = 0; i < pts.length - 1; i++) { const d = dist2seg(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y); if (d < bd) { bd = d; br = { wire: w, si: i }; } }
        }
        return bd <= th && br ? br : null;
    }, [wires, resolvePos]);

    const completeWireAt = useCallback((px: number, py: number, drawing: DrawingWire): boolean => {
        const th = findTermAt(px, py, 15 / scale);
        if (th && !termsEq(drawing.from, th.terminal)) {
            setWires(p => [...p, { uuid: crypto.randomUUID(), from: drawing.from, to: th.terminal, bendPoints: [...drawing.bendPoints] }]);
            setDw(null); return true;
        }
        const wh = findWireAt(px, py, 12 / scale);
        if (wh) {
            const sp = snapPt({ x: px, y: py });
            const nn: WireNode = { uuid: crypto.randomUUID(), ...sp };
            const nt: Terminal = { type: "node", nodeUuid: nn.uuid };
            const ow = wh.wire, bb = ow.bendPoints.slice(0, wh.si), ba = ow.bendPoints.slice(wh.si);
            setNodes(p => [...p, nn]);
            setWires(p => [...p.filter(w => w.uuid !== ow.uuid),
                { uuid: crypto.randomUUID(), from: ow.from, to: nt, bendPoints: bb },
                { uuid: crypto.randomUUID(), from: nt, to: ow.to, bendPoints: ba },
                { uuid: crypto.randomUUID(), from: drawing.from, to: nt, bendPoints: [...drawing.bendPoints] }]);
            setDw(null); return true;
        }
        return false;
    }, [findTermAt, findWireAt, scale, snapPt]);

    useEffect(() => { const h = () => setDims({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setDw(null); pendRef.current = null; setCtx(p => ({ ...p, visible: false })); setSelectedItem(null); }
            if ((e.key === "r" || e.key === "R") && !selectedItem) {
                setItems(p => p.map(it => { const cx = it.x + 50, cy = it.y + 25; return Math.hypot(mpos.x - cx, mpos.y - cy) < 60 ? { ...it, rotation: (it.rotation + 90) % 360 } : it; }));
            }
        };
        window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [mpos, selectedItem]);

    /** Zoom with mouse wheel */
    const onWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = stageRef.current; if (!stage) return;
        const oldScale = scale;
        const pointer = stage.getPointerPosition(); if (!pointer) return;

        const dir = e.evt.deltaY > 0 ? -1 : 1;
        const factor = 1.08;
        const newScale = Math.min(3, Math.max(0.2, dir > 0 ? oldScale * factor : oldScale / factor));

        const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
        const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };

        setScale(newScale);
        setStagePos(newPos);
    }, [scale, stagePos]);

    const closeCtx = useCallback(() => setCtx(p => ({ ...p, visible: false })), []);

    const onPointerMove = useCallback(() => {
        const p = getWorldPos(); if (!p) return;
        setMpos(p);
        if (pendRef.current && !dw) {
            if (Math.hypot(p.x - pendRef.current.ms.x, p.y - pendRef.current.ms.y) > 5 / scale) {
                setDw({ from: pendRef.current.terminal, fromPos: pendRef.current.pos, bendPoints: [], mode: "drag" });
                pendRef.current = null;
            }
        }
    }, [dw, getWorldPos, scale]);

    const onTermMD = useCallback((terminal: Terminal, pos: { x: number; y: number }, _e: Konva.KonvaEventObject<MouseEvent>) => {
        if (ctx.visible) { closeCtx(); return; }
        if (dw) {
            if (!termsEq(dw.from, terminal)) setWires(p => [...p, { uuid: crypto.randomUUID(), from: dw.from, to: terminal, bendPoints: [...dw.bendPoints] }]);
            setDw(null); pendRef.current = null; return;
        }
        const mp = getWorldPos();
        pendRef.current = { terminal, pos, ms: mp || pos };
    }, [dw, ctx.visible, closeCtx, getWorldPos]);

    const onItemClick = useCallback((uuid: string) => { if (dw) return; setSelectedItem(prev => prev === uuid ? null : uuid); }, [dw]);

    /** Snap items on drag end */
    const onItemDragEnd = useCallback((uuid: string) => {
        if (!snapEnabled) return;
        setItems(p => p.map(it => it.uuid === uuid ? { ...it, x: snap(it.x), y: snap(it.y) } : it));
    }, [snapEnabled, snap]);

    const onStageMouseUp = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
        if (shiftBendRef.current) { shiftBendRef.current = false; return; }
        if (pendRef.current) {
            setDw({ from: pendRef.current.terminal, fromPos: pendRef.current.pos, bendPoints: [], mode: "click" });
            pendRef.current = null; return;
        }
        if (dw && dw.mode === "drag") {
            const p = getWorldPos();
            if (!p || !completeWireAt(p.x, p.y, dw)) setDw(null);
        }
    }, [dw, completeWireAt, getWorldPos]);

    const onStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (ctx.visible) { closeCtx(); return; }
        if (!dw || dw.mode !== "click") return;
        const p = getWorldPos(); if (!p) return;
        if (findTermAt(p.x, p.y, 15 / scale)) return;
        if (completeWireAt(p.x, p.y, dw)) return;
        const sp = snapPt(p);
        setDw(prev => prev ? { ...prev, bendPoints: [...prev.bendPoints, sp] } : prev);
    }, [dw, ctx.visible, closeCtx, completeWireAt, findTermAt, getWorldPos, scale, snapPt]);

    const onStageMD = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (dw && dw.mode === "drag" && e.evt.shiftKey) {
            const p = getWorldPos();
            if (p) { shiftBendRef.current = true; const sp = snapPt(p); setDw(prev => prev ? { ...prev, bendPoints: [...prev.bendPoints, sp] } : prev); }
        }
    }, [dw, getWorldPos, snapPt]);

    const onStageCtxMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        if (dw) { setDw(null); return; }
        const p = getWorldPos(); if (!p) return;
        const sp = snapPt(p);
        const wh = findWireAt(p.x, p.y, 10 / scale);
        const ci = items.find(it => Math.hypot(p.x - (it.x + 50), p.y - (it.y + 25)) < 55);
        const mi: ContextMenuItem[] = [];
        mi.push({ label: "➕ 저항 추가", onClick: () => setItems(pr => [...pr, { uuid: crypto.randomUUID(), x: sp.x - 50, y: sp.y - 25, rotation: 0, connectedA: null, connectedB: null, type: "resistor", value: 100 }]) });
        mi.push({ label: "🔋 전지 추가", onClick: () => setItems(pr => [...pr, { uuid: crypto.randomUUID(), x: sp.x - 50, y: sp.y - 25, rotation: 0, connectedA: null, connectedB: null, type: "battery", value: 5 }]) });
        if (ci) mi.push({ label: "🗑️ 부품 삭제", onClick: () => { setItems(pr => pr.filter(i => i.uuid !== ci.uuid)); setWires(pr => pr.filter(w => !((w.from.type === "item" && w.from.itemUuid === ci.uuid) || (w.to.type === "item" && w.to.itemUuid === ci.uuid)))); if (selectedItem === ci.uuid) setSelectedItem(null); } });
        if (wh) {
            mi.push({ label: "✂️ 선 삭제", onClick: () => setWires(pr => pr.filter(w => w.uuid !== wh.wire.uuid)) });
            mi.push({ label: "📌 노드 추가", onClick: () => setWires(pr => pr.map(w => { if (w.uuid !== wh.wire.uuid) return w; const bp = [...w.bendPoints]; bp.splice(wh.si, 0, sp); return { ...w, bendPoints: bp }; })) });
        }
        setCtx({ visible: true, x: p.x, y: p.y, items: mi });
    }, [dw, findWireAt, items, selectedItem, getWorldPos, scale, snapPt]);

    const onBPCtx = useCallback((wid: string, bi: number, e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault(); e.cancelBubble = true;
        if (dw) { setDw(null); return; }
        const wire = wires.find(w => w.uuid === wid); if (!wire) return;
        const bp = wire.bendPoints[bi];
        setCtx({ visible: true, x: bp.x, y: bp.y, items: [
            { label: "🔗 선 연결 시작", onClick: () => {
                const nn: WireNode = { uuid: crypto.randomUUID(), x: bp.x, y: bp.y };
                const nt: Terminal = { type: "node", nodeUuid: nn.uuid };
                setNodes(p => [...p, nn]);
                setWires(p => [...p.filter(w => w.uuid !== wire.uuid),
                    { uuid: crypto.randomUUID(), from: wire.from, to: nt, bendPoints: wire.bendPoints.slice(0, bi) },
                    { uuid: crypto.randomUUID(), from: nt, to: wire.to, bendPoints: wire.bendPoints.slice(bi + 1) }]);
                setDw({ from: nt, fromPos: { x: bp.x, y: bp.y }, bendPoints: [], mode: "click" });
            }},
            { label: "🗑️ 노드 삭제", onClick: () => setWires(p => p.map(w => { if (w.uuid !== wid) return w; const nb = [...w.bendPoints]; nb.splice(bi, 1); return { ...w, bendPoints: nb }; })) },
        ]});
    }, [dw, wires]);

    const onNodeCtx = useCallback((node: WireNode, e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault(); e.cancelBubble = true;
        if (dw) { setDw(null); return; }
        const nt: Terminal = { type: "node", nodeUuid: node.uuid };
        setCtx({ visible: true, x: node.x, y: node.y, items: [
            { label: "🔗 선 연결 시작", onClick: () => setDw({ from: nt, fromPos: { x: node.x, y: node.y }, bendPoints: [], mode: "click" }) },
            { label: "🗑️ 노드 삭제", onClick: () => { setNodes(p => p.filter(n => n.uuid !== node.uuid)); setWires(p => p.filter(w => !((w.from.type === "node" && w.from.nodeUuid === node.uuid) || (w.to.type === "node" && w.to.nodeUuid === node.uuid)))); } },
        ]});
    }, [dw]);

    const onNodeClick = useCallback((node: WireNode, e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        if (ctx.visible) { closeCtx(); return; }
        if (!dw) return;
        const t: Terminal = { type: "node", nodeUuid: node.uuid };
        if (termsEq(dw.from, t)) { setDw(null); return; }
        setWires(p => [...p, { uuid: crypto.randomUUID(), from: dw.from, to: t, bendPoints: [...dw.bendPoints] }]);
        setDw(null);
    }, [dw, ctx.visible, closeCtx]);

    /** Snap bend point on drag end */
    const onBPDragEnd = useCallback((wid: string, bi: number) => {
        if (!snapEnabled) return;
        setWires(p => p.map(w => { if (w.uuid !== wid) return w; const nb = [...w.bendPoints]; nb[bi] = snapPt(nb[bi]); return { ...w, bendPoints: nb }; }));
    }, [snapEnabled, snapPt]);

    /** Snap node on drag end */
    const onNodeDragEnd = useCallback((nid: string) => {
        if (!snapEnabled) return;
        setNodes(p => p.map(n => n.uuid === nid ? snapPt(n) as WireNode : n));
        setNodes(p => p.map(n => n.uuid === nid ? { ...n, ...snapPt(n) } : n));
    }, [snapEnabled, snapPt]);

    const wirePts = useCallback((w: Wire) => {
        const fp = resolvePos(w.from), tp = resolvePos(w.to); if (!fp || !tp) return [];
        const pts = [fp.x, fp.y]; for (const b of w.bendPoints) pts.push(b.x, b.y); pts.push(tp.x, tp.y); return pts;
    }, [resolvePos]);

    const drawPts = useCallback(() => {
        if (!dw) return []; const fp = resolvePos(dw.from); if (!fp) return [];
        const pts = [fp.x, fp.y]; for (const b of dw.bendPoints) pts.push(b.x, b.y); pts.push(mpos.x, mpos.y); return pts;
    }, [dw, resolvePos, mpos]);

    const selItem = selectedItem ? items.find(i => i.uuid === selectedItem) : null;
    if (dims.w === 0) return null;

    return (
        <>
        <Stage width={dims.w} height={dims.h} ref={stageRef}
            scaleX={scale} scaleY={scale} x={stagePos.x} y={stagePos.y}
            draggable={!dw && !pendRef.current}
            onDragEnd={(e) => { if (e.target === stageRef.current) setStagePos({ x: e.target.x(), y: e.target.y() }); }}
            onWheel={onWheel}
            onPointerMove={onPointerMove} onClick={onStageClick}
            onMouseDown={onStageMD} onMouseUp={onStageMouseUp} onContextMenu={onStageCtxMenu}>

            {/* Grid layer (behind everything) */}
            <Layer listening={false}>
                <Rect x={-stagePos.x / scale} y={-stagePos.y / scale} width={dims.w / scale} height={dims.h / scale} fill="#fafafa" />
                <GridBackground width={dims.w} height={dims.h} gridSize={gridSize} scale={scale} stageX={stagePos.x} stageY={stagePos.y} mode={gridMode} />
            </Layer>

            {/* Main content layer */}
            <Layer>
                {wires.map(w => { const p = wirePts(w); return p.length >= 4 ? <Line key={w.uuid} points={p} stroke="#333" strokeWidth={3 / scale} lineCap="round" lineJoin="round" hitStrokeWidth={16 / scale} /> : null; })}

                {wires.map(w => w.bendPoints.map((bp, i) => (
                    <Circle key={`${w.uuid}-bp-${i}`} x={bp.x} y={bp.y} radius={6 / scale} fill="#4f7cff" stroke="#2952cc" strokeWidth={2 / scale}
                        draggable={!dw}
                        onDragMove={e => setWires(p => p.map(ww => { if (ww.uuid !== w.uuid) return ww; const nb = [...ww.bendPoints]; nb[i] = { x: e.target.x(), y: e.target.y() }; return { ...ww, bendPoints: nb }; }))}
                        onDragEnd={() => onBPDragEnd(w.uuid, i)}
                        onContextMenu={e => onBPCtx(w.uuid, i, e)} onClick={e => { e.cancelBubble = true; }}
                        onMouseEnter={e => { (e.target as any).radius(9 / scale); e.target.getLayer()?.batchDraw(); }}
                        onMouseLeave={e => { (e.target as any).radius(6 / scale); e.target.getLayer()?.batchDraw(); }} />
                )))}

                {nodes.map(n => (
                    <Circle key={`n-${n.uuid}`} x={n.x} y={n.y} radius={8 / scale} fill="#22c55e" stroke="#15803d" strokeWidth={2 / scale}
                        draggable={!dw}
                        onDragMove={e => setNodes(p => p.map(nd => nd.uuid === n.uuid ? { ...nd, x: e.target.x(), y: e.target.y() } : nd))}
                        onDragEnd={() => onNodeDragEnd(n.uuid)}
                        onContextMenu={e => onNodeCtx(n, e)} onClick={e => onNodeClick(n, e)}
                        onMouseEnter={e => { (e.target as any).radius(11 / scale); e.target.getLayer()?.batchDraw(); }}
                        onMouseLeave={e => { (e.target as any).radius(8 / scale); e.target.getLayer()?.batchDraw(); }} />
                ))}

                {dw && (() => { const p = drawPts(); return p.length >= 4 ? <Line points={p} stroke="#999" strokeWidth={2 / scale} dash={[8 / scale, 4 / scale]} lineCap="round" lineJoin="round" /> : null; })()}
                {dw && dw.bendPoints.map((b, i) => <Circle key={`db-${i}`} x={b.x} y={b.y} radius={4 / scale} fill="#666" />)}

                {items.filter(i => i.type === "resistor").map(it => (
                    <Resistor key={it.uuid} uuid={it.uuid} x={it.x} y={it.y} rotation={it.rotation} value={it.value ?? 100}
                        items={items} setItems={setItems} drawingWire={dw} onTerminalMouseDown={onTermMD} onBodyClick={onItemClick}
                        selected={selectedItem === it.uuid} onDragEnd={onItemDragEnd} />
                ))}
                {items.filter(i => i.type === "battery").map(it => (
                    <Battery key={it.uuid} uuid={it.uuid} x={it.x} y={it.y} rotation={it.rotation} value={it.value ?? 5}
                        items={items} setItems={setItems} drawingWire={dw} onTerminalMouseDown={onTermMD} onBodyClick={onItemClick}
                        selected={selectedItem === it.uuid} onDragEnd={onItemDragEnd} />
                ))}

                {ctx.visible && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={closeCtx} />}
            </Layer>
        </Stage>
        {selItem && <PropertyPanel item={selItem} setItems={setItems} onClose={() => setSelectedItem(null)} />}
        <GridSettings gridSize={gridSize} setGridSize={setGridSize} gridMode={gridMode} setGridMode={setGridMode} snapEnabled={snapEnabled} setSnapEnabled={setSnapEnabled} scale={scale} onShowHelp={() => setShowHelp(true)} />
        {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
        </>
    );
}

export default CircuitSim;