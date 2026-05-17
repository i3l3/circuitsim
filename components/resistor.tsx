"use client";

import {Circle, Group, Rect} from "react-konva";
import {Dispatch, SetStateAction, useRef, useState} from "react";
import {ClickEvent, Item} from "@/components/circuitsim";
import Konva from "konva";
import KonvaEventObject = Konva.KonvaEventObject;

const Resistor = ({
        uuid, x, y, clicked, setClicked, items, setItems
    }: {
        uuid: string,
        x: number,
        y: number,
        clicked: ClickEvent,
        setClicked: Dispatch<SetStateAction<ClickEvent>>,
        items: Item[],
        setItems: Dispatch<SetStateAction<Item[]>>,
    }) => {
    const [onA, setOnA] = useState(false);
    const [onB, setOnB] = useState(false);
    const [radiusA, setRadiusA] = useState(5);
    const [radiusB, setRadiusB] = useState(5);
    const dragStartPos = useRef({ x: 0, y: 0 });

    const handlePointerMoveA = () => {
        setRadiusA(10);
        setOnA(true);
    };
    const handlePointerMoveB = () => {
        setRadiusB(10);
        setOnB(true);
    };
    const handlePointerMoveAOut = () => {
        setRadiusA(5);
        setOnA(false);
    }
    const handlePointerMoveBOut = () => {
        setRadiusB(5);
        setOnB(false);
    }
    const handleMouseDownA = () => {
        if (!clicked.clicked) {
            setClicked({ clicked: true, x: x, y: y + 25 });
        } else if (clicked.clicked) {
            setClicked({ clicked: false, x: 0, y: 0 });
        }
        console.log('a')
    }
    const handleMouseDownB = () => {
        if (!clicked.clicked) {
            setClicked({ clicked: true, x: x + 100, y: y + 25 });
        } else if (clicked.clicked) {
            setClicked({ clicked: false, x: 0, y: 0 });
        }
        console.log('b')
    }
    const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
        dragStartPos.current = {
            x: e.target.x(),
            y: e.target.y()
        };
    };
    const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
        const currentX = e.target.x();
        const currentY = e.target.y();

        const deltaX = currentX - dragStartPos.current.x;
        const deltaY = currentY - dragStartPos.current.y;

        setItems(prevResistors => prevResistors.map(resistor => {
            if (resistor.uuid === uuid) {
                return {
                    ...resistor,
                    x: resistor.x + deltaX,
                    y: resistor.y + deltaY
                };
            }
            return resistor;
        }));

        dragStartPos.current = { x: currentX, y: currentY };
    };

    return (
        <Group x={x} y={y} draggable={!onA && !onB && !clicked.clicked} onDragStart={handleDragStart} onDragMove={handleDragMove}>
            <Rect x={0} y={0} width={100} height={50} fill="green" />
            <Circle x={0} y={25} radius={radiusA} fill="red" onPointerMove={handlePointerMoveA} onPointerOut={handlePointerMoveAOut} onMouseDown={handleMouseDownA} />
            <Circle x={100} y={25} radius={radiusB} fill="red" onPointerMove={handlePointerMoveB} onPointerOut={handlePointerMoveBOut} onMouseDown={handleMouseDownB} />
        </Group>
    )
}

export default Resistor;