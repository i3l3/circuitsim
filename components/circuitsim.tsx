"use client";

import {Circle, Group, Layer, Line, Rect, Stage, Text} from "react-konva";
import {useCallback, useEffect, useRef, useState} from "react";
import Konva from "konva";
import Resistor from "@/components/resistor";
import ContextMenu, {ContextMenuItem} from "@/components/contextmenu";

export interface Item {
    uuid: string;
    x: number;
    y: number;
    connectedA: string | null;
    connectedB: string | null;
    type: "resistor";
}

export interface Point {
    uuid: string;
    x: number;
    y: number;
}

export interface ClickEvent {
    clicked: boolean;
    x: number;
    y: number;
}

/** Identifies a specific terminal on a component or a junction node */
export type Terminal =
    | { type: "item"; itemUuid: string; side: "A" | "B" }
    | { type: "node"; nodeUuid: string };

/** Junction node — a standalone point that wires can connect to */
export interface WireNode {
    uuid: string;
    x: number;
    y: number;
}

/** A wire connecting two terminals, with optional bend points */
export interface Wire {
    uuid: string;
    from: Terminal;
    to: Terminal;
    bendPoints: { x: number; y: number }[];
}

/** State while actively drawing a wire */
export interface DrawingWire {
    from: Terminal;
    fromPos: { x: number; y: number };
    bendPoints: { x: number; y: number }[];
}

/** Context menu state */
interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
}

/** Check if two terminals are the same */
function terminalsEqual(a: Terminal, b: Terminal): boolean {
    if (a.type === "item" && b.type === "item") {
        return a.itemUuid === b.itemUuid && a.side === b.side;
    }
    if (a.type === "node" && b.type === "node") {
        return a.nodeUuid === b.nodeUuid;
    }
    return false;
}

/** Helper: distance from point P to line segment AB */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return Math.hypot(px - projX, py - projY);
}

const CircuitSim = () => {
    const [dimensions, setDimensions] = useState(() => {
        if (typeof window !== "undefined") {
            return { width: window.innerWidth, height: window.innerHeight };
        }
        return { width: 0, height: 0 };
    });
    const [items, setItems] = useState<Item[]>([
        {uuid: crypto.randomUUID(), x: 50, y: 100, connectedA: null, connectedB: null, type: "resistor"},
        {uuid: crypto.randomUUID(), x: 70, y: 200, connectedA: null, connectedB: null, type: "resistor"},
    ]);
    const [points, setPoints] = useState<Point[]>([]);
    const [clicked, setClicked] = useState<ClickEvent>({ clicked: false, x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [wires, setWires] = useState<Wire[]>([]);
    const [nodes, setNodes] = useState<WireNode[]>([]);
    const [drawingWire, setDrawingWire] = useState<DrawingWire | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, items: [] });

    const stageRef = useRef<Konva.Stage>(null);
    const backgroundRef = useRef<Konva.Rect>(null);

    /** Resolve terminal position */
    const resolveTerminalPos = useCallback((terminal: Terminal): { x: number; y: number } | null => {
        if (terminal.type === "item") {
            const item = items.find(i => i.uuid === terminal.itemUuid);
            if (!item) return null;
            if (terminal.side === "A") return { x: item.x, y: item.y + 25 };
            return { x: item.x + 100, y: item.y + 25 };
        } else {
            const node = nodes.find(n => n.uuid === terminal.nodeUuid);
            if (!node) return null;
            return { x: node.x, y: node.y };
        }
    }, [items, nodes]);

    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (stageRef.current) {
            const container = stageRef.current.container();
            container.style.backgroundColor = 'green';
        }
    }, []);

    const handleDragMove = () => {
        if (backgroundRef.current) {
            backgroundRef.current.absolutePosition({ x: 0, y: 0 });
        }
    };

    const handleStagePointerMove = () => {
        if (!stageRef.current) return;
        const pos = stageRef.current.getPointerPosition();
        if (pos) setMousePos({ x: pos.x, y: pos.y });
    };

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, []);

    /** Find wire closest to a point */
    const findWireAtPos = useCallback((px: number, py: number, threshold: number = 8): { wire: Wire; segmentIndex: number } | null => {
        let bestDist = Infinity;
        let bestResult: { wire: Wire; segmentIndex: number } | null = null;

        for (const wire of wires) {
            const fromPos = resolveTerminalPos(wire.from);
            const toPos = resolveTerminalPos(wire.to);
            if (!fromPos || !toPos) continue;

            const allPts = [fromPos, ...wire.bendPoints, toPos];
            for (let i = 0; i < allPts.length - 1; i++) {
                const d = distToSegment(px, py, allPts[i].x, allPts[i].y, allPts[i + 1].x, allPts[i + 1].y);
                if (d < bestDist) {
                    bestDist = d;
                    bestResult = { wire, segmentIndex: i };
                }
            }
        }
        if (bestDist <= threshold && bestResult) return bestResult;
        return null;
    }, [wires, resolveTerminalPos]);

    /** Called from any terminal click (item terminal or node) */
    const handleTerminalClick = (terminal: Terminal, pos: { x: number; y: number }) => {
        if (contextMenu.visible) { closeContextMenu(); return; }

        if (!drawingWire) {
            setDrawingWire({ from: terminal, fromPos: pos, bendPoints: [] });
        } else {
            if (terminalsEqual(drawingWire.from, terminal)) {
                setDrawingWire(null);
                return;
            }
            const newWire: Wire = {
                uuid: crypto.randomUUID(),
                from: drawingWire.from,
                to: terminal,
                bendPoints: [...drawingWire.bendPoints],
            };
            setWires(prev => [...prev, newWire]);
            setDrawingWire(null);
        }
    };

    /** Stage click */
    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (contextMenu.visible) { closeContextMenu(); return; }
        if (!drawingWire) return;

        if (e.evt.shiftKey) {
            if (!stageRef.current) return;
            const pos = stageRef.current.getPointerPosition();
            if (pos) {
                setDrawingWire(prev => prev ? { ...prev, bendPoints: [...prev.bendPoints, { x: pos.x, y: pos.y }] } : prev);
            }
        } else {
            const target = e.target;
            if (target === backgroundRef.current || target === stageRef.current) {
                setDrawingWire(null);
            }
        }
    };

    /** Right-click context menu */
    const handleStageContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        if (drawingWire) { setDrawingWire(null); return; }
        if (!stageRef.current) return;
        const pos = stageRef.current.getPointerPosition();
        if (!pos) return;

        const wireHit = findWireAtPos(pos.x, pos.y, 10);
        const clickedItem = items.find(item =>
            pos.x >= item.x && pos.x <= item.x + 100 && pos.y >= item.y && pos.y <= item.y + 50
        );

        const menuItems: ContextMenuItem[] = [];

        menuItems.push({
            label: "➕ 저항 추가",
            onClick: () => {
                setItems(prev => [...prev, {
                    uuid: crypto.randomUUID(), x: pos.x - 50, y: pos.y - 25,
                    connectedA: null, connectedB: null, type: "resistor",
                }]);
            },
        });

        if (clickedItem) {
            menuItems.push({
                label: "🗑️ 저항 삭제",
                onClick: () => {
                    setItems(prev => prev.filter(i => i.uuid !== clickedItem.uuid));
                    setWires(prev => prev.filter(w => {
                        const fromIsItem = w.from.type === "item" && w.from.itemUuid === clickedItem.uuid;
                        const toIsItem = w.to.type === "item" && w.to.itemUuid === clickedItem.uuid;
                        return !fromIsItem && !toIsItem;
                    }));
                },
            });
        }

        if (wireHit) {
            menuItems.push({
                label: "✂️ 선 삭제",
                onClick: () => setWires(prev => prev.filter(w => w.uuid !== wireHit.wire.uuid)),
            });
            menuItems.push({
                label: "📌 노드 추가",
                onClick: () => {
                    setWires(prev => prev.map(w => {
                        if (w.uuid !== wireHit.wire.uuid) return w;
                        const newBP = [...w.bendPoints];
                        newBP.splice(wireHit.segmentIndex, 0, { x: pos.x, y: pos.y });
                        return { ...w, bendPoints: newBP };
                    }));
                },
            });
        }

        setContextMenu({ visible: true, x: pos.x, y: pos.y, items: menuItems });
    };

    /** Right-click on a bend point → split wire, create node, start drawing */
    const handleBendPointContextMenu = (wireUuid: string, bpIndex: number, e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        if (drawingWire) { setDrawingWire(null); return; }

        const wire = wires.find(w => w.uuid === wireUuid);
        if (!wire) return;
        const bp = wire.bendPoints[bpIndex];

        const menuItems: ContextMenuItem[] = [
            {
                label: "🔗 선 연결 시작",
                onClick: () => {
                    // Create a junction node at this bend point
                    const newNode: WireNode = { uuid: crypto.randomUUID(), x: bp.x, y: bp.y };
                    setNodes(prev => [...prev, newNode]);

                    // Split wire into two at this bend point
                    const bendsBefore = wire.bendPoints.slice(0, bpIndex);
                    const bendsAfter = wire.bendPoints.slice(bpIndex + 1);
                    const nodeTerminal: Terminal = { type: "node", nodeUuid: newNode.uuid };

                    const wire1: Wire = { uuid: crypto.randomUUID(), from: wire.from, to: nodeTerminal, bendPoints: bendsBefore };
                    const wire2: Wire = { uuid: crypto.randomUUID(), from: nodeTerminal, to: wire.to, bendPoints: bendsAfter };

                    setWires(prev => [...prev.filter(w => w.uuid !== wire.uuid), wire1, wire2]);

                    // Start drawing from the new node
                    setDrawingWire({ from: nodeTerminal, fromPos: { x: bp.x, y: bp.y }, bendPoints: [] });
                },
            },
            {
                label: "🗑️ 노드 삭제",
                onClick: () => {
                    setWires(prev => prev.map(w => {
                        if (w.uuid !== wireUuid) return w;
                        const newBP = [...w.bendPoints];
                        newBP.splice(bpIndex, 1);
                        return { ...w, bendPoints: newBP };
                    }));
                },
            },
        ];
        setContextMenu({ visible: true, x: bp.x, y: bp.y, items: menuItems });
    };

    /** Right-click on an existing WireNode */
    const handleNodeContextMenu = (node: WireNode, e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        if (drawingWire) { setDrawingWire(null); return; }

        const nodeTerminal: Terminal = { type: "node", nodeUuid: node.uuid };
        const menuItems: ContextMenuItem[] = [
            {
                label: "🔗 선 연결 시작",
                onClick: () => {
                    setDrawingWire({ from: nodeTerminal, fromPos: { x: node.x, y: node.y }, bendPoints: [] });
                },
            },
            {
                label: "🗑️ 노드 삭제",
                onClick: () => {
                    setNodes(prev => prev.filter(n => n.uuid !== node.uuid));
                    setWires(prev => prev.filter(w => {
                        const fromIsNode = w.from.type === "node" && w.from.nodeUuid === node.uuid;
                        const toIsNode = w.to.type === "node" && w.to.nodeUuid === node.uuid;
                        return !fromIsNode && !toIsNode;
                    }));
                },
            },
        ];
        setContextMenu({ visible: true, x: node.x, y: node.y, items: menuItems });
    };

    /** Click on a WireNode during drawing mode → complete wire */
    const handleNodeClick = (node: WireNode, e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        if (contextMenu.visible) { closeContextMenu(); return; }
        const terminal: Terminal = { type: "node", nodeUuid: node.uuid };
        handleTerminalClick(terminal, { x: node.x, y: node.y });
    };

    /** Drag a bend point */
    const handleBendPointDragMove = (wireUuid: string, bpIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
        const newX = e.target.x();
        const newY = e.target.y();
        setWires(prev => prev.map(w => {
            if (w.uuid !== wireUuid) return w;
            const newBP = [...w.bendPoints];
            newBP[bpIndex] = { x: newX, y: newY };
            return { ...w, bendPoints: newBP };
        }));
    };

    /** Drag a WireNode */
    const handleNodeDragMove = (nodeUuid: string, e: Konva.KonvaEventObject<DragEvent>) => {
        const newX = e.target.x();
        const newY = e.target.y();
        setNodes(prev => prev.map(n => n.uuid === nodeUuid ? { ...n, x: newX, y: newY } : n));
    };

    /** Build flat points for a completed wire */
    const getWirePoints = (wire: Wire): number[] => {
        const fromPos = resolveTerminalPos(wire.from);
        const toPos = resolveTerminalPos(wire.to);
        if (!fromPos || !toPos) return [];
        const pts: number[] = [fromPos.x, fromPos.y];
        for (const bp of wire.bendPoints) pts.push(bp.x, bp.y);
        pts.push(toPos.x, toPos.y);
        return pts;
    };

    /** Build flat points for drawing preview */
    const getDrawingWirePoints = (): number[] => {
        if (!drawingWire) return [];
        const fromPos = resolveTerminalPos(drawingWire.from);
        if (!fromPos) return [];
        const pts: number[] = [fromPos.x, fromPos.y];
        for (const bp of drawingWire.bendPoints) pts.push(bp.x, bp.y);
        pts.push(mousePos.x, mousePos.y);
        return pts;
    };

    if (dimensions.width === 0) return null;

    return (
        <Stage
            width={window.innerWidth}
            height={window.innerHeight}
            ref={stageRef}
            onDragMove={handleDragMove}
            onPointerMove={handleStagePointerMove}
            onClick={handleStageClick}
            onContextMenu={handleStageContextMenu}
        >
            <Layer>
                <Rect ref={backgroundRef} width={dimensions.width} height={dimensions.height} fill="white" />
                <Text text="우클릭: 메뉴 | 빨간 점 클릭: 선 연결 | Shift+클릭: 꺾기" fontSize={13} fill="#888" />

                {/* Completed wires */}
                {wires.map(wire => {
                    const pts = getWirePoints(wire);
                    if (pts.length < 4) return null;
                    return <Line key={wire.uuid} points={pts} stroke="#333" strokeWidth={3} lineCap="round" lineJoin="round" hitStrokeWidth={16} />;
                })}

                {/* Draggable bend point nodes */}
                {wires.map(wire =>
                    wire.bendPoints.map((bp, i) => (
                        <Circle
                            key={`${wire.uuid}-bp-${i}`}
                            x={bp.x} y={bp.y} radius={6}
                            fill="#4f7cff" stroke="#2952cc" strokeWidth={2}
                            draggable={!drawingWire}
                            onDragMove={(e) => handleBendPointDragMove(wire.uuid, i, e)}
                            onContextMenu={(e) => handleBendPointContextMenu(wire.uuid, i, e)}
                            onClick={(e) => { e.cancelBubble = true; }}
                            onMouseEnter={(e) => { (e.target as any).radius(9); e.target.getLayer()?.batchDraw(); const c = e.target.getStage()?.container(); if (c) c.style.cursor = "grab"; }}
                            onMouseLeave={(e) => { (e.target as any).radius(6); e.target.getLayer()?.batchDraw(); const c = e.target.getStage()?.container(); if (c) c.style.cursor = "default"; }}
                            onDragStart={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "grabbing"; }}
                            onDragEnd={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "grab"; }}
                        />
                    ))
                )}

                {/* Junction WireNodes (green) */}
                {nodes.map(node => (
                    <Circle
                        key={`node-${node.uuid}`}
                        x={node.x} y={node.y} radius={8}
                        fill="#22c55e" stroke="#15803d" strokeWidth={2}
                        draggable={!drawingWire}
                        onDragMove={(e) => handleNodeDragMove(node.uuid, e)}
                        onContextMenu={(e) => handleNodeContextMenu(node, e)}
                        onClick={(e) => handleNodeClick(node, e)}
                        onMouseEnter={(e) => { (e.target as any).radius(11); e.target.getLayer()?.batchDraw(); const c = e.target.getStage()?.container(); if (c) c.style.cursor = drawingWire ? "pointer" : "grab"; }}
                        onMouseLeave={(e) => { (e.target as any).radius(8); e.target.getLayer()?.batchDraw(); const c = e.target.getStage()?.container(); if (c) c.style.cursor = "default"; }}
                        onDragStart={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "grabbing"; }}
                        onDragEnd={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "grab"; }}
                    />
                ))}

                {/* Drawing preview */}
                {drawingWire && (() => {
                    const pts = getDrawingWirePoints();
                    if (pts.length < 4) return null;
                    return <Line points={pts} stroke="#999" strokeWidth={2} dash={[8, 4]} lineCap="round" lineJoin="round" />;
                })()}

                {drawingWire && drawingWire.bendPoints.map((bp, i) => (
                    <Circle key={`drawing-bp-${i}`} x={bp.x} y={bp.y} radius={4} fill="#666" />
                ))}

                {/* Resistors */}
                {items.filter((item) => item.type == "resistor").map((item) => (
                    <Resistor key={item.uuid}
                              uuid={item.uuid} x={item.x} y={item.y}
                              clicked={clicked} setClicked={setClicked}
                              items={items} setItems={setItems}
                              drawingWire={drawingWire}
                              onTerminalClick={handleTerminalClick}
                    />
                ))}

                {/* Context menu on top */}
                {contextMenu.visible && (
                    <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={closeContextMenu} />
                )}
            </Layer>
        </Stage>
    )
}

export default CircuitSim;