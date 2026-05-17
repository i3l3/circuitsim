"use client";

import {Circle, Group, Layer, Line, Rect, Stage, Text} from "react-konva";
import {useEffect, useRef, useState} from "react";
import Konva from "konva";
import Resistor from "@/components/resistor";

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

const CircuitSim = () => {
    const [dimensions, setDimensions] = useState(() => {
        if (typeof window !== "undefined") {
            return { width: window.innerWidth, height: window.innerHeight };
        }
        return { width: 0, height: 0 };
    });
    const [items, setItems] = useState<Item[]>([
        {uuid: crypto.randomUUID(), x: 50, y: 100, connectedA: null, connectedB: null, type: "resistor"},
        {uuid: crypto.randomUUID(), x: 70, y: 200, connectedA: null, connectedB: null, type: "resistor"},]);
    const [points, setPoints] = useState<Point[]>([]);
    const [clicked, setClicked] = useState<ClickEvent>({ clicked: false, x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const stageRef = useRef<Konva.Stage>(null);
    const backgroundRef = useRef<Konva.Rect>(null);

    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
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
        if (pos) {
            setMousePos({ x: pos.x, y: pos.y });
        }
    };

    if (dimensions.width === 0) return null;
    
    return (
        <Stage width={window.innerWidth} height={window.innerHeight} ref={stageRef} onDragMove={handleDragMove} onPointerMove={handleStagePointerMove}>
            <Layer>
                <Rect ref={backgroundRef} width={dimensions.width} height={dimensions.height} fill="white" />
                <Text text="Try to drag shapes" fontSize={15} />
                <Rect x={20} y={50} width={100} height={100} fill="red" shadowBlur={10} draggable />
                <Circle x={200} y={100} radius={50} fill="green" draggable />
                {items.filter((item) => item.type == "resistor").map((item) => (
                    <Resistor key={item.uuid}
                              uuid={item.uuid}
                              x={item.x}
                              y={item.y}
                              clicked={clicked}
                              setClicked={setClicked}
                              items={items}
                              setItems={setItems}
                    />
                ))}

            </Layer>
        </Stage>
    )
}

export default CircuitSim;