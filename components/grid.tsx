"use client";

import { Circle, Layer, Line, Rect } from "react-konva";
import React, { useMemo } from "react";

interface GridProps {
    width: number;
    height: number;
    gridSize: number;
    scale: number;
    stageX: number;
    stageY: number;
    mode: "dots" | "lines";
}

/** Renders a grid background on its own layer. Accounts for pan/zoom. */
const GridBackground = ({ width, height, gridSize, scale, stageX, stageY, mode }: GridProps) => {
    const elements = useMemo(() => {
        if (gridSize <= 0) return [];
        // Compute visible area in world coords
        const x0 = -stageX / scale;
        const y0 = -stageY / scale;
        const x1 = x0 + width / scale;
        const y1 = y0 + height / scale;

        const startX = Math.floor(x0 / gridSize) * gridSize;
        const startY = Math.floor(y0 / gridSize) * gridSize;

        const els: React.ReactElement[] = [];

        if (mode === "dots") {
            let idx = 0;
            for (let gx = startX; gx <= x1; gx += gridSize) {
                for (let gy = startY; gy <= y1; gy += gridSize) {
                    els.push(<Circle key={idx++} x={gx} y={gy} radius={1.5 / scale} fill="#ccc" listening={false} />);
                }
            }
        } else {
            let idx = 0;
            for (let gx = startX; gx <= x1; gx += gridSize) {
                els.push(<Line key={`v${idx++}`} points={[gx, y0, gx, y1]} stroke="#e5e7eb" strokeWidth={1 / scale} listening={false} />);
            }
            for (let gy = startY; gy <= y1; gy += gridSize) {
                els.push(<Line key={`h${idx++}`} points={[x0, gy, x1, gy]} stroke="#e5e7eb" strokeWidth={1 / scale} listening={false} />);
            }
        }
        return els;
    }, [width, height, gridSize, scale, stageX, stageY, mode]);

    return <>{elements}</>;
};

export default GridBackground;
