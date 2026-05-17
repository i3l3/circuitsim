"use client";

import {Circle, Group, Line, Rect, Text} from "react-konva";
import {Dispatch, SetStateAction, useRef, useState} from "react";
import {DrawingWire, Item, Terminal} from "@/components/circuitsim";
import Konva from "konva";
import {formatUnit} from "@/lib/utils";

const Voltmeter = ({ uuid, x, y, rotation, items, setItems, drawingWire, onTerminalMouseDown, onBodyClick, selected, onDragEnd, simVoltage }: {
    uuid: string; x: number; y: number; rotation: number;
    items: Item[]; setItems: Dispatch<SetStateAction<Item[]>>;
    drawingWire: DrawingWire | null;
    onTerminalMouseDown: (t: Terminal, p: { x: number; y: number }, e: Konva.KonvaEventObject<MouseEvent>) => void;
    onBodyClick: (uuid: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
    selected: boolean;
    onDragEnd: (uuid: string) => void;
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
            
            <Line points={[0, 25, 30, 25]} stroke="#333" strokeWidth={2.5} lineCap="round" listening={false} />
            <Line points={[70, 25, 100, 25]} stroke="#333" strokeWidth={2.5} lineCap="round" listening={false} />
            
            <Circle x={50} y={25} radius={20} stroke="#333" strokeWidth={2.5} fill="#fff" listening={false} />
            <Text x={43} y={15} text="V" fontSize={22} fontStyle="bold" fill="#333" listening={false} />
            
            {simVoltage !== undefined && (
                <Text x={10} y={48} text={formatUnit(Math.abs(simVoltage), "V")} fontSize={12} fill="#eab308" listening={false} />
            )}
            
            <Circle x={0} y={25} radius={rA} fill={isD && onA ? "#ff6666" : "red"}
                    onMouseEnter={() => { setOnA(true); setRA(8); }} onMouseLeave={() => { setOnA(false); setRA(5); }}
                    onMouseDown={mdA} />
            <Circle x={100} y={25} radius={rB} fill={isD && onB ? "#ff6666" : "red"}
                    onMouseEnter={() => { setOnB(true); setRB(8); }} onMouseLeave={() => { setOnB(false); setRB(5); }}
                    onMouseDown={mdB} />
        </Group>
    );
};

export default Voltmeter;
