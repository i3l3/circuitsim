"use client";

import {Circle, Group, Line, Rect} from "react-konva";
import {Dispatch, SetStateAction, useRef, useState} from "react";
import {ClickEvent, DrawingWire, Item, Terminal} from "@/components/circuitsim";
import Konva from "konva";

/** Standard US-style zigzag resistor symbol points (relative to group origin).
 *  Total width: 100px, centered vertically at y=25.
 *  Lead lines on each side, zigzag body in the center.
 */
const ZIGZAG_POINTS = [
    0, 25,    // left terminal
    20, 25,   // start of body
    25, 8,    // peak up
    35, 42,   // valley down
    45, 8,    // peak up
    55, 42,   // valley down
    65, 8,    // peak up
    75, 42,   // valley down
    80, 25,   // end of body
    100, 25,  // right terminal
];

const Resistor = ({
        uuid, x, y, clicked, setClicked, items, setItems, drawingWire, onTerminalClick
    }: {
        uuid: string,
        x: number,
        y: number,
        clicked: ClickEvent,
        setClicked: Dispatch<SetStateAction<ClickEvent>>,
        items: Item[],
        setItems: Dispatch<SetStateAction<Item[]>>,
        drawingWire: DrawingWire | null,
        onTerminalClick: (terminal: Terminal, pos: { x: number; y: number }) => void,
    }) => {
    const [onA, setOnA] = useState(false);
    const [onB, setOnB] = useState(false);
    const [radiusA, setRadiusA] = useState(5);
    const [radiusB, setRadiusB] = useState(5);
    const dragStartPos = useRef({ x: 0, y: 0 });

    const isDrawing = drawingWire !== null;

    const handlePointerMoveA = () => { setRadiusA(10); setOnA(true); };
    const handlePointerMoveB = () => { setRadiusB(10); setOnB(true); };
    const handlePointerMoveAOut = () => { setRadiusA(5); setOnA(false); };
    const handlePointerMoveBOut = () => { setRadiusB(5); setOnB(false); };

    const handleClickA = (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        const terminal: Terminal = { type: "item", itemUuid: uuid, side: "A" };
        onTerminalClick(terminal, { x: x, y: y + 25 });
    };
    const handleClickB = (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        const terminal: Terminal = { type: "item", itemUuid: uuid, side: "B" };
        onTerminalClick(terminal, { x: x + 100, y: y + 25 });
    };

    const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
        dragStartPos.current = { x: e.target.x(), y: e.target.y() };
    };
    const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
        const currentX = e.target.x();
        const currentY = e.target.y();
        const deltaX = currentX - dragStartPos.current.x;
        const deltaY = currentY - dragStartPos.current.y;

        setItems(prev => prev.map(resistor => {
            if (resistor.uuid === uuid) {
                return { ...resistor, x: resistor.x + deltaX, y: resistor.y + deltaY };
            }
            return resistor;
        }));
        dragStartPos.current = { x: currentX, y: currentY };
    };

    const fillA = isDrawing && onA ? "#ff6666" : "red";
    const fillB = isDrawing && onB ? "#ff6666" : "red";

    return (
        <Group x={x} y={y} draggable={!onA && !onB && !isDrawing} onDragStart={handleDragStart} onDragMove={handleDragMove}>
            {/* Invisible hit area for dragging */}
            <Rect x={0} y={0} width={100} height={50} fill="transparent" />

            {/* Zigzag resistor symbol */}
            <Line
                points={ZIGZAG_POINTS}
                stroke="#333"
                strokeWidth={2.5}
                lineCap="round"
                lineJoin="round"
                listening={false}
            />

            {/* Terminal A (left) */}
            <Circle
                x={0} y={25} radius={radiusA} fill={fillA}
                onPointerMove={handlePointerMoveA}
                onPointerOut={handlePointerMoveAOut}
                onClick={handleClickA}
            />
            {/* Terminal B (right) */}
            <Circle
                x={100} y={25} radius={radiusB} fill={fillB}
                onPointerMove={handlePointerMoveB}
                onPointerOut={handlePointerMoveBOut}
                onClick={handleClickB}
            />
        </Group>
    )
}

export default Resistor;