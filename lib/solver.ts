import { Item, Terminal, Wire, WireNode } from "@/components/circuitsim";

// Gaussian Elimination solver
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
    const n = b.length;
    for (let p = 0; p < n; p++) {
        let max = p;
        for (let i = p + 1; i < n; i++) {
            if (Math.abs(A[i][p]) > Math.abs(A[max][p])) max = i;
        }
        const temp = A[p]; A[p] = A[max]; A[max] = temp;
        const t = b[p]; b[p] = b[max]; b[max] = t;

        if (Math.abs(A[p][p]) <= 1e-10) return null; // Singular matrix

        for (let i = p + 1; i < n; i++) {
            const alpha = A[i][p] / A[p][p];
            b[i] -= alpha * b[p];
            for (let j = p; j < n; j++) {
                A[i][j] -= alpha * A[p][j];
            }
        }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            sum += A[i][j] * x[j];
        }
        x[i] = (b[i] - sum) / A[i][i];
    }
    return x;
}

const termKey = (t: Terminal) => t.type === "item" ? `item_${t.itemUuid}_${t.side}` : `node_${t.nodeUuid}`;

export interface SimulationResult {
    netVoltages: Record<string, number>; // termKey -> voltage
    itemCurrents: Record<string, number>; // itemUuid -> current (A -> B direction)
    itemVoltages: Record<string, number>; // itemUuid -> voltage drop (V_A - V_B)
    equivalentResistance?: number;
    success: boolean;
    error?: string;
}

export function solveCircuit(items: Item[], nodes: WireNode[], wires: Wire[]): SimulationResult {
    const parent: Record<string, string> = {};
    const find = (i: string): string => {
        if (parent[i] === undefined) parent[i] = i;
        if (parent[i] === i) return i;
        return parent[i] = find(parent[i]);
    };
    const union = (i: string, j: string) => {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    // 1. Group connected terminals into Nets
    for (const w of wires) {
        union(termKey(w.from), termKey(w.to));
    }
    // Make sure all item terminals exist in the graph even if unconnected
    for (const item of items) {
        find(termKey({ type: "item", itemUuid: item.uuid, side: "A" }));
        find(termKey({ type: "item", itemUuid: item.uuid, side: "B" }));
    }

    const nets = new Set<string>();
    const termToNet: Record<string, string> = {};
    for (const k of Object.keys(parent)) {
        const root = find(k);
        nets.add(root);
        termToNet[k] = root;
    }

    const netList = Array.from(nets);
    if (netList.length === 0) return { netVoltages: {}, itemCurrents: {}, itemVoltages: {}, success: true };

    const netIndex: Record<string, number> = {};
    netList.forEach((n, i) => netIndex[n] = i);

    const numNets = netList.length;
    const batteries = items.filter(i => i.type === "battery");
    const numBatts = batteries.length;

    // We need a ground node (index 0). If there's a battery, we ground its B terminal.
    let groundNet = netList[0];
    if (batteries.length > 0) {
        groundNet = termToNet[termKey({ type: "item", itemUuid: batteries[0].uuid, side: "B" })];
    }
    const groundIdx = netIndex[groundNet];

    // MNA Matrix
    // Size: (numNets + numBatts) x (numNets + numBatts)
    const size = numNets + numBatts;
    const A: number[][] = Array(size).fill(0).map(() => Array(size).fill(0));
    const z: number[] = Array(size).fill(0);

    // Ground node equation: V_ground = 0
    A[groundIdx][groundIdx] = 1;
    z[groundIdx] = 0;

    // Resistors
    for (const item of items) {
        if (item.type !== "resistor") continue;
        const netA = netIndex[termToNet[termKey({ type: "item", itemUuid: item.uuid, side: "A" })]];
        const netB = netIndex[termToNet[termKey({ type: "item", itemUuid: item.uuid, side: "B" })]];
        if (netA === netB) continue; // shorted

        const R = item.value || 100;
        const g = 1 / R;

        if (netA !== groundIdx) A[netA][netA] += g;
        if (netB !== groundIdx) A[netB][netB] += g;
        if (netA !== groundIdx && netB !== groundIdx) {
            A[netA][netB] -= g;
            A[netB][netA] -= g;
        }
    }

    // Batteries
    batteries.forEach((batt, bIdx) => {
        const mIdx = numNets + bIdx;
        const netA = netIndex[termToNet[termKey({ type: "item", itemUuid: batt.uuid, side: "A" })]]; // Positive
        const netB = netIndex[termToNet[termKey({ type: "item", itemUuid: batt.uuid, side: "B" })]]; // Negative
        const V = batt.value || 5;

        // V_A - V_B = V
        A[mIdx][netA] = 1;
        A[mIdx][netB] = -1;
        z[mIdx] = V;

        // Add current variable to KCL equations
        if (netA !== groundIdx) A[netA][mIdx] = 1;
        if (netB !== groundIdx) A[netB][mIdx] = -1;
    });

    const x = solveLinearSystem(A, z);
    if (!x) {
        return { netVoltages: {}, itemCurrents: {}, itemVoltages: {}, success: false, error: "회로가 불안정합니다. (단락 또는 잘못된 연결)" };
    }

    const resultVoltages: Record<string, number> = {};
    for (const term of Object.keys(termToNet)) {
        const net = termToNet[term];
        const v = x[netIndex[net]];
        resultVoltages[term] = v;
    }

    const itemCurrents: Record<string, number> = {};
    const itemVoltages: Record<string, number> = {};

    let totalPower = 0;
    let totalBatteryCurrent = 0;

    for (const item of items) {
        const termA = termKey({ type: "item", itemUuid: item.uuid, side: "A" });
        const termB = termKey({ type: "item", itemUuid: item.uuid, side: "B" });
        const vA = resultVoltages[termA] || 0;
        const vB = resultVoltages[termB] || 0;
        itemVoltages[item.uuid] = vA - vB;

        if (item.type === "resistor") {
            const R = item.value || 100;
            const I = (vA - vB) / R;
            itemCurrents[item.uuid] = I;
            totalPower += I * I * R;
        } else if (item.type === "battery") {
            const bIdx = batteries.findIndex(b => b.uuid === item.uuid);
            const I = -x[numNets + bIdx];
            itemCurrents[item.uuid] = I; // Current flowing A -> B (positive to negative)
            if (I > 0) totalBatteryCurrent += I; // Current leaving positive terminal
        }
    }

    let equivalentResistance: number | undefined = undefined;
    if (totalBatteryCurrent > 1e-10) {
        equivalentResistance = totalPower / (totalBatteryCurrent * totalBatteryCurrent);
    }

    return {
        netVoltages: resultVoltages,
        itemCurrents,
        itemVoltages,
        equivalentResistance,
        success: true
    };
}
