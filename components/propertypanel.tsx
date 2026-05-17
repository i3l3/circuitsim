"use client";
import { Item } from "@/components/circuitsim";
import { Dispatch, SetStateAction } from "react";

const PropertyPanel = ({ item, setItems, onClose }: {
    item: Item;
    setItems: Dispatch<SetStateAction<Item[]>>;
    onClose: () => void;
}) => {
    const isR = item.type === "resistor";
    const label = isR ? "저항 (Ω)" : "전압 (V)";
    const val = item.value ?? (isR ? 100 : 5);

    const update = (v: number) => {
        setItems(prev => prev.map(i => i.uuid === item.uuid ? { ...i, value: v } : i));
    };

    return (
        <div style={{
            position: "fixed", top: 60, right: 20, width: 220, padding: 16,
            background: "#fff", border: "1px solid #ccc", borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: 1000, fontFamily: "sans-serif"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <b>{isR ? "⚡ 저항" : "🔋 전지"} 속성</b>
                <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <label style={{ fontSize: 13, color: "#555" }}>{label}</label>
            <input type="number" value={val} min={0} step={isR ? 10 : 0.1}
                onChange={e => update(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: 6, marginTop: 4, border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                UUID: {item.uuid.slice(0, 8)}...
            </div>
        </div>
    );
};

export default PropertyPanel;
