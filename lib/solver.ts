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

export function calculatePartialResistance(selectedUuids: string[], items: Item[], wires: Wire[]): number | undefined {
    const selectedItems = items.filter(i => selectedUuids.includes(i.uuid) && i.type === "resistor");
    if (selectedItems.length === 0) return undefined;
    if (selectedItems.length === 1) return selectedItems[0].value || 100;

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

    // Union all wires
    for (const w of wires) union(termKey(w.from), termKey(w.to));

    // Find all nets involved in the selected items
    const involvedNets = new Set<string>();
    const netDegrees: Record<string, number> = {};

    for (const item of selectedItems) {
        const tA = find(termKey({ type: "item", itemUuid: item.uuid, side: "A" }));
        const tB = find(termKey({ type: "item", itemUuid: item.uuid, side: "B" }));
        involvedNets.add(tA);
        involvedNets.add(tB);
        netDegrees[tA] = (netDegrees[tA] || 0) + 1;
        netDegrees[tB] = (netDegrees[tB] || 0) + 1;
    }

    // A net is an "external terminal" if it has degree 1 in the sub-circuit,
    // OR if it connects to any unselected item.
    const externalNets = new Set<string>();
    for (const net of involvedNets) {
        if (netDegrees[net] === 1) {
            externalNets.add(net);
        } else {
            // Check if it connects to an unselected item
            let connectsToOutside = false;
            for (const item of items) {
                if (selectedUuids.includes(item.uuid)) continue;
                const tA = find(termKey({ type: "item", itemUuid: item.uuid, side: "A" }));
                const tB = find(termKey({ type: "item", itemUuid: item.uuid, side: "B" }));
                if (tA === net || tB === net) connectsToOutside = true;
            }
            if (connectsToOutside) externalNets.add(net);
        }
    }

    // Compute approximate physical center of each net to find the "ends" of the circuit
    const netPos: Record<string, { x: number, y: number, c: number }> = {};
    for (const item of selectedItems) {
        const tA = find(termKey({ type: "item", itemUuid: item.uuid, side: "A" }));
        const tB = find(termKey({ type: "item", itemUuid: item.uuid, side: "B" }));
        // Approximate terminal positions
        const rad = (item.rotation || 0) * Math.PI / 180;
        const dxA = 0, dyA = 25; // Side A relative to item
        const dxB = 100, dyB = 25; // Side B relative to item
        
        const pxA = item.x + dxA * Math.cos(rad) - dyA * Math.sin(rad);
        const pyA = item.y + dxA * Math.sin(rad) + dyA * Math.cos(rad);
        const pxB = item.x + dxB * Math.cos(rad) - dyB * Math.sin(rad);
        const pyB = item.y + dxB * Math.sin(rad) + dyB * Math.cos(rad);

        if (!netPos[tA]) netPos[tA] = { x: 0, y: 0, c: 0 };
        netPos[tA].x += pxA; netPos[tA].y += pyA; netPos[tA].c++;

        if (!netPos[tB]) netPos[tB] = { x: 0, y: 0, c: 0 };
        netPos[tB].x += pxB; netPos[tB].y += pyB; netPos[tB].c++;
    }

    const candidateNets = externalNets.size >= 2 ? Array.from(externalNets) : Array.from(involvedNets);
    if (candidateNets.length < 2) return undefined;

    let maxDist = -1;
    let testA = candidateNets[0];
    let testB = candidateNets[1];

    for (let i = 0; i < candidateNets.length; i++) {
        for (let j = i + 1; j < candidateNets.length; j++) {
            const n1 = candidateNets[i];
            const n2 = candidateNets[j];
            const p1 = netPos[n1];
            const p2 = netPos[n2];
            if (!p1 || !p2) continue;
            const dist = Math.hypot((p1.x / p1.c) - (p2.x / p2.c), (p1.y / p1.c) - (p2.y / p2.c));
            if (dist > maxDist) {
                maxDist = dist;
                testA = n1;
                testB = n2;
            }
        }
    }

    // Build a sub-circuit with a 1V test battery
    const testBattery: Item = {
        uuid: "test_batt", x: 0, y: 0, rotation: 0, connectedA: null, connectedB: null,
        type: "battery", value: 1
    };
    const subItems = [...selectedItems, testBattery];

    // Wires to connect test battery and sub-items using proxy nodes for each net
    const uniqueNets = Array.from(involvedNets);
    const subWires: Wire[] = [];
    const subNodes: WireNode[] = [];
    
    uniqueNets.forEach((net, idx) => {
        subNodes.push({ uuid: `sim_node_${idx}`, x: 0, y: 0 });
    });
    
    // Connect selected items to these proxy nodes
    for (const item of selectedItems) {
        const tA = find(termKey({ type: "item", itemUuid: item.uuid, side: "A" }));
        const tB = find(termKey({ type: "item", itemUuid: item.uuid, side: "B" }));
        
        const idxA = uniqueNets.indexOf(tA);
        const idxB = uniqueNets.indexOf(tB);
        
        subWires.push({ uuid: crypto.randomUUID(), from: { type: "item", itemUuid: item.uuid, side: "A" }, to: { type: "node", nodeUuid: subNodes[idxA].uuid }, bendPoints: [] });
        subWires.push({ uuid: crypto.randomUUID(), from: { type: "item", itemUuid: item.uuid, side: "B" }, to: { type: "node", nodeUuid: subNodes[idxB].uuid }, bendPoints: [] });
    }
    
    // Connect test battery
    const idxTestA = uniqueNets.indexOf(testA);
    const idxTestB = uniqueNets.indexOf(testB);
    subWires.push({ uuid: crypto.randomUUID(), from: { type: "item", itemUuid: "test_batt", side: "A" }, to: { type: "node", nodeUuid: subNodes[idxTestA].uuid }, bendPoints: [] });
    subWires.push({ uuid: crypto.randomUUID(), from: { type: "item", itemUuid: "test_batt", side: "B" }, to: { type: "node", nodeUuid: subNodes[idxTestB].uuid }, bendPoints: [] });

    const sim = solveCircuit(subItems, subNodes, subWires);
    if (!sim.success) return undefined;

    const testCurrent = Math.abs(sim.itemCurrents["test_batt"]);
    if (testCurrent < 1e-10) return undefined;

    return 1 / testCurrent;
}
