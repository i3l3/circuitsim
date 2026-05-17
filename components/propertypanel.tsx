"use client";
import { Item } from "@/components/circuitsim";
import { Dispatch, SetStateAction } from "react";

const PropertyPanel = ({ item, setItems, onClose }: {
    item: Item;
    setItems: Dispatch<SetStateAction<Item[]>>;
    onClose: () => void;
}) => {
    const isR = item.type === "resistor";
    const isB = item.type === "battery";
    const isS = item.type === "switch";
    const isA = item.type === "ammeter";
    const isV = item.type === "voltmeter";

    let title = "";
    if (isR) title = "⚡ 저항";
    if (isB) title = "🔋 전지";
    if (isS) title = "🎚️ 스위치";
    if (isA) title = "🅰️ 전류계";
    if (isV) title = "🇻 전압계";

    const update = (v: number) => {
        setItems(prev => prev.map(i => i.uuid === item.uuid ? { ...i, value: v } : i));
    };

    return (
        <div style={{
            position: "fixed", top: 60, right: 20, width: 220, padding: 16,
            background: "#fff", color: "#000", border: "1px solid #ccc", borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: 1000, fontFamily: "sans-serif"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <b>{title} 속성</b>
                <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            
            {(isR || isB) && (
                <>
                    <label style={{ fontSize: 13, color: "#555" }}>{isR ? "저항 (Ω)" : "전압 (V)"}</label>
                    <input type="number" value={item.value ?? (isR ? 100 : 5)} min={0} step={isR ? 10 : 0.1}
                        onChange={e => update(parseFloat(e.target.value) || 0)}
                        style={{ width: "100%", padding: 6, marginTop: 4, border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
                    />
                </>
            )}
            
            {isS && (
                <div>
                    <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 8 }}>스위치 상태</label>
                    <button 
                        onClick={() => update(item.value === 1 ? 0 : 1)}
                        style={{ width: "100%", padding: "6px 12px", background: item.value === 1 ? "#3b82f6" : "#e5e7eb", color: item.value === 1 ? "#fff" : "#333", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
                    >
                        {item.value === 1 ? "ON (닫힘)" : "OFF (열림)"}
                    </button>
                    <div style={{ fontSize: 11, color: "#777", marginTop: 8 }}>* 스위치를 클릭해도 전환됩니다.</div>
                </div>
            )}

            {(isA || isV) && (
                <div style={{ fontSize: 13, color: "#555", padding: "8px 0" }}>
                    이상적인 {isA ? "전류계 (0Ω)" : "전압계 (무한대 저항)"}입니다.
                </div>
            )}

            <div style={{ marginTop: 12, fontSize: 12, color: "#888" }}>
                UUID: {item.uuid.slice(0, 8)}...
            </div>
        </div>
    );
};

export default PropertyPanel;
