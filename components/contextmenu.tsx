"use client";

import { Group, Rect, Text } from "react-konva";

export interface ContextMenuItem {
    label: string;
    onClick: () => void;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

const ITEM_HEIGHT = 32;
const MENU_WIDTH = 160;
const PADDING = 4;
const BORDER_RADIUS = 6;

const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
    const totalHeight = items.length * ITEM_HEIGHT + PADDING * 2;

    return (
        <Group x={x} y={y}>
            {/* Shadow */}
            <Rect
                x={2}
                y={2}
                width={MENU_WIDTH}
                height={totalHeight}
                cornerRadius={BORDER_RADIUS}
                fill="rgba(0,0,0,0.15)"
            />
            {/* Background */}
            <Rect
                width={MENU_WIDTH}
                height={totalHeight}
                cornerRadius={BORDER_RADIUS}
                fill="#ffffff"
                stroke="#d1d5db"
                strokeWidth={1}
            />
            {/* Menu items */}
            {items.map((item, i) => (
                <Group key={i} y={PADDING + i * ITEM_HEIGHT}>
                    {/* Hover rect */}
                    <Rect
                        x={PADDING}
                        width={MENU_WIDTH - PADDING * 2}
                        height={ITEM_HEIGHT}
                        cornerRadius={4}
                        fill="transparent"
                        onMouseEnter={(e) => {
                            const target = e.target as any;
                            target.fill("#f3f4f6");
                            target.getLayer()?.batchDraw();
                            const container = target.getStage()?.container();
                            if (container) container.style.cursor = "pointer";
                        }}
                        onMouseLeave={(e) => {
                            const target = e.target as any;
                            target.fill("transparent");
                            target.getLayer()?.batchDraw();
                            const container = target.getStage()?.container();
                            if (container) container.style.cursor = "default";
                        }}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            item.onClick();
                            onClose();
                        }}
                    />
                    {/* Label */}
                    <Text
                        x={PADDING + 12}
                        y={ITEM_HEIGHT / 2 - 6}
                        text={item.label}
                        fontSize={13}
                        fontFamily="'Segoe UI', sans-serif"
                        fill="#1f2937"
                        listening={false}
                    />
                </Group>
            ))}
        </Group>
    );
};

export default ContextMenu;
