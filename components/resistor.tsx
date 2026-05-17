"use client";

import {Circle, Group, Line, Rect, Text} from "react-konva";
import {Dispatch, SetStateAction, useRef, useState} from "react";
import {DrawingWire, Item, Terminal} from "@/components/circuitsim";
import Konva from "konva";
import {formatUnit} from "@/lib/utils";

const ZZ = [0, 25, 20, 25, 25, 8, 35, 42, 45, 8, 55, 42, 65, 8, 75, 42, 80, 25, 100, 25];

const Resistor = ({ uuid, x, y, rotation, value, items, setItems, drawingWire, onTerminalMouseDown, onBodyClick, selected, onDragEnd, simCurrent, simVoltage }: {
    uuid: string; x: number; y: number; rotation: number; value: number;
    items: Item[]; setItems: Dispatch<SetStateAction<Item[]>>;
    drawingWire: DrawingWire | null;
    onTerminalMouseDown: (t: Terminal, p: { x: number; y: number }, e: Konva.KonvaEventObject<MouseEvent>) => void;
    onBodyClick: (uuid: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
    selected: boolean;
    onDragEnd: (uuid: string) => void;
    simCurrent?: number;
    simVoltage?: number;
}) => {
    const [onA, setOnA] = useState(false);
    const [onB, setOnB] = useState(false);
    const [rA, setRA] = useState(5);
    const [rB, setRB] = useState(5);
    const dsp = useRef({ x: 0, y: 0 });
    const isD = drawingWire !== null;

    const onDS = (e: Konva.KonvaEventObject<DragEvent>) => { dsp.current = { x: e.target.x(), y: e.target.y() }; };
    const onDM = (e: Konva.KonvaEventObject<DragEvent>) => {
        const cx = e.target.x(), cy = e.target.y(), dx = cx - dsp.current.x, dy = cy - dsp.current.y;
        setItems(p => p.map(it => it.uuid === uuid ? { ...it, x: it.x + dx, y: it.y + dy } : it));
        dsp.current = { x: cx, y: cy };
    };
    const mdA = (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onTerminalMouseDown({ type: "item", itemUuid: uuid, side: "A" }, { x, y: y + 25 }, e); };
    const mdB = (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onTerminalMouseDown({ type: "item", itemUuid: uuid, side: "B" }, { x: x + 100, y: y + 25 }, e); };

    return (
        <Group x={x + 50} y={y + 25} offsetX={50} offsetY={25} rotation={rotation}
               draggable={!onA && !onB && !isD} onDragStart={onDS} onDragMove={onDM}
               onDragEnd={() => onDragEnd(uuid)}>
            <Rect x={0} y={0} width={100} height={50} fill="transparent"
                  stroke={selected ? "#3b82f6" : "transparent"} strokeWidth={2} cornerRadius={4}
                  onClick={(e) => { e.cancelBubble = true; onBodyClick(uuid, e); }} />
            <Line points={ZZ} stroke="#333" strokeWidth={2.5} lineCap="round" lineJoin="round" listening={false} />
            <Text x={10} y={-14} text={formatUnit(value, "Ω")} fontSize={12} fill="#555" listening={false} />
            {simCurrent !== undefined && simVoltage !== undefined && (
                <Text x={10} y={54} 
                      text={Math.abs(simCurrent) < 1e-7 ? "전원 공급 안됨" : `${formatUnit(Math.abs(simCurrent), "A")} / ${formatUnit(Math.abs(simVoltage), "V")}`} 
                      fontSize={11} fill={Math.abs(simCurrent) < 1e-7 ? "#ef4444" : "#eab308"} listening={false} />
            )}
            <Circle x={0} y={25} radius={rA} fill={isD && onA ? "#ff6666" : "red"}
                onPointerMove={() => { setRA(10); setOnA(true); }} onPointerOut={() => { setRA(5); setOnA(false); }} onMouseDown={mdA} />
            <Circle x={100} y={25} radius={rB} fill={isD && onB ? "#ff6666" : "red"}
                onPointerMove={() => { setRB(10); setOnB(true); }} onPointerOut={() => { setRB(5); setOnB(false); }} onMouseDown={mdB} />
        </Group>
    );
}

export default Resistor;