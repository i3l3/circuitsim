"use client";

import {Circle, Layer, Line, Rect, Stage, Text} from "react-konva";
import {useCallback, useEffect, useRef, useState} from "react";
import Konva from "konva";
import Resistor from "@/components/resistor";
import Battery from "@/components/battery";
import ContextMenu, {ContextMenuItem} from "@/components/contextmenu";
import PropertyPanel from "@/components/propertypanel";

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
        { uuid: crypto.randomUUID(), x: 50, y: 100, rotation: 0, connectedA: null, connectedB: null, type: "resistor", value: 100 },
        { uuid: crypto.randomUUID(), x: 70, y: 200, rotation: 0, connectedA: null, connectedB: null, type: "resistor", value: 200 },
    ]);
    const [mpos, setMpos] = useState({ x: 0, y: 0 });
    const [wires, setWires] = useState<Wire[]>([]);
    const [nodes, setNodes] = useState<WireNode[]>([]);
    const [dw, setDw] = useState<DrawingWire | null>(null);
    const [ctx, setCtx] = useState<CtxMenuState>({ visible: false, x: 0, y: 0, items: [] });
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const stageRef = useRef<Konva.Stage>(null);
    const bgRef = useRef<Konva.Rect>(null);
    const pendRef = useRef<{ terminal: Terminal; pos: { x: number; y: number }; ms: { x: number; y: number } } | null>(null);
    // Track if shift-bend was just added in drag mode to skip mouseUp completion
    const shiftBendRef = useRef(false);

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
        const th = findTermAt(px, py, 15);
        if (th && !termsEq(drawing.from, th.terminal)) {
            setWires(p => [...p, { uuid: crypto.randomUUID(), from: drawing.from, to: th.terminal, bendPoints: [...drawing.bendPoints] }]);
            setDw(null); return true;
        }
        const wh = findWireAt(px, py, 12);
        if (wh) {
            const nn: WireNode = { uuid: crypto.randomUUID(), x: px, y: py };
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
    }, [findTermAt, findWireAt]);

    useEffect(() => { const h = () => setDims({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
    useEffect(() => { if (stageRef.current) stageRef.current.container().style.backgroundColor = "green"; }, []);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setDw(null); pendRef.current = null; setCtx(p => ({ ...p, visible: false })); setSelectedItem(null); }
            if ((e.key === "r" || e.key === "R") && !selectedItem) {
                setItems(p => p.map(it => { const cx = it.x + 50, cy = it.y + 25; return Math.hypot(mpos.x - cx, mpos.y - cy) < 60 ? { ...it, rotation: (it.rotation + 90) % 360 } : it; }));
            }
        };
        window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [mpos, selectedItem]);

    const closeCtx = useCallback(() => setCtx(p => ({ ...p, visible: false })), []);

    const onPointerMove = useCallback(() => {
        if (!stageRef.current) return;
        const p = stageRef.current.getPointerPosition(); if (!p) return;
        setMpos({ x: p.x, y: p.y });
        if (pendRef.current && !dw) {
            if (Math.hypot(p.x - pendRef.current.ms.x, p.y - pendRef.current.ms.y) > 5) {
                setDw({ from: pendRef.current.terminal, fromPos: pendRef.current.pos, bendPoints: [], mode: "drag" });
                pendRef.current = null;
            }
        }
    }, [dw]);

    /** Terminal mouseDown */
    const onTermMD = useCallback((terminal: Terminal, pos: { x: number; y: number }, _e: Konva.KonvaEventObject<MouseEvent>) => {
        if (ctx.visible) { closeCtx(); return; }
        if (dw) {
            if (!termsEq(dw.from, terminal)) setWires(p => [...p, { uuid: crypto.randomUUID(), from: dw.from, to: terminal, bendPoints: [...dw.bendPoints] }]);
            setDw(null); pendRef.current = null; return;
        }
        if (!stageRef.current) return;
        const mp = stageRef.current.getPointerPosition();
        pendRef.current = { terminal, pos, ms: mp || pos };
    }, [dw, ctx.visible, closeCtx]);

    /** Component body click → select for properties */
    const onItemClick = useCallback((uuid: string) => {
        if (dw) return; // don't select while drawing
        setSelectedItem(prev => prev === uuid ? null : uuid);
    }, [dw]);

    const onStageMouseUp = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
        if (shiftBendRef.current) { shiftBendRef.current = false; return; }
        if (pendRef.current) {
            setDw({ from: pendRef.current.terminal, fromPos: pendRef.current.pos, bendPoints: [], mode: "click" });
            pendRef.current = null; return;
        }
        if (dw && dw.mode === "drag") {
            if (!stageRef.current) { setDw(null); return; }
            const p = stageRef.current.getPointerPosition();
            if (!p || !completeWireAt(p.x, p.y, dw)) setDw(null);
        }
    }, [dw, completeWireAt]);

    /** Click mode: left-click adds bend point or completes on wire */
    const onStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (ctx.visible) { closeCtx(); return; }
        if (!dw || dw.mode !== "click") return;
        if (!stageRef.current) return;
        const p = stageRef.current.getPointerPosition(); if (!p) return;

        // Skip if near a terminal (will be handled by onTermMD)
        if (findTermAt(p.x, p.y, 15)) return;
        // Try auto-junction on wire
        if (completeWireAt(p.x, p.y, dw)) return;
        // Add bend point on any click
        setDw(prev => prev ? { ...prev, bendPoints: [...prev.bendPoints, { x: p.x, y: p.y }] } : prev);
    }, [dw, ctx.visible, closeCtx, completeWireAt, findTermAt]);

    /** Drag mode: shift+click adds bend point */
    const onStageMD = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (dw && dw.mode === "drag" && e.evt.shiftKey) {
            if (!stageRef.current) return;
            const p = stageRef.current.getPointerPosition();
            if (p) {
                shiftBendRef.current = true;
                setDw(prev => prev ? { ...prev, bendPoints: [...prev.bendPoints, { x: p.x, y: p.y }] } : prev);
            }
        }
    }, [dw]);

    const onStageCtxMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        if (dw) { setDw(null); return; }
        if (!stageRef.current) return;
        const p = stageRef.current.getPointerPosition(); if (!p) return;
        const wh = findWireAt(p.x, p.y, 10);
        const ci = items.find(it => Math.hypot(p.x - (it.x + 50), p.y - (it.y + 25)) < 55);
        const mi: ContextMenuItem[] = [];
        mi.push({ label: "➕ 저항 추가", onClick: () => setItems(pr => [...pr, { uuid: crypto.randomUUID(), x: p.x - 50, y: p.y - 25, rotation: 0, connectedA: null, connectedB: null, type: "resistor", value: 100 }]) });
        mi.push({ label: "🔋 전지 추가", onClick: () => setItems(pr => [...pr, { uuid: crypto.randomUUID(), x: p.x - 50, y: p.y - 25, rotation: 0, connectedA: null, connectedB: null, type: "battery", value: 5 }]) });
        if (ci) mi.push({ label: "🗑️ 부품 삭제", onClick: () => { setItems(pr => pr.filter(i => i.uuid !== ci.uuid)); setWires(pr => pr.filter(w => !((w.from.type === "item" && w.from.itemUuid === ci.uuid) || (w.to.type === "item" && w.to.itemUuid === ci.uuid)))); if (selectedItem === ci.uuid) setSelectedItem(null); } });
        if (wh) {
            mi.push({ label: "✂️ 선 삭제", onClick: () => setWires(pr => pr.filter(w => w.uuid !== wh.wire.uuid)) });
            mi.push({ label: "📌 노드 추가", onClick: () => setWires(pr => pr.map(w => { if (w.uuid !== wh.wire.uuid) return w; const bp = [...w.bendPoints]; bp.splice(wh.si, 0, { x: p.x, y: p.y }); return { ...w, bendPoints: bp }; })) });
        }
        setCtx({ visible: true, x: p.x, y: p.y, items: mi });
    }, [dw, findWireAt, items, selectedItem]);

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
        <Stage width={window.innerWidth} height={window.innerHeight} ref={stageRef}
            onDragMove={() => { if (bgRef.current) bgRef.current.absolutePosition({ x: 0, y: 0 }); }}
            onPointerMove={onPointerMove} onClick={onStageClick}
            onMouseDown={onStageMD} onMouseUp={onStageMouseUp} onContextMenu={onStageCtxMenu}>
            <Layer>
                <Rect ref={bgRef} width={dims.w} height={dims.h} fill="white" />
                <Text text="우클릭: 메뉴 | 빨간 점: 선 연결 | 클릭: 꺾기 | R: 회전 | ESC: 취소" fontSize={13} fill="#888" x={5} y={5} />

                {wires.map(w => { const p = wirePts(w); return p.length >= 4 ? <Line key={w.uuid} points={p} stroke="#333" strokeWidth={3} lineCap="round" lineJoin="round" hitStrokeWidth={16} /> : null; })}

                {wires.map(w => w.bendPoints.map((bp, i) => (
                    <Circle key={`${w.uuid}-bp-${i}`} x={bp.x} y={bp.y} radius={6} fill="#4f7cff" stroke="#2952cc" strokeWidth={2}
                        draggable={!dw} onDragMove={e => setWires(p => p.map(ww => { if (ww.uuid !== w.uuid) return ww; const nb = [...ww.bendPoints]; nb[i] = { x: e.target.x(), y: e.target.y() }; return { ...ww, bendPoints: nb }; }))}
                        onContextMenu={e => onBPCtx(w.uuid, i, e)} onClick={e => { e.cancelBubble = true; }}
                        onMouseEnter={e => { (e.target as any).radius(9); e.target.getLayer()?.batchDraw(); }} onMouseLeave={e => { (e.target as any).radius(6); e.target.getLayer()?.batchDraw(); }} />
                )))}

                {nodes.map(n => (
                    <Circle key={`n-${n.uuid}`} x={n.x} y={n.y} radius={8} fill="#22c55e" stroke="#15803d" strokeWidth={2}
                        draggable={!dw} onDragMove={e => setNodes(p => p.map(nd => nd.uuid === n.uuid ? { ...nd, x: e.target.x(), y: e.target.y() } : nd))}
                        onContextMenu={e => onNodeCtx(n, e)} onClick={e => onNodeClick(n, e)}
                        onMouseEnter={e => { (e.target as any).radius(11); e.target.getLayer()?.batchDraw(); }} onMouseLeave={e => { (e.target as any).radius(8); e.target.getLayer()?.batchDraw(); }} />
                ))}

                {dw && (() => { const p = drawPts(); return p.length >= 4 ? <Line points={p} stroke="#999" strokeWidth={2} dash={[8, 4]} lineCap="round" lineJoin="round" /> : null; })()}
                {dw && dw.bendPoints.map((b, i) => <Circle key={`db-${i}`} x={b.x} y={b.y} radius={4} fill="#666" />)}

                {items.filter(i => i.type === "resistor").map(it => (
                    <Resistor key={it.uuid} uuid={it.uuid} x={it.x} y={it.y} rotation={it.rotation} value={it.value ?? 100}
                        items={items} setItems={setItems} drawingWire={dw} onTerminalMouseDown={onTermMD} onBodyClick={onItemClick}
                        selected={selectedItem === it.uuid} />
                ))}
                {items.filter(i => i.type === "battery").map(it => (
                    <Battery key={it.uuid} uuid={it.uuid} x={it.x} y={it.y} rotation={it.rotation} value={it.value ?? 5}
                        items={items} setItems={setItems} drawingWire={dw} onTerminalMouseDown={onTermMD} onBodyClick={onItemClick}
                        selected={selectedItem === it.uuid} />
                ))}

                {ctx.visible && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={closeCtx} />}
            </Layer>
        </Stage>
        {selItem && <PropertyPanel item={selItem} setItems={setItems} onClose={() => setSelectedItem(null)} />}
        </>
    );
}

export default CircuitSim;