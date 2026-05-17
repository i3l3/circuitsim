"use client";

interface GridSettingsProps {
    gridSize: number;
    setGridSize: (v: number) => void;
    gridMode: "dots" | "lines";
    setGridMode: (v: "dots" | "lines") => void;
    snapEnabled: boolean;
    setSnapEnabled: (v: boolean) => void;
    scale: number;
    onShowHelp: () => void;
}

const GridSettings = ({ gridSize, setGridSize, gridMode, setGridMode, snapEnabled, setSnapEnabled, scale, onShowHelp }: GridSettingsProps) => {
    return (
        <div style={{
            position: "fixed", bottom: 16, left: 16, padding: "12px 16px",
            background: "#fff", color: "#000", border: "1px solid #d1d5db", borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)", zIndex: 1000, fontFamily: "sans-serif", fontSize: 13,
            display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label>격자 크기:</label>
                <select value={gridSize} onChange={e => setGridSize(Number(e.target.value))}
                    style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #ccc" }}>
                    {[10, 15, 20, 25, 30, 40, 50].map(v => <option key={v} value={v}>{v}px</option>)}
                </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label>배경:</label>
                <select value={gridMode} onChange={e => setGridMode(e.target.value as "dots" | "lines")}
                    style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #ccc" }}>
                    <option value="dots">점</option>
                    <option value="lines">격자선</option>
                </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label>
                    <input type="checkbox" checked={snapEnabled} onChange={e => setSnapEnabled(e.target.checked)} />
                    {" "}스냅
                </label>
            </div>
            <div style={{ color: "#888" }}>
                확대: {Math.round(scale * 100)}%
            </div>
            <button onClick={onShowHelp} style={{
                padding: "4px 10px", background: "#f3f4f6", border: "1px solid #ccc",
                borderRadius: 4, cursor: "pointer", fontSize: 13, marginLeft: "auto"
            }}>
                ❓ 도움말
            </button>
        </div>
    );
};

export default GridSettings;
