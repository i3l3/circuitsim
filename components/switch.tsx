"use client";

import {Circle, Group, Line, Rect, Text} from "react-konva";
import {Dispatch, SetStateAction, useRef, useState} from "react";
import {DrawingWire, Item, Terminal} from "@/components/circuitsim";
import Konva from "konva";

const Switch = ({ uuid, x, y, rotation, value, items, setItems, drawingWire, onTerminalMouseDown, onBodyClick, selected, onDragEnd }: {
    uuid: string; x: number; y: number; rotation: number; value: number;
    items: Item[]; setItems: Dispatch<SetStateAction<Item[]>>;
    drawingWire: DrawingWire | null;
    onTerminalMouseDown: (t: Terminal, p: { x: number; y: number }, e: Konva.KonvaEventObject<MouseEvent>) => void;
    onBodyClick: (uuid: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
    selected: boolean;
    onDragEnd: (uuid: string) => void;
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

    const isClosed = value === 1;

    return (
        <Group x={x + 50} y={y + 25} offsetX={50} offsetY={25} rotation={rotation}
               draggable={!onA && !onB && !isD} onDragStart={onDS} onDragMove={onDM}
               onDragEnd={() => onDragEnd(uuid)}>
            <Rect x={0} y={0} width={100} height={50} fill="transparent"
                  stroke={selected ? "#3b82f6" : "transparent"} strokeWidth={2} cornerRadius={4}
                  onClick={(e) => { 
                      e.cancelBubble = true; 
                      setItems(p => p.map(i => i.uuid === uuid ? { ...i, value: isClosed ? 0 : 1 } : i));
                      onBodyClick(uuid, e); 
                  }} />
            
            <Line points={[0, 25, 30, 25]} stroke="#333" strokeWidth={2.5} lineCap="round" listening={false} />
            <Line points={[70, 25, 100, 25]} stroke="#333" strokeWidth={2.5} lineCap="round" listening={false} />
            <Circle x={30} y={25} radius={3} fill="#333" listening={false} />
            <Circle x={70} y={25} radius={3} fill="#333" listening={false} />
            
            <Line points={isClosed ? [30, 25, 70, 25] : [30, 25, 65, 5]} stroke="#333" strokeWidth={2.5} lineCap="round" listening={false} />
            
            <Text x={35} y={-10} text={isClosed ? "ON" : "OFF"} fontSize={12} fill="#555" listening={false} />
            
            <Circle x={0} y={25} radius={rA} fill={isD && onA ? "#ff6666" : "red"}
                    onMouseEnter={() => { setOnA(true); setRA(8); }} onMouseLeave={() => { setOnA(false); setRA(5); }}
                    onMouseDown={mdA} />
            <Circle x={100} y={25} radius={rB} fill={isD && onB ? "#ff6666" : "red"}
                    onMouseEnter={() => { setOnB(true); setRB(8); }} onMouseLeave={() => { setOnB(false); setRB(5); }}
                    onMouseDown={mdB} />
        </Group>
    );
};

export default Switch;
