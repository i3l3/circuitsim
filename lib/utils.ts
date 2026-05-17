export function formatUnit(value: number, unit: string): string {
    if (value === 0 || Math.abs(value) < 1e-7) return `0${unit}`;

    const absVal = Math.abs(value);
    let prefix = "";
    let scaled = value;

    if (absVal >= 1e9) {
        prefix = "G";
        scaled = value / 1e9;
    } else if (absVal >= 1e6) {
        prefix = "M";
        scaled = value / 1e6;
    } else if (absVal >= 1e3) {
        prefix = "k";
        scaled = value / 1e3;
    } else if (absVal >= 1) {
        prefix = "";
    } else if (absVal >= 1e-3) {
        prefix = "m";
        scaled = value * 1e3;
    } else if (absVal >= 1e-6) {
        prefix = "μ";
        scaled = value * 1e6;
    } else if (absVal >= 1e-9) {
        prefix = "n";
        scaled = value * 1e9;
    }

    // Keep up to 2 decimal places
    const formattedStr = scaled.toFixed(2).replace(/\.00$/, "").replace(/(\.[1-9])0$/, "$1");
    return `${formattedStr}${prefix}${unit}`;
}
